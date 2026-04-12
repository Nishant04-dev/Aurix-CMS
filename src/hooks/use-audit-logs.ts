import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';

export interface AuditLogEntry {
  id: string;
  org_id: string;
  actor_id: string | null;
  actor_name: string;
  actor_email: string;
  action: string;
  entity: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AuditFilters {
  action?: string;
  actorId?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export function useAuditLogs(filters: AuditFilters = {}) {
  const { orgId } = useAuth();

  return useQuery({
    queryKey: ['audit-logs', orgId, filters],
    queryFn: () =>
      api.get<{ data: AuditLogEntry[]; total: number; page: number; limit: number; plan: string; max_days: number }>(
        '/audit-logs',
        {
          action:  filters.action,
          actorId: filters.actorId,
          from:    filters.from,
          to:      filters.to,
          page:    filters.page ?? 1,
          limit:   filters.limit ?? 50,
        },
      ),
    enabled: !!orgId,
    placeholderData: (prev) => prev,
  });
}
