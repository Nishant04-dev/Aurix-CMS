import { supabase } from '../config/supabase.js';
import { ok, forbidden, serverError } from '../utils/response.js';
import { logger } from '../utils/logger.js';

export async function getAuditLogs(req, res) {
  try {
    const { id: userId, orgId, role } = req.user;

    if (!['admin', 'super_admin'].includes(role)) {
      return forbidden(res, 'Audit logs are only accessible to admins');
    }

    const {
      action,
      actor_id,
      from,
      to,
      page = 1,
      limit: rawLimit = 50,
    } = req.query;

    const limit = Math.min(parseInt(rawLimit) || 50, 200);
    const offset = (Math.max(parseInt(page) || 1, 1) - 1) * limit;

    let query = supabase
      .from('audit_logs')
      .select('*, profiles!audit_logs_actor_id_fkey(name, email)', { count: 'exact' })
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (action)   query = query.eq('action', action);
    if (actor_id) query = query.eq('actor_id', actor_id);
    if (from)     query = query.gte('created_at', from);
    if (to)       query = query.lte('created_at', to);

    const { data, error, count } = await query;
    if (error) throw error;

    const entries = (data || []).map(row => ({
      id:          row.id,
      org_id:      row.org_id,
      actor_id:    row.actor_id,
      actor_name:  row.profiles?.name || 'Unknown',
      actor_email: row.profiles?.email || '',
      action:      row.action,
      target_type: row.target_type,
      target_id:   row.target_id,
      metadata:    row.metadata,
      created_at:  row.created_at,
    }));

    return ok(res, { data: entries, total: count ?? 0, page: parseInt(page) || 1, limit });
  } catch (err) {
    logger.error('getAuditLogs error', { err: err.message });
    return serverError(res, err.message);
  }
}

export async function writeAuditLog(req, res) {
  try {
    const { id: userId, orgId } = req.user;
    const { action, entity, entityId, metadata = {} } = req.body;

    if (!action) return (await import('../utils/response.js')).badRequest(res, 'action is required');

    const { error } = await supabase.from('audit_logs').insert({
      org_id:    orgId    || null,
      actor_id:  userId,
      user_id:   userId,
      action,
      entity:    entity   || null,
      entity_id: entityId || null,
      metadata,
    });

    if (error) throw error;
    return ok(res, null, 'Audit log written');
  } catch (err) {
    logger.error('writeAuditLog error', { err: err.message });
    return serverError(res, err.message);
  }
}
