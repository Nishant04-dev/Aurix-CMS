import { z } from 'zod';
import { fileQueue } from '../queue/queues.js';
import { supabase } from '../config/supabase.js';
import { getLimits } from '../config/planLimits.js';
import { can, normalizeRole } from '../config/accessControl.js';
import { ok, created, badRequest, forbidden, serverError } from '../utils/response.js';
import { logger } from '../utils/logger.js';

const RegisterFileSchema = z.object({
  name:         z.string().min(1),
  storage_path: z.string().min(1),
  project_id:   z.string().uuid(),
  size:         z.number().min(0),
  type:         z.string().optional(),
});

/**
 * GET /files — list files for the org.
 * Clients see only files for their projects.
 * Members/admins see all org files.
 */
export async function getFiles(req, res) {
  try {
    const { orgId, role, id: userId } = req.user;
    const { project_id } = req.query;

    if (!can(role, 'files', 'view')) {
      return forbidden(res, 'Access denied');
    }

    let query = supabase
      .from('files')
      .select('id, name, storage_path, project_id, size, type, uploaded_by, created_at, org_id')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    // Clients only see files for their projects — dual-path lookup
    if (normalizeRole(role) === 'client') {
      const projectIds = new Set();

      const { data: client } = await supabase
        .from('clients').select('id').eq('user_id', userId).eq('org_id', orgId).maybeSingle();

      if (client) {
        const { data: clientProjects } = await supabase
          .from('projects').select('id').eq('client_id', client.id).eq('org_id', orgId);
        (clientProjects || []).forEach(p => projectIds.add(p.id));
      }

      const { data: memberProjects } = await supabase
        .from('project_members').select('project_id').eq('user_id', userId);
      (memberProjects || []).forEach(p => projectIds.add(p.project_id));

      const ids = [...projectIds];
      logger.info('getFiles: client project lookup', { userId, orgId, clientId: client?.id, projectCount: ids.length });

      if (ids.length === 0) return ok(res, []);
      query = query.in('project_id', ids);
    } else if (project_id) {
      query = query.eq('project_id', project_id);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Enrich with uploader name
    const uploaderIds = [...new Set((data || []).map(f => f.uploaded_by).filter(Boolean))];
    const profileMap = {};
    if (uploaderIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles').select('id, name').in('id', uploaderIds);
      for (const p of profiles || []) profileMap[p.id] = p.name;
    }

    return ok(res, (data || []).map(f => ({
      ...f,
      uploaderName: profileMap[f.uploaded_by] || 'Unknown',
    })));
  } catch (err) {
    logger.error('getFiles error', { err: err.message });
    return serverError(res, err.message);
  }
}

export async function registerFile(req, res) {
  try {
    const { orgId, id: userId, role } = req.user;

    // Role check
    if (!can(role, 'files', 'upload')) {
      return forbidden(res, 'Access denied');
    }

    // Plan check — files feature must be enabled
    const { data: org } = await supabase.from('organizations').select('plan').eq('id', orgId).single();
    const limits = getLimits(org?.plan);
    if (!limits.files) {
      return forbidden(res, `File uploads require a Pro or Enterprise plan. Current plan: ${org?.plan || 'free'}.`);
    }

    const data = RegisterFileSchema.parse(req.body);

    // Validate project belongs to org
    const { data: project } = await supabase
      .from('projects')
      .select('id, status')
      .eq('id', data.project_id)
      .eq('org_id', orgId)
      .single();

    if (!project) return badRequest(res, 'Project not found in your organization');
    if (project.status === 'cancelled') return forbidden(res, 'Cannot upload files to a cancelled project');

    const job = await fileQueue.add('register-file', { type: 'register', data, userId, orgId });
    return created(res, { jobId: job.id }, 'File registered');
  } catch (err) {
    if (err.name === 'ZodError') return badRequest(res, err.errors.map(e => e.message).join('; '));
    logger.error('registerFile error', { err: err.message });
    return serverError(res, err.message);
  }
}

export async function deleteFile(req, res) {
  try {
    const { orgId, id: userId, role } = req.user;
    const { file_id } = req.params;

    if (!can(role, 'files', 'delete')) {
      return forbidden(res, 'Access denied');
    }

    const { data: file } = await supabase
      .from('files')
      .select('id, storage_path')
      .eq('id', file_id)
      .eq('org_id', orgId)
      .single();

    if (!file) return badRequest(res, 'File not found');

    const job = await fileQueue.add('delete-file', {
      type: 'delete',
      data: { id: file.id, storage_path: file.storage_path },
      userId,
      orgId,
    });

    return ok(res, { jobId: job.id }, 'File deletion queued');
  } catch (err) {
    return serverError(res, err.message);
  }
}
