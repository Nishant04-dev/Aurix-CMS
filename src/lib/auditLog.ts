import { supabase } from '@/integrations/supabase/client';

export interface AuditLogParams {
  orgId?: string | null;
  userId?: string | null;
  action: string;
  entity?: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Fire-and-forget audit logger.
 * Never throws — errors are swallowed so they never break the calling flow.
 */
export async function logAudit({
  orgId,
  userId,
  action,
  entity,
  entityId,
  metadata = {},
}: AuditLogParams): Promise<void> {
  try {
    await (supabase as any).from('audit_logs').insert({
      org_id:    orgId    || null,
      actor_id:  userId   || null,
      user_id:   userId   || null,
      action,
      entity:    entity   || null,
      entity_id: entityId || null,
      metadata,
    });
  } catch (err) {
    console.warn('[auditLog] Failed to write audit log:', action, err);
  }
}
