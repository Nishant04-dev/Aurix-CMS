import { z } from 'zod';
import { supabase } from '../config/supabase.js';
import { checkLimit } from '../services/permissionService.js';
import { ok, created, badRequest, forbidden, notFound, serverError } from '../utils/response.js';
import { logger } from '../utils/logger.js';

const ClientSchema = z.object({
  name:    z.string().min(1).max(200),
  company: z.string().min(1).max(200),
  email:   z.string().email(),
  phone:   z.string().max(30).optional(),
});

export async function getClients(req, res) {
  try {
    const { orgId, role } = req.user;

    // Clients role cannot list all clients
    if (role === 'client') return forbidden(res, 'Access denied');

    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('org_id', orgId)
      .order('name');

    if (error) throw error;
    return ok(res, data);
  } catch (err) {
    logger.error('getClients error', { err: err.message });
    return serverError(res, err.message);
  }
}

export async function createClient(req, res) {
  try {
    const { orgId, id: userId } = req.user;

    const limit = await checkLimit(orgId, 'client');
    if (!limit.allowed) return forbidden(res, limit.reason);

    const data = ClientSchema.parse(req.body);

    // Check duplicate email within org
    const { data: existing } = await supabase
      .from('clients')
      .select('id')
      .eq('org_id', orgId)
      .eq('email', data.email)
      .single();

    if (existing) return badRequest(res, 'A client with this email already exists in your organization');

    const { data: client, error } = await supabase
      .from('clients')
      .insert({ ...data, org_id: orgId })
      .select()
      .single();

    if (error) throw error;
    logger.info('Client created', { clientId: client.id, orgId });
    return created(res, client, 'Client created');
  } catch (err) {
    if (err.name === 'ZodError') return badRequest(res, err.errors.map(e => e.message).join('; '));
    logger.error('createClient error', { err: err.message });
    return serverError(res, err.message);
  }
}

export async function updateClient(req, res) {
  try {
    const { orgId } = req.user;
    const { id } = req.params;

    const data = ClientSchema.partial().parse(req.body);

    // Ensure client belongs to org
    const { data: existing } = await supabase
      .from('clients').select('id').eq('id', id).eq('org_id', orgId).single();
    if (!existing) return notFound(res, 'Client not found');

    const { data: client, error } = await supabase
      .from('clients')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('org_id', orgId)
      .select()
      .single();

    if (error) throw error;
    return ok(res, client, 'Client updated');
  } catch (err) {
    if (err.name === 'ZodError') return badRequest(res, err.errors.map(e => e.message).join('; '));
    logger.error('updateClient error', { err: err.message });
    return serverError(res, err.message);
  }
}

export async function deleteClient(req, res) {
  try {
    const { orgId, role } = req.user;
    const { id } = req.params;

    if (!['admin', 'super_admin'].includes(role)) {
      return forbidden(res, 'Only admins can delete clients');
    }

    const { data: existing } = await supabase
      .from('clients').select('id').eq('id', id).eq('org_id', orgId).single();
    if (!existing) return notFound(res, 'Client not found');

    const { error } = await supabase
      .from('clients').delete().eq('id', id).eq('org_id', orgId);

    if (error) throw error;
    return ok(res, null, 'Client deleted');
  } catch (err) {
    logger.error('deleteClient error', { err: err.message });
    return serverError(res, err.message);
  }
}
