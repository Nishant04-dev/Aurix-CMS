import { supabase } from '../config/supabase.js';

/**
 * Check if a user has a specific permission in their org
 */
export async function userHasPermission(userId, permKey) {
  const { data } = await supabase.rpc('platform_can', { perm_key: permKey });
  // Fallback: check via role_permissions
  const { data: perms } = await supabase
    .from('role_permissions')
    .select('permission_key')
    .eq('permission_key', permKey)
    .in('role_id', await getUserRoleIds(userId));

  return (perms?.length ?? 0) > 0;
}

async function getUserRoleIds(userId) {
  const { data } = await supabase
    .from('profiles')
    .select('role_id')
    .eq('id', userId)
    .single();
  return data?.role_id ? [data.role_id] : [];
}

/**
 * Get org plan limits
 */
export async function getOrgLimits(orgId) {
  const { data } = await supabase.rpc('get_org_limits', { p_org_id: orgId });
  return data || {
    max_clients: 5,
    max_projects: 3,
    max_team_members: 4,
    max_invoices_per_month: 3,
    file_upload: false,
  };
}

/**
 * Count current usage for a resource
 */
export async function getOrgUsage(orgId) {
  const monthStart = new Date();
  monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

  const [clients, projects, team, invoices] = await Promise.all([
    supabase.from('clients').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
    supabase.from('projects').select('id', { count: 'exact', head: true }).eq('org_id', orgId).neq('status', 'cancelled'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('org_id', orgId).neq('role', 'inactive'),
    supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('org_id', orgId).gte('created_at', monthStart.toISOString()),
  ]);

  return {
    clients:  clients.count  ?? 0,
    projects: projects.count ?? 0,
    team:     team.count     ?? 0,
    invoices: invoices.count ?? 0,
  };
}

/**
 * Validate org limit before creating a resource
 * Returns { allowed: boolean, reason?: string }
 */
export async function checkLimit(orgId, resource) {
  const [limits, usage] = await Promise.all([getOrgLimits(orgId), getOrgUsage(orgId)]);

  const checks = {
    project:  { current: usage.projects, max: limits.max_projects,              label: 'projects' },
    client:   { current: usage.clients,  max: limits.max_clients,               label: 'clients' },
    team:     { current: usage.team,     max: limits.max_team_members,          label: 'team members' },
    invoice:  { current: usage.invoices, max: limits.max_invoices_per_month,    label: 'invoices this month' },
    file:     { current: 0,              max: limits.file_upload ? 999 : 0,     label: 'file uploads' },
  };

  const check = checks[resource];
  if (!check) return { allowed: true };

  if (check.current >= check.max) {
    return {
      allowed: false,
      reason: `Plan limit reached: ${check.current}/${check.max} ${check.label}. Upgrade your plan.`,
    };
  }

  return { allowed: true };
}
