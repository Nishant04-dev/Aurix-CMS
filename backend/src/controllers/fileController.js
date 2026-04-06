import { z } from 'zod';
import { fileQueue } from '../queue/queues.js';
import { checkLimit } from '../services/permissionService.js';
import { supabase } from '../config/supabase.js';
import { ok, created, badRequest, forbidden, serverError } from '../utils/response.js';
import { logger } from '../utils/logger.js';

const RegisterFileSchema = z.object({
  name:         z.string().min(1),
  storage_path: z.string().min(1),
  project_id:   z.string().uuid(),
  size:         z.number().min(0),
  type:         z.string().optional(),
});

export async function registerFile(req, res) {
  try {
    const { orgId, id: userId } = req.user;

    const limit = await checkLimit(orgId, 'file');
    if (!limit.allowed) return forbidden(res, limit.reason);

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

    if (!['admin', 'super_admin', 'manager'].includes(role)) {
      return forbidden(res, 'Only admins can delete files');
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
