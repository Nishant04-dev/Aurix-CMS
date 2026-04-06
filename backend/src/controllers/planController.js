import { supabase } from '../config/supabase.js';
import { ok, serverError } from '../utils/response.js';
import { logger } from '../utils/logger.js';

export async function getPlanLimits(req, res) {
  try {
    const { orgId } = req.user;
    if (!orgId) return ok(res, { limits: defaultLimits(), usage: defaultUsage() });

    const { data: limits, error } = await supabase.rpc('get_org_limits', { p_org_id: orgId });
    if (error) throw error;

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [clientsRes, projectsRes, teamRes, invoicesRes] = await Promise.all([
      supabase.from('clients').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
      supabase.from('projects').select('id', { count: 'exact', head: true }).eq('org_id', orgId).neq('status', 'cancelled'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('org_id', orgId).neq('role', 'inactive'),
      supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('org_id', orgId).gte('created_at', monthStart.toISOString()),
    ]);

    return ok(res, {
      limits: limits ?? defaultLimits(),
      usage: {
        clients:  clientsRes.count  ?? 0,
        projects: projectsRes.count ?? 0,
        team:     teamRes.count     ?? 0,
        invoices: invoicesRes.count ?? 0,
      },
    });
  } catch (err) {
    logger.error('getPlanLimits error', { err: err.message });
    return serverError(res, err.message);
  }
}

export async function getPlans(req, res) {
  try {
    const { data, error } = await supabase.from('plans').select('*').order('price_usd');
    if (error) throw error;
    return ok(res, data ?? []);
  } catch (err) {
    logger.error('getPlans error', { err: err.message });
    return serverError(res, err.message);
  }
}

function defaultLimits() {
  return { file_upload: false, max_clients: 5, max_projects: 3, max_team_members: 4, max_invoices_per_month: 3 };
}
function defaultUsage() {
  return { clients: 0, projects: 0, team: 0, invoices: 0 };
}
