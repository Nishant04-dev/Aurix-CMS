import { z } from 'zod';
import { supabase } from '../config/supabase.js';
import { can, normalizeRole } from '../config/accessControl.js';
import { ok, created, badRequest, forbidden, notFound, serverError } from '../utils/response.js';
import { logger } from '../utils/logger.js';
import { logAudit } from '../utils/auditLogger.js';

const REDIS_ENABLED = process.env.REDIS_ENABLED === 'true';

// Lazy-load queue only when Redis is enabled
async function getProjectQueue() {
  if (!REDIS_ENABLED) return null;
  const { projectQueue } = await import('../queue/queues.js');
  return projectQueue;
}

const CreateProjectSchema = z.object({
  title:        z.string().min(1).max(200),
  description:  z.string().max(2000).optional(),
  client_id:    z.string().uuid(),
  status:       z.enum(['pending','in_progress','completed','on_hold','cancelled']).default('pending'),
  deadline:     z.string().optional(),
  budget_total: z.number().min(0).default(0),
  budget_spent: z.number().min(0).default(0),
});

export async function createProject(req, res) {
  try {
    const { orgId, id: userId } = req.user;

    const { checkLimit } = await import('../services/permissionService.js');
    const limit = await checkLimit(orgId, 'project');
    if (!limit.allowed) return forbidden(res, limit.reason);

    const data = CreateProjectSchema.parse(req.body);

    // Validate client belongs to same org
    const { data: client } = await supabase
      .from('clients').select('id').eq('id', data.client_id).eq('org_id', orgId).single();
    if (!client) return badRequest(res, 'Client not found in your organization');

    const queue = await getProjectQueue();

    if (queue) {
      const job = await queue.add('create-project', { type: 'create', data, userId, orgId });
      logger.info('Project creation queued', { jobId: job.id, orgId });
      return created(res, { jobId: job.id }, 'Project creation queued');
    }

    // Direct insert when Redis is disabled
    const insertPayload = {
      ...data,
      org_id:     orgId,
      created_by: userId || null,
    };
    console.log('PROJECT PAYLOAD:', JSON.stringify(insertPayload));

    const { data: project, error } = await supabase
      .from('projects')
      .insert(insertPayload)
      .select().single();
    if (error) {
      console.error('PROJECT INSERT ERROR:', error.message, error.details, error.hint);
      throw error;
    }
    console.log('PROJECT RESULT:', project?.id);

    // Auto-create project chat channel
    const { data: channel } = await supabase
      .from('chat_channels')
      .insert({ name: project.title.toLowerCase().replace(/\s+/g, '-').slice(0, 50), type: 'project', project_id: project.id, org_id: orgId, created_by: userId })
      .select().single();

    if (channel) {
      // Auto-add creator + admins to channel
      const { data: admins } = await supabase
        .from('memberships').select('user_id').eq('org_id', orgId).in('role', ['admin', 'super_admin']);
      const memberIds = [...new Set([userId, ...(admins ?? []).map(a => a.user_id)])];
      await supabase.from('channel_members').insert(
        memberIds.map(uid => ({ channel_id: channel.id, user_id: uid }))
      );
    }

    logAudit({ orgId, actorId: userId, action: 'project.created', targetType: 'project', targetId: project.id, metadata: { title: project.title } });

    await supabase.from('notifications').insert({
      user_id: userId, org_id: orgId, title: 'Project Created',
      message: `Project "${project.title}" has been created successfully.`,
    });

    return created(res, project, 'Project created');
  } catch (err) {
    if (err.name === 'ZodError') return badRequest(res, err.errors.map(e => e.message).join('; '));
    logger.error('createProject error', { err: err.message });
    return serverError(res, err.message);
  }
}

