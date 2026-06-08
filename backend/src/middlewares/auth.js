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
    // SIMPLIFIED: Platform owner status is PERMANENT and UNCONDITIONAL
    if (profile.is_platform_owner) {
      // ALWAYS trust profile.org_id for platform owner
      let orgId = profile.org_id;

      // Only fall back if profile.org_id is null
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
          // Ensure membership exists
          await supabase.from('memberships')
            .upsert({ user_id: profile.id, org_id: orgId, role: 'super_admin', status: 'active' }, 
                    { onConflict: 'user_id,org_id' });
          // Sync profile.org_id
          await supabase.from('profiles').update({ org_id: orgId }).eq('id', profile.id);
          logger.info('Platform owner org_id restored', { userId: profile.id, orgId });
        }
      }

      // Platform owner ALWAYS has super_admin role, regardless of org
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
    // memberships.role is the SOLE source of truth
    // profile.org_id is used as a hint to prefer a specific org
    let resolvedOrgId  = null;
    let resolvedRole   = 'client';
    let resolvedPower  = 10;
    let membershipId   = null;
    let resolvedRoleId = null;

    // 1. Try to find active membership matching profile.org_id (preferred org)
    if (profile.org_id) {
      const { data: preferred, error: prefErr } = await supabase
        .from('memberships')
        .select('id, org_id, role, role_id')
        .eq('user_id', profile.id)
        .eq('org_id', profile.org_id)
        .eq('status', 'active')
        .maybeSingle();

      if (prefErr) {
        logger.warn('Auth: preferred membership query failed', { err: prefErr.message, userId: profile.id });
      } else if (preferred) {
        resolvedOrgId  = preferred.org_id;
        membershipId   = preferred.id;
        resolvedRole   = preferred.role || 'client';
        resolvedRoleId = preferred.role_id;
        resolvedPower  = ROLE_POWER[resolvedRole?.toLowerCase()] ?? 10;
        logger.debug('Auth: org resolved from preferred membership', {
          userId: profile.id, org: preferred.org_id, role: resolvedRole,
        });
      }
    }

    // 2. Fall back to most recent active membership
    if (!resolvedOrgId) {
      const { data: fallback, error: fallbackErr } = await supabase
        .from('memberships')
        .select('id, org_id, role, role_id')
        .eq('user_id', profile.id)
        .eq('status', 'active')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fallbackErr) {
        logger.warn('Auth: fallback membership query failed', { err: fallbackErr.message, userId: profile.id });
      } else if (fallback) {
        resolvedOrgId  = fallback.org_id;
        membershipId   = fallback.id;
        resolvedRole   = fallback.role || 'client';
        resolvedRoleId = fallback.role_id;
        resolvedPower  = ROLE_POWER[resolvedRole?.toLowerCase()] ?? 10;
        logger.info('Auth: org resolved from fallback membership', {
          userId: profile.id, org: fallback.org_id, role: resolvedRole,
        });
        // Sync profile.org_id (best-effort, non-blocking)
        supabase.from('profiles').update({ org_id: fallback.org_id }).eq('id', profile.id)
          .then(({ error }) => {
            if (error) logger.warn('Auth: failed to sync profile.org_id', { err: error.message });
          });
      } else {
        logger.info('Auth: no active membership found', { userId: profile.id });
      }
    }

    // CRITICAL: req.user.role MUST come from memberships, NOT profiles
    req.user = {
      id:                 profile.id,
      email:              profile.email || user.email,
      name:               profile.name,
      role:               resolvedRole,        // ✅ From memberships ONLY
      roleId:             resolvedRoleId,      // ✅ From memberships ONLY
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
 * BUG-014 FIX: Also validate org status
 */
export async function requireOrg(req, res, next) {
  if (req.user?.isPlatformOwner) return next();
  if (!req.user?.orgId) {
    return forbidden(res, 'You must belong to an organization to perform this action');
  }
  
  // BUG-014 FIX: Validate org status
  const { data: org } = await supabase
    .from('organizations')
    .select('status')
    .eq('id', req.user.orgId)
    .maybeSingle();
  
  if (!org || !['approved', 'pending'].includes(org.status)) {
    return forbidden(res, 'Your organization is not active');
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
 * Single check only: req.user.isPlatformOwner set during authenticate().
 * No fallbacks, no role checks, no org checks.
 */
export async function requirePlatformOwner(req, res, next) {
  logger.info('PLATFORM ACCESS CHECK', {
    userId:          req.user?.id,
    isPlatformOwner: req.user?.isPlatformOwner,
    role:            req.user?.role,
    orgId:           req.user?.orgId,
  });

  if (req.user?.isPlatformOwner === true) return next();

  // Re-fetch from DB in case authenticate() ran on old server without the flag
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_platform_owner')
      .eq('id', req.user.id)
      .single();

    if (profile?.is_platform_owner === true) {
      req.user.isPlatformOwner = true;
      logger.info('requirePlatformOwner: granted via DB re-check', { userId: req.user.id });
      return next();
    }
  } catch (err) {
    logger.warn('requirePlatformOwner: DB re-check failed', { err: err.message });
  }

  return forbidden(res, 'Access denied: platform owner only');
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
