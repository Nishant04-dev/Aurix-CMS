import { supabase } from '../config/supabase.js';
import { ok, badRequest, forbidden, notFound, serverError } from '../utils/response.js';
import { logger } from '../utils/logger.js';
import { logAudit } from '../utils/auditLogger.js';

const ROLE_POWER = {
  super_admin: 100, superadmin: 100,
  admin: 90, manager: 70,
  member: 50, developer: 50, support: 50,
  client: 10, inactive: 0,
};

function power(role) { return ROLE_POWER[role?.toLowerCase()] ?? 10; }

async function removeFromChannels(userId, orgId) {
  try {
    const { data: channels } = await supabase
      .from('chat_channels').select('id').eq('org_id', orgId);
    if (channels?.length) {
      await supabase.from('channel_members')
        .delete().eq('user_id', userId).in('channel_id', channels.map(c => c.id));
    }
  } catch (err) {
    logger.warn('removeFromChannels failed', { err: err.message });
  }
}

/**
 * Deactivate membership and clear profile org_id.
 * Keeps the membership row for audit history.
 */
async function deactivateMembership(userId, orgId, status = 'left') {
  await supabase
    .from('memberships')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('org_id', orgId);

  await supabase
    .from('profiles')
    .update({ org_id: null })
    .eq('id', userId)
    .eq('org_id', orgId); // only clear if still in this org
}

// ── Leave Organization ────────────────────────────────────────
export async function leaveOrganization(req, res) {
  try {
    const { id: userId, orgId, role, isPlatformOwner } = req.user;

    if (isPlatformOwner) {
      return forbidden(res, 'Platform owner cannot leave their organization');
    }

    if (!orgId) return badRequest(res, 'You are not in an organization');

    // Block sole super_admin from leaving
    if (role === 'super_admin') {
      const { count } = await supabase
        .from('memberships')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('role', 'super_admin')
        .eq('status', 'active');
      if ((count ?? 0) <= 1) {
        return badRequest(res, 'You are the only owner. Transfer ownership before leaving.');
      }
    }

    await deactivateMembership(userId, orgId, 'left');
    await removeFromChannels(userId, orgId);
    await logAudit({ orgId, actorId: userId, action: 'member.left', targetType: 'user', targetId: userId });

    logger.info('User left org', { userId, orgId });
    return ok(res, null, 'You have left the organization.');
  } catch (err) {
    logger.error('leaveOrganization error', { err: err.message });
    return serverError(res, err.message);
  }
}

// ── Remove Member ─────────────────────────────────────────────
export async function removeMember(req, res) {
  try {
    const { id: requesterId, orgId, powerLevel: requesterPower, isPlatformOwner } = req.user;
    const { target_user_id } = req.body;

    if (!target_user_id) return badRequest(res, 'target_user_id is required');
    if (target_user_id === requesterId) return badRequest(res, 'Cannot remove yourself');

    // Fetch target membership
    const { data: membership } = await supabase
      .from('memberships')
      .select('id, role, user_id')
      .eq('user_id', target_user_id)
      .eq('org_id', orgId)
      .eq('status', 'active')
      .maybeSingle();

    if (!membership) return notFound(res, 'User is not an active member of this organization');

    // Protect platform owner
    const { data: targetProfile } = await supabase
      .from('profiles').select('is_platform_owner').eq('id', target_user_id).single();
    if (targetProfile?.is_platform_owner) {
      return forbidden(res, 'Cannot remove the platform owner');
    }

    const targetPower = power(membership.role);
    if (!isPlatformOwner && targetPower >= requesterPower) {
      return forbidden(res, 'Insufficient authority to remove this member');
    }

    await deactivateMembership(target_user_id, orgId, 'removed');
    await removeFromChannels(target_user_id, orgId);
    await logAudit({ orgId, actorId: requesterId, action: 'member.removed', targetType: 'user', targetId: target_user_id });

    logger.info('Member removed', { requesterId, target_user_id, orgId });
    return ok(res, null, 'Member removed successfully.');
  } catch (err) {
    logger.error('removeMember error', { err: err.message });
    return serverError(res, err.message);
  }
}

