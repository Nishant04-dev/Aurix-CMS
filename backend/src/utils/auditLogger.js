import { supabase } from '../config/supabase.js';
import { logger } from './logger.js';

/**
 * Fire-and-forget audit log writer.
 * Never throws — errors are swallowed so they never break the calling controller.
 *
 * @param {object} params
 * @param {string} params.orgId
 * @param {string} params.actorId
 * @param {string} params.action  - e.g. 'member.removed', 'invite.sent'
 * @param {string} params.targetType - 'user' | 'org' | 'invitation' | 'role' | 'channel'
 * @param {string} [params.targetId]
 * @param {object} [params.metadata]
 */
export async function logAudit({ orgId, actorId, action, targetType, targetId, metadata = {} }) {
  try {
    const { error } = await supabase.from('audit_logs').insert({
      org_id:      orgId,
      actor_id:    actorId,
      action,
      target_type: targetType,
      target_id:   targetId || null,
      metadata,
    });
    if (error) {
      logger.warn('logAudit insert failed', { error: error.message, action, orgId });
    }
  } catch (err) {
    logger.warn('logAudit exception', { err: err.message, action, orgId });
  }
}
