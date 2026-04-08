import { supabase } from '../config/supabase.js';
import { logger } from './logger.js';

/**
 * Fire-and-forget audit log writer.
 * Maps to actual audit_logs columns: actor_id, action, entity, entity_id, target_id, org_id, metadata
 *
 * @param {object} params
 * @param {string} params.orgId
 * @param {string} params.actorId
 * @param {string} params.action       - e.g. 'project.created', 'invite.sent'
 * @param {string} [params.targetType] - maps to entity column
 * @param {string} [params.targetId]   - maps to entity_id column
 * @param {object} [params.metadata]
 */
export async function logAudit({ orgId, actorId, action, targetType, targetId, metadata = {} }) {
  try {
    const { error } = await supabase.from('audit_logs').insert({
      org_id:    orgId    || null,
      actor_id:  actorId  || null,
      action,
      entity:    targetType || null,
      entity_id: targetId   || null,
      metadata,
    });
    if (error) {
      logger.warn('logAudit insert failed', { error: error.message, action, orgId });
    }
  } catch (err) {
    logger.warn('logAudit exception', { err: err.message, action, orgId });
  }
}