// ── Ban Member ────────────────────────────────────────────────
export async function banMember(req, res) {
  try {
    const { id: requesterId, orgId, powerLevel: requesterPower, isPlatformOwner } = req.user;
    const { target_user_id, reason } = req.body;

    if (!target_user_id) return badRequest(res, 'target_user_id is required');
    if (target_user_id === requesterId) return badRequest(res, 'Cannot ban yourself');

    const { data: targetProfile } = await supabase
      .from('profiles').select('is_platform_owner').eq('id', target_user_id).single();
    if (targetProfile?.is_platform_owner) {
      return forbidden(res, 'Cannot ban the platform owner');
    }

    const { data: membership } = await supabase
      .from('memberships')
      .select('id, role')
      .eq('user_id', target_user_id)
      .eq('org_id', orgId)
      .eq('status', 'active')
      .maybeSingle();

    if (!membership) return notFound(res, 'User is not an active member of this organization');

    const targetPower = power(membership.role);
    if (!isPlatformOwner && targetPower >= requesterPower) {
      return forbidden(res, 'Insufficient authority to ban this member');
    }

    // Check existing ban
    const { data: existing } = await supabase
      .from('banned_members').select('id')
      .eq('user_id', target_user_id).eq('org_id', orgId).maybeSingle();
    if (existing) return badRequest(res, 'User is already banned from this organization');

    await supabase.from('banned_members')
      .insert({ user_id: target_user_id, org_id: orgId, banned_by: requesterId, reason: reason || null });

    await deactivateMembership(target_user_id, orgId, 'banned');
    await removeFromChannels(target_user_id, orgId);
    await logAudit({ orgId, actorId: requesterId, action: 'member.banned', targetType: 'user', targetId: target_user_id });

    logger.info('Member banned', { requesterId, target_user_id, orgId });
    return ok(res, null, 'Member banned successfully.');
  } catch (err) {
    logger.error('banMember error', { err: err.message });
    return serverError(res, err.message);
  }
}

// ── Unban Member ──────────────────────────────────────────────
export async function unbanMember(req, res) {
  try {
    const { id: requesterId, orgId } = req.user;
    const { target_user_id } = req.body;

    if (!target_user_id) return badRequest(res, 'target_user_id is required');

    const { data: ban } = await supabase
      .from('banned_members').select('id')
      .eq('user_id', target_user_id).eq('org_id', orgId).maybeSingle();
    if (!ban) return notFound(res, 'No ban record found');

    await supabase.from('banned_members')
      .delete().eq('user_id', target_user_id).eq('org_id', orgId);

    // Restore membership to 'left' (not auto-active — user must re-join)
    await supabase.from('memberships')
      .update({ status: 'left', updated_at: new Date().toISOString() })
      .eq('user_id', target_user_id)
      .eq('org_id', orgId)
      .eq('status', 'banned');

    await logAudit({ orgId, actorId: requesterId, action: 'member.unbanned', targetType: 'user', targetId: target_user_id });

    logger.info('Member unbanned', { requesterId, target_user_id, orgId });
    return ok(res, null, 'User unbanned successfully.');
  } catch (err) {
    logger.error('unbanMember error', { err: err.message });
    return serverError(res, err.message);
  }
}

// ── Get Banned Members ────────────────────────────────────────
export async function getBannedMembers(req, res) {
  try {
    const { orgId } = req.user;

    const { data: bans, error } = await supabase
      .from('banned_members')
      .select('id, user_id, org_id, banned_by, reason, created_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Fetch profiles manually
    const userIds = [...new Set((bans ?? []).map(b => b.user_id).filter(Boolean))];
    let profileMap = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles').select('id, name, email').in('id', userIds);
      profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]));
    }

    return ok(res, (bans ?? []).map(b => ({
      id:        b.id,
      userId:    b.user_id,
      orgId:     b.org_id,
      bannedBy:  b.banned_by,
      reason:    b.reason,
      createdAt: b.created_at,
      name:      profileMap[b.user_id]?.name  || 'Unknown',
      email:     profileMap[b.user_id]?.email || '',
    })));
  } catch (err) {
    logger.error('getBannedMembers error', { err: err.message });
    return serverError(res, err.message);
  }
}
