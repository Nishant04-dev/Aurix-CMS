import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/apiClient';
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

interface PlanLimitsResponse {
  limits: PlanLimits;
  usage: { clients: number; projects: number; team: number; invoices: number };
}

export function usePlanLimits() {
  const { orgId } = useAuth();

  const { data } = useQuery({
    queryKey: ['plan_limits', orgId],
    queryFn: () => api.get<PlanLimitsResponse>('/plan/limits'),
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  });

  const resolvedLimits = data?.limits ?? FREE_LIMITS;
  const resolvedUsage  = data?.usage  ?? { clients: 0, projects: 0, team: 0, invoices: 0 };

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
