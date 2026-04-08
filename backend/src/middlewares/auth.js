import { supabase } from '../config/supabase.js';
import { unauthorized, forbidden } from '../utils/response.js';
import { logger } from '../utils/logger.js';

/**
 * Verify Supabase JWT, fetch profile + resolve org membership.
 *
 * RESILIENCE RULES:
 * - Platform owner ALWAYS gets super_admin + full access, regardless of DB state
 * - If memberships table doesn't exist, fall back to profiles.org_id
 * - Never block a valid JWT due to membership table issues
 */
export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return unauthorized(res, 'Missing or invalid Authorization header');
    }

    const token = authHeader.replace('Bearer ', '').trim();

    // Verify JWT with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return unauthorized(res, 'Invalid or expired token');
    }

    // Fetch full profile
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, email, name, role, org_id, power_level, is_platform_owner, display_id, account_type, onboarding_complete, status')
      .eq('id', user.id)
      .single();

    if (profileErr || !profile) {
      return unauthorized(res, 'User profile not found');
    }

    // Block banned/disabled accounts (never block platform owner)
    if (!profile.is_platform_owner && (profile.status === 'banned' || profile.status === 'disabled')) {
      return unauthorized(res, 'Your account has been suspended');
    }

    // ── PLATFORM OWNER: hardcoded full access, no membership check needed ──
    if (profile.is_platform_owner) {
      // Self-heal: if org_id is missing, try to find their org
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
          // Restore org_id on profile
          await supabase.from('profiles').update({ org_id: orgId }).eq('id', profile.id);
          logger.info('Platform owner org_id restored', { userId: profile.id, orgId });
        }
      }

      // Ensure membership exists (best-effort, non-blocking)
      if (orgId) {
        supabase.from('memberships')
          .upsert({ user_id: profile.id, org_id: orgId, role: 'super_admin', status: 'active' }, { onConflict: 'user_id,org_id' })
          .then(() => {})
          .catch(() => {}); // non-blocking, memberships table may not exist yet
      }

      req.user = {
        id:                 profile.id,
        email:              profile.email || user.email,
        name:               profile.name,
        role:               'super_admin',
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

    // ── REGULAR USER: resolve org + membership ──
    let resolvedOrgId  = profile.org_id;
    let resolvedRole   = profile.role   || 'client';
    let resolvedPower  = profile.power_level || 10;
    let membershipId   = null;

    if (resolvedOrgId) {
      try {
        const { data: membership } = await supabase
          .from('memberships')
          .select('id, role')
          .eq('user_id', profile.id)
          .eq('org_id', resolvedOrgId)
          .eq('status', 'active')
          .maybeSingle();

        if (membership) {
          membershipId = membership.id;
          resolvedRole = membership.role || resolvedRole;
        } else {
          // Auto-repair: create missing membership (non-blocking)
          supabase.from('memberships')
            .upsert({ user_id: profile.id, org_id: resolvedOrgId, role: resolvedRole, status: 'active' }, { onConflict: 'user_id,org_id' })
            .select('id').single()
            .then(({ data }) => { if (data) membershipId = data.id; })
            .catch(() => {}); // non-blocking
        }
      } catch (membershipErr) {
        // memberships table may not exist yet — fall back gracefully
        logger.warn('Memberships table query failed, falling back to profile', { err: membershipErr.message });
      }
    }

    req.user = {
      id:                 profile.id,
      email:              profile.email || user.email,
      name:               profile.name,
      role:               resolvedRole,
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
 * Require org membership.
 * Platform owners always bypass this.
 */
export function requireOrg(req, res, next) {
  if (req.user?.isPlatformOwner) return next();
  if (!req.user?.orgId) {
    return forbidden(res, 'You must belong to an organization to perform this action');
  }
  next();
}

/**
 * Require specific roles.
 * Platform owners always bypass this.
 */
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
 * Checks both is_platform_owner flag AND platform_user_roles table as fallback.
 */
export async function requirePlatformOwner(req, res, next) {
  if (req.user?.isPlatformOwner) return next();

  // Fallback: check platform_user_roles table directly
  try {
    const { data: userRole } = await supabase
      .from('platform_user_roles')
      .select('role_id, platform_roles(name)')
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (userRole) {
      const roleName = userRole.platform_roles?.name;
      if (roleName === 'Owner') {
        // Patch req.user so downstream checks pass
        req.user.isPlatformOwner = true;
        return next();
      }
    }
  } catch (err) {
    logger.warn('requirePlatformOwner fallback check failed', { err: err.message });
  }

  return forbidden(res, 'Platform owner access required');
}

/**
 * RBAC: require a specific permission key.
 * Platform owners and super_admins bypass all permission checks.
 */
export function requirePermission(permKey) {
  return async (req, res, next) => {
    try {
      const { id: userId, role, isPlatformOwner, orgId } = req.user;

      // Platform owner / super_admin bypass
      if (isPlatformOwner || role === 'super_admin') return next();

      // Fetch role_id from profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('role_id')
        .eq('id', userId)
        .single();

      if (!profile?.role_id) {
        return forbidden(res, `Permission denied: ${permKey}`);
      }

      // Check role_permissions table
      const { data: perm } = await supabase
        .from('role_permissions')
        .select('id')
        .eq('role_id', profile.role_id)
        .eq('permission_key', permKey)
        .single();

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
