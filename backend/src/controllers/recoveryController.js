/**
 * Platform Owner Recovery Controller
 *
 * Provides a self-healing endpoint for the platform owner to restore
 * their access if something goes wrong with their org membership.
 *
 * Only callable by the platform owner themselves.
 */
import { supabase } from '../config/supabase.js';
import { ok, forbidden, serverError } from '../utils/response.js';
import { logger } from '../utils/logger.js';

export async function recoverPlatformOwnerAccess(req, res) {
  try {
    const { id: userId, isPlatformOwner } = req.user;

    if (!isPlatformOwner) {
      return forbidden(res, 'Only the platform owner can use this endpoint');
    }

    // 1. Ensure role and power_level are correct
    await supabase
      .from('profiles')
      .update({ role: 'super_admin', power_level: 100 })
      .eq('id', userId);

    // 2. Get current org_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', userId)
      .single();

    const orgId = profile?.org_id;

    if (orgId) {
      // 3. Ensure active membership
      await supabase
        .from('memberships')
        .upsert({
          user_id: userId,
          org_id:  orgId,
          role:    'super_admin',
          status:  'active',
        }, { onConflict: 'user_id,org_id' });

      // 4. Ensure org is approved
      await supabase
        .from('organizations')
        .update({ status: 'approved' })
        .eq('id', orgId)
        .neq('status', 'approved');
    }

    logger.info('Platform owner access recovered', { userId, orgId });
    return ok(res, { userId, orgId, role: 'super_admin' }, 'Platform owner access restored');
  } catch (err) {
    logger.error('recoverPlatformOwnerAccess error', { err: err.message });
    return serverError(res, err.message);
  }
}

/**
 * Returns full system health for the platform owner:
 * - Their profile state
 * - Their memberships
 * - Any inconsistencies detected
 */
export async function getPlatformOwnerStatus(req, res) {
  try {
    const { id: userId, isPlatformOwner } = req.user;

    if (!isPlatformOwner) {
      return forbidden(res, 'Platform owner access required');
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, name, email, role, power_level, org_id, is_platform_owner, status')
      .eq('id', userId)
      .single();

    const { data: memberships } = await supabase
      .from('memberships')
      .select('id, org_id, role, status, organizations(name, status)')
      .eq('user_id', userId);

    const issues = [];
    if (profile?.role !== 'super_admin')  issues.push('role is not super_admin');
    if (profile?.power_level !== 100)     issues.push('power_level is not 100');
    if (!profile?.is_platform_owner)      issues.push('is_platform_owner is false');
    if (!profile?.org_id)                 issues.push('no org_id set');

    const activeMembership = memberships?.find(m => m.org_id === profile?.org_id && m.status === 'active');
    if (profile?.org_id && !activeMembership) issues.push('no active membership for current org');

    return ok(res, { profile, memberships: memberships ?? [], issues });
  } catch (err) {
    logger.error('getPlatformOwnerStatus error', { err: err.message });
    return serverError(res, err.message);
  }
}
