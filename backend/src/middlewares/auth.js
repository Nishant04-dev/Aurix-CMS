import { supabase } from '../config/supabase.js';
import { unauthorized, forbidden } from '../utils/response.js';
import { logger } from '../utils/logger.js';
import { normalizeRole, ROLE_POWER } from '../config/accessControl.js';

export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return unauthorized(res, 'Missing or invalid Authorization header');
    }

    const token = authHeader.replace('Bearer ', '').trim();

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return unauthorized(res, 'Invalid or expired token');
    }

    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, email, name, role, role_id, org_id, power_level, is_platform_owner, display_id, account_type, onboarding_complete, status')
      .eq('id', user.id)
      .single();

    if (profileErr || !profile) {
      return unauthorized(res, 'User profile not found');
    }

    if (!profile.is_platform_owner && (profile.status === 'banned' || profile.status === 'disabled')) {
      return unauthorized(res, 'Your account has been suspended');
    }

    // ── PLATFORM OWNER ────────────────────────────────────────
    if (profile.is_platform_owner) {
      // Source of truth: memberships table.
      // Priority order:
      //   1. Active membership in profile.org_id — but ONLY if that org is approved/pending
      //      AND the membership role is super_admin/admin (not a stale low-power membership)
      //   2. Active super_admin membership in any approved org (most recently updated)
      //   3. Any active membership in an approved org
      //   4. Owned org as last resort (auto-create membership)
      let orgId = null;

      // Fetch all active memberships with org status in one query
      const { data: allMems } = await supabase
        .from('memberships')
        .select('id, org_id, role, updated_at, organizations!inner(id, status)')
        .eq('user_id', profile.id)
        .eq('status', 'active')
        .in('organizations.status', ['approved', 'pending'])
        .order('updated_at', { ascending: false });

      if (allMems?.length) {
        const withPower = allMems.map(m => ({ ...m, power: ROLE_POWER[m.role?.toLowerCase()] ?? 10 }));

        // Prefer profile.org_id if it has a high-power role (admin+)
        const preferred = profile.org_id
          ? withPower.find(m => m.org_id === profile.org_id && m.power >= 90)
          : null;

        if (preferred) {
          orgId = preferred.org_id;
        } else {
          // Pick highest-power membership, tie-break by most recently updated
          withPower.sort((a, b) => b.power - a.power || new Date(b.updated_at) - new Date(a.updated_at));
          orgId = withPower[0].org_id;
        }
      }

      // Last resort: owned org (and ensure membership exists)
      if (!orgId) {
        const { data: ownedOrg } = await supabase
          .from('organizations')
          .select('id')
          .eq('owner_id', profile.id)
          .in('status', ['approved', 'pending'])
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        if (ownedOrg) {
          orgId = ownedOrg.id;
          await supabase.from('memberships')
            .upsert({ user_id: profile.id, org_id: orgId, role: 'super_admin', status: 'active' }, { onConflict: 'user_id,org_id' });
          logger.info('Platform owner org_id restored via owned org', { userId: profile.id, orgId });
        }
      }

      // Sync profile.org_id if it's stale
      if (orgId && orgId !== profile.org_id) {
        supabase.from('profiles').update({ org_id: orgId }).eq('id', profile.id)
          .then(({ error }) => {
            if (error) logger.warn('Auth: failed to sync platform owner profile.org_id', { err: error.message });
            else logger.info('Auth: platform owner profile.org_id synced', { userId: profile.id, orgId });
          });
      }

      logger.debug('Auth: platform owner org resolved', {
        userId: profile.id,
        resolvedOrgId: orgId,
        profileOrgId: profile.org_id,
      });

      req.user = {
        id:                 profile.id,
        email:              profile.email || user.email,
        name:               profile.name,
        role:               'super_admin',
        roleId:             profile.role_id || null,
        orgId,
        powerLevel:         100,
        isPlatformOwner:    true,
        displayId:          profile.display_id,
        accountType:        profile.account_type || 'business',
        onboardingComplete: true,
        membershipId:       null,
      };
      return next();
    }

    // ── REGULAR USER ──────────────────────────────────────────
    // memberships is the SOLE source of truth for org_id.
    // profile.org_id is only used as a hint to prefer a specific org when the
    // user has multiple active memberships (e.g. after switchOrganization).
    let resolvedOrgId  = null;
    let resolvedRole   = profile.role   || 'client';
    let resolvedPower  = profile.power_level || 10;
    let membershipId   = null;

    // 1. Try to find an active membership matching profile.org_id (preferred org)
    if (profile.org_id) {
      const { data: preferred, error: prefErr } = await supabase
        .from('memberships')
        .select('id, org_id, role')
        .eq('user_id', profile.id)
        .eq('org_id', profile.org_id)
        .eq('status', 'active')
        .maybeSingle();

      if (prefErr) {
        logger.warn('Auth: preferred membership query failed', { err: prefErr.message, userId: profile.id });
      } else if (preferred) {
        resolvedOrgId = preferred.org_id;
        membershipId  = preferred.id;
        resolvedRole  = preferred.role || resolvedRole;
        logger.debug('Auth: org resolved from preferred membership', {
          userId: profile.id,
          membershipOrgId: preferred.org_id,
          profileOrgId: profile.org_id,
          role: resolvedRole,
        });
      }
    }

    // 2. If no preferred membership, fall back to most recent active membership
    if (!resolvedOrgId) {
      const { data: fallback, error: fallbackErr } = await supabase
        .from('memberships')
        .select('id, org_id, role')
        .eq('user_id', profile.id)
        .eq('status', 'active')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fallbackErr) {
        logger.warn('Auth: fallback membership query failed', { err: fallbackErr.message, userId: profile.id });
      } else if (fallback) {
        resolvedOrgId = fallback.org_id;
        membershipId  = fallback.id;
        resolvedRole  = fallback.role || resolvedRole;
        logger.info('Auth: org resolved from fallback membership (profile.org_id was stale/null)', {
          userId: profile.id,
          membershipOrgId: fallback.org_id,
          profileOrgId: profile.org_id,
          role: resolvedRole,
        });
        // Sync profile.org_id to match actual membership (best-effort, non-blocking)
        supabase.from('profiles').update({ org_id: fallback.org_id }).eq('id', profile.id)
          .then(({ error }) => {
            if (error) logger.warn('Auth: failed to sync profile.org_id', { err: error.message, userId: profile.id });
          });
      } else {
        logger.info('Auth: no active membership found for user', {
          userId: profile.id,
          profileOrgId: profile.org_id,
        });
      }
    }

    req.user = {
      id:                 profile.id,
      email:              profile.email || user.email,
      name:               profile.name,
      role:               resolvedRole,
      roleId:             profile.role_id || null,
      orgId:              resolvedOrgId,
      powerLevel:         resolvedPower,
      isPlatformOwner:    false,
      displayId:          profile.display_id,
      accountType:        profile.account_type || 'user',
      onboardingComplete: profile.onboarding_complete || false,
      membershipId,
    };

    next();
  } catch (err) {
    logger.error('Auth middleware error', { err: err.message });
    return unauthorized(res, 'Authentication failed');
  }
}

