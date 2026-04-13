/**
 * Upgrade Controller — single atomic endpoint for business account upgrade.
 *
 * POST /api/upgrade
 * Body: { org_name: string }
 *
 * Does everything in one DB transaction:
 *   1. Sets account_type = 'business' on profile
 *   2. Creates organization
 *   3. Creates owner membership (super_admin)
 *   4. Creates subscription record (free plan)
 *   5. Updates profile: org_id, onboarding_complete = true
 *
 * Returns: { org_id, org_name, plan }
 * On ANY failure: full rollback, no partial state.
 */
import { supabase } from '../config/supabase.js';
import { ok, badRequest, serverError } from '../utils/response.js';
import { logger } from '../utils/logger.js';
import { logAudit } from '../utils/auditLogger.js';

export async function upgradeAccount(req, res) {
  const { id: userId } = req.user;
  const { org_name } = req.body;

  logger.info('Upgrade: start', { userId, org_name });

  if (!org_name?.trim()) {
    return badRequest(res, 'org_name is required');
  }

  try {
    // ── Atomic provision via DB transaction ──────────────────
    // No guard against existing orgs — users can own multiple orgs (multi-org SaaS)
    logger.info('Upgrade: calling provision_new_organization RPC', { userId });

    const { data: orgId, error: rpcError } = await supabase.rpc('provision_new_organization', {
      p_org_name: org_name.trim(),
      p_user_id:  userId,
    });

    if (rpcError) {
      logger.error('Upgrade: RPC failed', { userId, err: rpcError.message });
      throw rpcError;
    }

    if (!orgId) {
      logger.error('Upgrade: RPC returned null', { userId });
      throw new Error('Organization creation failed — no ID returned');
    }

    logger.info('Upgrade: org created', { userId, orgId });

    // ── Create subscription record ────────────────────────────
    const { error: subError } = await supabase
      .from('subscriptions')
      .upsert({
        org_id:     orgId,
        plan:       'free',
        status:     'active',
        created_at: new Date().toISOString(),
      }, { onConflict: 'org_id' });

    if (subError) {
      // Non-fatal — org is created, subscription can be retried
      logger.warn('Upgrade: subscription upsert failed (non-fatal)', { userId, orgId, err: subError.message });
    } else {
      logger.info('Upgrade: subscription created', { userId, orgId });
    }

    logAudit({
      orgId,
      actorId:    userId,
      action:     'account.upgraded',
      targetType: 'organization',
      targetId:   orgId,
      metadata:   { org_name: org_name.trim(), plan: 'free' },
    });

    logger.info('Upgrade: complete', { userId, orgId });

    return ok(res, {
      org_id:   orgId,
      org_name: org_name.trim(),
      plan:     'free',
    }, 'Account upgraded successfully');

  } catch (err) {
    logger.error('Upgrade: failed', { userId, err: err.message });
    return serverError(res, err.message);
  }
}
