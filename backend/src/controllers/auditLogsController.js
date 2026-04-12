import { supabase } from '../config/supabase.js';
import { ok, badRequest, forbidden, serverError } from '../utils/response.js';
import { logger } from '../utils/logger.js';

export async function getAuditLogs(req, res) {
  try {
    const { orgId, role } = req.user;

    if (!['admin', 'super_admin'].includes(role)) {
      return forbidden(res, 'Audit logs are only accessible to admins');
    }

    // ── Plan-based date range enforcement ─────────────────────
    const AUDIT_DAYS = { free: 1, pro: 3, enterprise: 7 };
    const { data: org } = await supabase.from('organizations').select('plan').eq('id', orgId).single();
    const orgPlan = org?.plan || 'free';
    const maxDays = AUDIT_DAYS[orgPlan] ?? 1;

    const planCutoff = new Date();
    planCutoff.setDate(planCutoff.getDate() - maxDays);
    const planCutoffISO = planCutoff.toISOString();

    const {
      action,
      actor_id,
      from,
      to,
      page = 1,
      limit: rawLimit = 50,
    } = req.query;

    const limit  = Math.min(parseInt(rawLimit) || 50, 200);
    const offset = (Math.max(parseInt(page) || 1, 1) - 1) * limit;

    // Enforce plan cutoff: use the later of planCutoff and user-supplied from
    const effectiveFrom = from && new Date(from) > planCutoff ? from : planCutoffISO;

    let query = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .eq('org_id', orgId)
      .gte('created_at', effectiveFrom)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (action)   query = query.eq('action', action);
    if (actor_id) query = query.eq('actor_id', actor_id);
    if (to)       query = query.lte('created_at', to);

    const { data: logs, error, count } = await query;
    if (error) throw error;

    // Fetch actor profiles manually — no joins
    const actorIds = [...new Set((logs ?? []).map(l => l.actor_id).filter(Boolean))];
    let profileMap = {};
    if (actorIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', actorIds);
      profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]));
    }

    const entries = (logs ?? []).map(row => ({
      id:          row.id,
      org_id:      row.org_id,
      actor_id:    row.actor_id,
      actor_name:  profileMap[row.actor_id]?.name  || 'Unknown',
      actor_email: profileMap[row.actor_id]?.email || '',
      action:      row.action,
      entity:      row.entity    || null,
      entity_id:   row.entity_id || null,
      metadata:    row.metadata  || {},
      created_at:  row.created_at,
    }));

    return ok(res, {
      data: entries,
      total: count ?? 0,
      page: parseInt(page) || 1,
      limit,
      plan: orgPlan,
      max_days: maxDays,
    });
  } catch (err) {
    logger.error('getAuditLogs error', { err: err.message });
    return serverError(res, err.message);
  }
}

export async function writeAuditLog(req, res) {
  try {
    const { id: userId, orgId } = req.user;
    const { action, entity, entityId, metadata = {} } = req.body;

    if (!action) return badRequest(res, 'action is required');

    const { error } = await supabase.from('audit_logs').insert({
      org_id:    orgId    || null,
      actor_id:  userId,
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
