/**
 * Fire-and-forget audit logger.
 * Sends to backend which writes via service role — never directly to DB.
 */
import { api } from '@/lib/apiClient';

export interface AuditLogParams {
  orgId?: string | null;
  userId?: string | null;
  action: string;
  entity?: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

export async function logAudit(params: AuditLogParams): Promise<void> {
  try {
    await api.post('/audit-logs', params);
  } catch (err) {
    console.warn('[auditLog] Failed to write audit log:', params.action, err);
  }
}