/**
 * Require active org membership.
 * Since authenticate already verified membership, this is a fast guard.
 */
export function requireOrg(req, res, next) {
  if (req.user?.isPlatformOwner) return next();
  if (!req.user?.orgId) {
    return forbidden(res, 'You must belong to an organization to perform this action');
  }
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (req.user?.isPlatformOwner) return next();
    const userRole = req.user?.role;
    const normalized = normalizeRole(userRole);
    // Accept both the raw role and the normalized canonical role
    if (roles.includes(userRole) || roles.includes(normalized)) return next();
    return forbidden(res, `Required role: ${roles.join(' or ')}`);
  };
}

/**
 * Require platform owner access.
 * Primary: isPlatformOwner flag set during authenticate() via is_platform_owner profile column.
 * Secondary: platform_user_roles table with 'Owner' role (for delegated platform admins).
 */
export async function requirePlatformOwner(req, res, next) {
  // Fast path — already resolved during authenticate()
  if (req.user?.isPlatformOwner) return next();

  // Secondary: check platform_user_roles table (delegated platform admins)
  try {
    const { data: userRole } = await supabase
      .from('platform_user_roles')
      .select('role_id')
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (userRole?.role_id) {
      const { data: role } = await supabase
        .from('platform_roles')
        .select('name')
        .eq('id', userRole.role_id)
        .maybeSingle();

      if (role?.name?.toLowerCase() === 'owner') {
        req.user.isPlatformOwner = true;
        return next();
      }
    }

    // Tertiary: re-check is_platform_owner directly from DB (handles stale req.user)
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_platform_owner')
      .eq('id', req.user.id)
      .maybeSingle();

    if (profile?.is_platform_owner === true) {
      req.user.isPlatformOwner = true;
      logger.info('requirePlatformOwner: granted via is_platform_owner profile flag', { userId: req.user.id });
      return next();
    }
  } catch (err) {
    logger.warn('requirePlatformOwner check failed', { err: err.message });
  }

  return forbidden(res, 'Platform owner access required');
}

/**
 * RBAC permission check.
 * Uses role_id from req.user (set during authenticate) to avoid extra DB call.
 */
export function requirePermission(permKey) {
  return async (req, res, next) => {
    try {
      const { roleId, role, isPlatformOwner, orgId, id: userId } = req.user;

      if (isPlatformOwner || role === 'super_admin' || role === 'admin') return next();
      // Also pass normalized role (manager/developer/support → member doesn't get auto-pass here)
      const normalized = normalizeRole(role);
      if (normalized === 'super_admin' || normalized === 'admin') return next();

      if (!roleId) {
        return forbidden(res, `Permission denied: ${permKey}`);
      }

      const { data: perm } = await supabase
        .from('role_permissions')
        .select('id')
        .eq('role_id', roleId)
        .eq('permission_key', permKey)
        .maybeSingle();

      if (!perm) {
        logger.warn('Permission denied', { userId, permKey, orgId });
        return forbidden(res, `Permission denied: ${permKey}`);
      }

      next();
    } catch (err) {
      logger.error('requirePermission error', { err: err.message });
      return forbidden(res, 'Permission check failed');
    }
  };
}
