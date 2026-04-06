import { z } from 'zod';
import { projectQueue } from '../queue/queues.js';
import { checkLimit } from '../services/permissionService.js';
import { supabase } from '../config/supabase.js';
import { ok, created, badRequest, forbidden, notFound, serverError } from '../utils/response.js';
import { logger } from '../utils/logger.js';

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

    // Check plan limit
    const limit = await checkLimit(orgId, 'project');
    if (!limit.allowed) return forbidden(res, limit.reason);

    const data = CreateProjectSchema.parse(req.body);

    // Validate client belongs to same org
    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('id', data.client_id)
      .eq('org_id', orgId)
      .single();

    if (!client) return badRequest(res, 'Client not found in your organization');

    const job = await projectQueue.add('create-project', {
      type: 'create',
      data,
      userId,
      orgId,
    });

    logger.info('Project creation queued', { jobId: job.id, orgId });
    return created(res, { jobId: job.id }, 'Project creation queued');
  } catch (err) {
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

    // Staff only see assigned projects
    if (role === 'developer' || role === 'support') {
      const { data: memberProjects } = await supabase
        .from('project_members')
        .select('project_id')
        .eq('user_id', userId);
      const ids = memberProjects?.map(p => p.project_id) || [];
      if (ids.length === 0) return ok(res, []);
      query = query.in('id', ids);
    }

    // Client sees only their projects
    if (role === 'client') {
      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', userId)
        .eq('org_id', orgId)
        .single();
      if (!client) return ok(res, []);
      query = query.eq('client_id', client.id);
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
    const { orgId } = req.user;
    const { id } = req.params;

    const { data: existing } = await supabase
      .from('projects').select('id').eq('id', id).eq('org_id', orgId).single();
    if (!existing) return notFound(res, 'Project not found');

    const data = UpdateProjectSchema.parse(req.body);

    const { data: project, error } = await supabase
      .from('projects')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('org_id', orgId)
      .select()
      .single();

    if (error) throw error;
    return ok(res, project, 'Project updated');
  } catch (err) {
    if (err.name === 'ZodError') return badRequest(res, err.errors.map(e => e.message).join('; '));
    logger.error('updateProject error', { err: err.message });
    return serverError(res, err.message);
  }
}

export async function deleteProject(req, res) {
  try {
    const { orgId, role } = req.user;
    const { id } = req.params;

    if (!['admin', 'super_admin', 'manager'].includes(role)) {
      return forbidden(res, 'Insufficient permissions to delete projects');
    }

    const { data: existing } = await supabase
      .from('projects').select('id').eq('id', id).eq('org_id', orgId).single();
    if (!existing) return notFound(res, 'Project not found');

    const job = await projectQueue.add('delete-project', {
      type: 'delete',
      data: { id },
      orgId,
    });

    return ok(res, { jobId: job.id }, 'Project deletion queued');
  } catch (err) {
    logger.error('deleteProject error', { err: err.message });
    return serverError(res, err.message);
  }
}
