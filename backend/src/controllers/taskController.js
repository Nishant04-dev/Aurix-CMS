import { z } from 'zod';
import { supabase } from '../config/supabase.js';
import { can, normalizeRole } from '../config/accessControl.js';
import { ok, created, badRequest, forbidden, notFound, serverError } from '../utils/response.js';
import { logger } from '../utils/logger.js';

const CreateTaskSchema = z.object({
  project_id:     z.string().uuid(),
  title:          z.string().min(1).max(300),
  description:    z.string().max(2000).optional(),
  assigned_to_id: z.string().uuid().optional().nullable(),
  status:         z.enum(['todo', 'in_progress', 'done']).default('todo'),
  priority:       z.enum(['low', 'medium', 'high']).default('medium'),
  due_date:       z.string().optional().nullable(),
});

const UpdateTaskSchema = CreateTaskSchema.partial().omit({ project_id: true });

export async function getTasks(req, res) {
  try {
    const { orgId, role, id: userId } = req.user;
    const { project_id } = req.query;

    let query = supabase
      .from('tasks')
      .select('*, subtasks(*)')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    const normalized = normalizeRole(role);

    if (normalized === 'client') {
      // Clients see tasks for their projects only
      const { data: client } = await supabase
        .from('clients').select('id').eq('user_id', userId).eq('org_id', orgId).single();
      if (!client) return ok(res, []);
      const { data: projects } = await supabase
        .from('projects').select('id').eq('client_id', client.id).eq('org_id', orgId);
      const ids = (projects || []).map(p => p.id);
      if (ids.length === 0) return ok(res, []);
      query = query.in('project_id', ids);
    } else if (normalized === 'member') {
      // Members see only tasks assigned to them
      query = query.eq('assigned_to_id', userId);
    } else if (project_id) {
      query = query.eq('project_id', project_id);
    }

    const { data, error } = await query;
    if (error) throw error;
    return ok(res, data ?? []);
  } catch (err) {
    logger.error('getTasks error', { err: err.message });
    return serverError(res, err.message);
  }
}

export async function createTask(req, res) {
  try {
    const { orgId, role } = req.user;
    if (!can(role, 'tasks', 'create')) {
      return forbidden(res, 'Insufficient permissions to create tasks');
    }
    const data = CreateTaskSchema.parse(req.body);

    // Verify project belongs to org
    const { data: project } = await supabase
      .from('projects').select('id').eq('id', data.project_id).eq('org_id', orgId).single();
    if (!project) return badRequest(res, 'Project not found in your organization');

    const { data: task, error } = await supabase
      .from('tasks')
      .insert({ ...data, org_id: orgId })
      .select()
      .single();

    if (error) throw error;
    return created(res, task, 'Task created');
  } catch (err) {
    if (err.name === 'ZodError') return badRequest(res, err.errors.map(e => e.message).join('; '));
    logger.error('createTask error', { err: err.message });
    return serverError(res, err.message);
  }
}

export async function updateTask(req, res) {
  try {
    const { orgId, role, id: userId } = req.user;
    const { id } = req.params;

    const { data: existing } = await supabase
      .from('tasks').select('id, assigned_to_id').eq('id', id).eq('org_id', orgId).single();
    if (!existing) return notFound(res, 'Task not found');

    // Clients cannot update tasks
    if (normalizeRole(role) === 'client') {
      return forbidden(res, 'Clients cannot update tasks');
    }

    // Members can only update tasks assigned to them
    if (normalizeRole(role) === 'member' && existing.assigned_to_id !== userId) {
      return forbidden(res, 'You can only update tasks assigned to you');
    }

    const data = UpdateTaskSchema.parse(req.body);
    const { data: task, error } = await supabase
      .from('tasks')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('org_id', orgId)
      .select()
      .single();

    if (error) throw error;
    return ok(res, task, 'Task updated');
  } catch (err) {
    if (err.name === 'ZodError') return badRequest(res, err.errors.map(e => e.message).join('; '));
    logger.error('updateTask error', { err: err.message });
    return serverError(res, err.message);
  }
}

export async function deleteTask(req, res) {
  try {
    const { orgId, role } = req.user;
    const { id } = req.params;

    if (!can(role, 'tasks', 'delete')) {
      return forbidden(res, 'Insufficient permissions to delete tasks');
    }

    const { data: existing } = await supabase
      .from('tasks').select('id').eq('id', id).eq('org_id', orgId).single();
    if (!existing) return notFound(res, 'Task not found');

    const { error } = await supabase.from('tasks').delete().eq('id', id).eq('org_id', orgId);
    if (error) throw error;
    return ok(res, null, 'Task deleted');
  } catch (err) {
    logger.error('deleteTask error', { err: err.message });
    return serverError(res, err.message);
  }
}
