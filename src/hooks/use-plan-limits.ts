import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface PlanLimits {
  max_clients: number;
  max_projects: number;
  max_team_members: number;
  max_invoices_per_month: number;
  file_upload: boolean;
}

export const FREE_LIMITS: PlanLimits = {
  max_clients: 5,
  max_projects: 3,
  max_team_members: 4,
  max_invoices_per_month: 3,
  file_upload: false,
};

export function usePlanLimits() {
  const { orgId } = useAuth();

  const { data: limits } = useQuery({
    queryKey: ['plan_limits', orgId],
    queryFn: async (): Promise<PlanLimits> => {
      if (!orgId) return FREE_LIMITS;
      const { data, error } = await supabase.rpc('get_org_limits', { p_org_id: orgId });
      if (error) return FREE_LIMITS;
      return (data as any) ?? FREE_LIMITS;
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000, // 5 min cache
  });

  // Current usage counts
  const { data: usage } = useQuery({
    queryKey: ['plan_usage', orgId],
    queryFn: async () => {
      if (!orgId) return { clients: 0, projects: 0, team: 0, invoices: 0 };

      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const [clientsRes, projectsRes, teamRes, invoicesRes] = await Promise.all([
        supabase.from('clients').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
        supabase.from('projects').select('id', { count: 'exact', head: true }).eq('org_id', orgId).neq('status', 'cancelled'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('org_id', orgId).neq('role', 'inactive'),
        supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('org_id', orgId).gte('created_at', monthStart.toISOString()),
      ]);

      return {
        clients:  clientsRes.count  ?? 0,
        projects: projectsRes.count ?? 0,
        team:     teamRes.count     ?? 0,
        invoices: invoicesRes.count ?? 0,
      };
    },
    enabled: !!orgId,
  });

  const resolvedLimits = limits ?? FREE_LIMITS;
  const resolvedUsage  = usage  ?? { clients: 0, projects: 0, team: 0, invoices: 0 };

  return {
    limits: resolvedLimits,
    usage: resolvedUsage,
    canCreateClient:  resolvedUsage.clients  < resolvedLimits.max_clients,
    canCreateProject: resolvedUsage.projects < resolvedLimits.max_projects,
    canAddTeamMember: resolvedUsage.team     < resolvedLimits.max_team_members,
    canCreateInvoice: resolvedUsage.invoices < resolvedLimits.max_invoices_per_month,
    canUploadFile:    resolvedLimits.file_upload === true,
  };
}
