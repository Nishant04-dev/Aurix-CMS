import { supabase } from '../config/supabase.js';
import { unauthorized, forbidden } from '../utils/response.js';
import { logger } from '../utils/logger.js';

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
      let orgId = profile.org_id;
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
          await supabase.from('profiles').update({ org_id: orgId }).eq('id', profile.id);
          logger.info('Platform owner org_id restored', { userId: profile.id, orgId });
        }
      }

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
    let resolvedOrgId  = profile.org_id;
    let resolvedRole   = profile.role   || 'client';
    let resolvedPower  = profile.power_level || 10;
    let membershipId   = null;

    if (resolvedOrgId) {
      const { data: membership, error: memErr } = await supabase
        .from('memberships')
        .select('id, role')
        .eq('user_id', profile.id)
        .eq('org_id', resolvedOrgId)
        .eq('status', 'active')
        .maybeSingle();

      if (memErr) {
        logger.warn('Memberships query failed during auth', { err: memErr.message });
        // If we can't verify membership, clear org access — fail secure
        resolvedOrgId = null;
      } else if (membership) {
        membershipId = membership.id;
        resolvedRole = membership.role || resolvedRole;
      } else {
        // No active membership found — clear org access
        // Do NOT auto-repair: removed/banned users must not regain access silently
        resolvedOrgId = null;
        logger.info('No active membership found, clearing org access', { userId: profile.id });
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
    if (!roles.includes(req.user?.role)) {
      return forbidden(res, `Required role: ${roles.join(' or ')}`);
    }
    next();
  };
}

/**
 * Require platform owner access.
 * Uses manual two-step fetch to avoid implicit join issues.
 */
export async function requirePlatformOwner(req, res, next) {
  if (req.user?.isPlatformOwner) return next();

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

      if (role?.name === 'Owner') {
        req.user.isPlatformOwner = true;
        return next();
      }
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
