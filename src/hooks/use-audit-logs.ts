import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
  const limit  = filters.limit ?? 50;
  const page   = filters.page  ?? 1;
  const offset = (page - 1) * limit;

  return useQuery({
    queryKey: ['audit-logs', orgId, filters],
    queryFn: async () => {
      if (!orgId) return { data: [], total: 0, page, limit };

      // Fetch audit logs without join first
      let query = (supabase as any)
        .from('audit_logs')
        .select('*', { count: 'exact' })
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (filters.action)  query = query.eq('action', filters.action);
      if (filters.actorId) query = query.eq('actor_id', filters.actorId);
      if (filters.from)    query = query.gte('created_at', filters.from);
      if (filters.to)      query = query.lte('created_at', filters.to);

      const { data, error, count } = await query;

      if (error) {
        console.error('Audit logs fetch error:', error.message, error);
        return { data: [], total: 0, page, limit };
      }

      const rows = data || [];

      // Fetch actor profiles separately
      const actorIds = [...new Set(rows.map((r: any) => r.actor_id).filter(Boolean))] as string[];
      let profileMap: Record<string, { name: string; email: string }> = {};
      if (actorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, email')
          .in('id', actorIds);
        profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.id, p]));
      }

      const entries: AuditLogEntry[] = rows.map((row: any) => ({
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

      return { data: entries, total: count ?? 0, page, limit };
    },
    enabled: !!orgId,
    placeholderData: (prev) => prev,
  });
}