export async function getProjects(req, res) {
  try {
    const { orgId, role, id: userId } = req.user;

    let query = supabase
      .from('projects')
      .select('*, project_members(id, user_id)')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    // Members (developer/support/member) only see assigned projects
    const normalized = normalizeRole(role);
    if (normalized === 'member') {
      const { data: memberProjects } = await supabase
        .from('project_members')
        .select('project_id')
        .eq('user_id', userId);
      const ids = memberProjects?.map(p => p.project_id) || [];
      if (ids.length === 0) return ok(res, []);
      query = query.in('id', ids);
    }

    // Client sees only their projects — two lookup paths:
    // 1. Primary: projects where project.client_id matches their clients row
    // 2. Fallback: projects where they are in project_members
    if (normalized === 'client') {
      const projectIds = new Set();

      // Path 1: via clients table (client_id on project)
      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', userId)
        .eq('org_id', orgId)
        .maybeSingle();

      if (client) {
        const { data: clientProjects } = await supabase
          .from('projects')
          .select('id')
          .eq('client_id', client.id)
          .eq('org_id', orgId);
        (clientProjects || []).forEach(p => projectIds.add(p.id));
      }

      // Path 2: via project_members (explicit membership)
      const { data: memberProjects } = await supabase
        .from('project_members')
        .select('project_id')
        .eq('user_id', userId);
      (memberProjects || []).forEach(p => projectIds.add(p.project_id));

      const ids = [...projectIds];
      logger.info('getProjects: client project lookup', { userId, orgId, clientId: client?.id, projectCount: ids.length });

      if (ids.length === 0) return ok(res, []);
      query = query.in('id', ids);
    }

    const { data, error } = await query;
    if (error) throw error;
    return ok(res, data);
  } catch (err) {
    logger.error('getProjects error', { err: err.message });
    return serverError(res, err.message);
  }
}

const UpdateProjectSchema = z.object({
  title:        z.string().min(1).max(200).optional(),
  description:  z.string().max(2000).optional(),
  status:       z.enum(['pending','in_progress','completed','on_hold','cancelled']).optional(),
  deadline:     z.string().optional(),
  budget_total: z.number().min(0).optional(),
  budget_spent: z.number().min(0).optional(),
  progress:     z.number().min(0).max(100).optional(),
});

export async function updateProject(req, res) {
  try {
    const { orgId, id: userId } = req.user;
    const { id } = req.params;

    const { data: existing } = await supabase
      .from('projects').select('id, title').eq('id', id).eq('org_id', orgId).single();
    if (!existing) return notFound(res, 'Project not found');

    const data = UpdateProjectSchema.parse(req.body);

    const { data: project, error } = await supabase
      .from('projects')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id).eq('org_id', orgId)
      .select().single();

    if (error) throw error;

    logAudit({ orgId, actorId: userId, action: 'project.updated', targetType: 'project', targetId: id, metadata: { title: existing.title, changes: Object.keys(data) } });

    return ok(res, project, 'Project updated');
  } catch (err) {
    if (err.name === 'ZodError') return badRequest(res, err.errors.map(e => e.message).join('; '));
    logger.error('updateProject error', { err: err.message });
    return serverError(res, err.message);
  }
}

export async function deleteProject(req, res) {
  try {
    const { orgId, role, id: userId } = req.user;
    const { id } = req.params;

    if (!can(role, 'projects', 'delete')) {
      return forbidden(res, 'Insufficient permissions to delete projects');
    }

    const { data: existing } = await supabase
      .from('projects').select('id, title').eq('id', id).eq('org_id', orgId).single();
    if (!existing) return notFound(res, 'Project not found');

    const queue = await getProjectQueue();
    if (queue) {
      const job = await queue.add('delete-project', { type: 'delete', data: { id }, orgId });
      return ok(res, { jobId: job.id }, 'Project deletion queued');
    }

    // Direct delete when Redis is disabled
    await supabase.from('projects').delete().eq('id', id).eq('org_id', orgId);
    logAudit({ orgId, actorId: userId, action: 'project.deleted', targetType: 'project', targetId: id, metadata: { title: existing.title } });

    return ok(res, null, 'Project deleted');
  } catch (err) {
    logger.error('deleteProject error', { err: err.message });
    return serverError(res, err.message);
  }
}
