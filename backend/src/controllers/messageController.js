import { z } from 'zod';
import { supabase } from '../config/supabase.js';
import { ok, created, badRequest, forbidden, serverError } from '../utils/response.js';
import { logger } from '../utils/logger.js';

const SendMessageSchema = z.object({
  project_id: z.string().uuid(),
  content:    z.string().min(1).max(4000),
});

export async function getMessages(req, res) {
  try {
    const { orgId, role, id: userId } = req.user;
    const { project_id } = req.query;

    if (!project_id) return badRequest(res, 'project_id query param required');

    // Verify project belongs to org
    const { data: project } = await supabase
      .from('projects').select('id, client_id, status').eq('id', project_id).eq('org_id', orgId).single();
    if (!project) return badRequest(res, 'Project not found');

    // Client can only see messages for their own projects
    if (role === 'client') {
      const { data: client } = await supabase
        .from('clients').select('id').eq('user_id', userId).eq('org_id', orgId).single();
      if (!client || client.id !== project.client_id) {
        return forbidden(res, 'Access denied');
      }
    }

    const { data, error } = await supabase
      .from('messages')
      .select('*, profiles(id, name, avatar_url)')
      .eq('project_id', project_id)
      .eq('org_id', orgId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return ok(res, data ?? []);
  } catch (err) {
    logger.error('getMessages error', { err: err.message });
    return serverError(res, err.message);
  }
}

export async function sendMessage(req, res) {
  try {
    const { orgId, id: userId, role } = req.user;
    const { project_id, content } = SendMessageSchema.parse(req.body);

    // Verify project belongs to org and is not cancelled
    const { data: project } = await supabase
      .from('projects').select('id, client_id, status').eq('id', project_id).eq('org_id', orgId).single();
    if (!project) return badRequest(res, 'Project not found');
    if (project.status === 'cancelled' && !['admin', 'super_admin'].includes(role)) {
      return forbidden(res, 'Cannot send messages to a cancelled project');
    }

    // Client access check
    if (role === 'client') {
      const { data: client } = await supabase
        .from('clients').select('id').eq('user_id', userId).eq('org_id', orgId).single();
      if (!client || client.id !== project.client_id) {
        return forbidden(res, 'Access denied');
      }
    }

    const { data: message, error } = await supabase
      .from('messages')
      .insert({ content, sender_id: userId, project_id, org_id: orgId })
      .select('*, profiles(id, name, avatar_url)')
      .single();

    if (error) throw error;
    return created(res, message, 'Message sent');
  } catch (err) {
    if (err.name === 'ZodError') return badRequest(res, err.errors.map(e => e.message).join('; '));
    logger.error('sendMessage error', { err: err.message });
    return serverError(res, err.message);
  }
}

export async function getLastMessages(req, res) {
  try {
    const { orgId, role, id: userId } = req.user;
    const { project_ids } = req.query;
    if (!project_ids) return badRequest(res, 'project_ids query param required');

    const ids = project_ids.split(',').filter(Boolean);
    if (!ids.length) return ok(res, []);

    const { data, error } = await supabase
      .from('messages')
      .select('id, content, created_at, project_id')
      .in('project_id', ids)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return ok(res, data ?? []);
  } catch (err) {
    logger.error('getLastMessages error', { err: err.message });
    return serverError(res, err.message);
  }
}
