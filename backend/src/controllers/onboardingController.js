import { supabase } from '../config/supabase.js';
import { ok, badRequest, serverError } from '../utils/response.js';
import { logger } from '../utils/logger.js';
import { logAudit } from '../utils/auditLogger.js';

/**
 * Atomically provision a new organization for the current user.
 * Uses a DB-level transaction (provision_new_organization RPC) so that
 * org creation, membership assignment, and profile update are all-or-nothing.
 */
export async function provisionOrganization(req, res) {
  const { id: userId } = req.user;
  const { org_name } = req.body;

  if (!org_name?.trim()) return badRequest(res, 'org_name is required');

  logger.info('Onboarding: provision start', { userId, org_name: org_name.trim() });

  try {
    // No guard against existing orgs — users can own/belong to multiple orgs
    // Atomic: create org + membership + update profile in one DB transaction
    const { data: orgId, error } = await supabase.rpc('provision_new_organization', {
      p_org_name: org_name.trim(),
      p_user_id:  userId,
    });

    if (error) {
      logger.error('Onboarding: provision_new_organization RPC failed', { userId, err: error.message });
      throw error;
    }

    if (!orgId) {
      logger.error('Onboarding: RPC returned null org_id', { userId });
      throw new Error('Organization creation failed — no ID returned');
    }

    logger.info('Onboarding: org provisioned successfully', { userId, orgId });

    logAudit({
      orgId,
      actorId: userId,
      action:  'org.provisioned',
      targetType: 'organization',
      targetId:   orgId,
      metadata: { org_name: org_name.trim() },
    });

    return ok(res, { org_id: orgId }, 'Organization created');
  } catch (err) {
    logger.error('Onboarding: provision failed', { userId, err: err.message });
    return serverError(res, err.message);
  }
}
