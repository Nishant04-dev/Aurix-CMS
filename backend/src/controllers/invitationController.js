import { z } from 'zod';
import { supabase } from '../config/supabase.js';
import { ok, created, badRequest, forbidden, notFound, serverError } from '../utils/response.js';
import { logger } from '../utils/logger.js';
import { logAudit } from '../utils/auditLogger.js';

const SendInviteSchema = z.object({
  display_id: z.string().regex(/^AURIX-\d{5}$/, 'Invalid ID format. Use AURIX-XXXXX'),
  role_name:  z.string().min(1),
  type:       z.enum(['team', 'client']).default('team'),
});

export async function sendInvitation(req, res) {
  try {
    const { orgId, id: userId, role, powerLevel } = req.user;

    if (!['admin', 'super_admin', 'manager'].includes(role)) {
      return forbidden(res, 'Only admins and managers can send invitations');
    }

    const { display_id, role_name, type } = SendInviteSchema.parse(req.body);

    // Validate target user exists
    const { data: target } = await supabase
      .from('profiles')
      .select('id, name, email, org_id, power_level')
      .eq('display_id', display_id)
      .single();

    if (!target) return badRequest(res, 'User not found. Check the ID and try again.');
    if (target.id === userId) return badRequest(res, 'You cannot invite yourself');
    if (target.org_id === orgId) return badRequest(res, 'This user is already in your organization');

    // Check for existing pending invite
    const { data: existing } = await supabase
      .from('invitations')
      .select('id')
      .eq('org_id', orgId)
      .eq('target_user_id', target.id)
      .eq('status', 'pending')
      .maybeSingle();

    if (existing) return badRequest(res, 'A pending invitation already exists for this user');

    // Hierarchy check
    const { data: targetRole } = await supabase
      .from('roles')
      .select('power_level')
      .eq('org_id', orgId)
      .ilike('name', role_name)
      .maybeSingle();

    if (targetRole && targetRole.power_level >= powerLevel) {
      return forbidden(res, 'Cannot assign a role equal to or higher than your own');
    }

    // ── Insert invitation directly (no queue) ──────────────────
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7-day expiry

    const { data: invitation, error: invErr } = await supabase
      .from('invitations')
      .insert({
        org_id:         orgId,
        invited_by:     userId,
        target_user_id: target.id,
        role_name,
        type,
        status:         'pending',
        expires_at:     expiresAt.toISOString(),
      })
      .select()
      .single();

    if (invErr) throw invErr;

    logger.info('Invitation created', { invitationId: invitation.id, displayId: display_id, orgId });
    logAudit({ orgId, actorId: userId, action: 'invite.sent', targetType: 'invitation', targetId: target.id, metadata: { role_name, type, display_id } });
    return created(res, { id: invitation.id, targetName: target.name || target.email }, 'Invitation sent');
  } catch (err) {
    if (err.name === 'ZodError') return badRequest(res, err.errors.map(e => e.message).join('; '));
    logger.error('sendInvitation error', { err: err.message });
    return serverError(res, err.message);
  }
}

export async function respondToInvitation(req, res) {
  try {
    const { id: userId } = req.user;
    const { invitation_id, action } = req.body;

    if (!invitation_id || !['accept', 'reject', 'cancel'].includes(action)) {
      return badRequest(res, 'invitation_id and action (accept|reject|cancel) required');
    }

    // Cancel — sender cancels their own invite
    if (action === 'cancel') {
      const { data: inv } = await supabase
        .from('invitations').select('id, invited_by, org_id').eq('id', invitation_id).maybeSingle();
      if (!inv) return notFound(res, 'Invitation not found');
      if (inv.invited_by !== userId) return forbidden(res, 'You can only cancel your own invitations');
      const { error } = await supabase
        .from('invitations').update({ status: 'cancelled' }).eq('id', invitation_id);
      if (error) throw error;
      return ok(res, null, 'Invitation cancelled');
    }

    // Fetch the invitation
    const { data: inv } = await supabase
      .from('invitations')
      .select('id, org_id, role_name, target_user_id, status')
      .eq('id', invitation_id)
      .maybeSingle();

    if (!inv) return notFound(res, 'Invitation not found');
    if (inv.target_user_id !== userId) return forbidden(res, 'This invitation is not for you');
    if (inv.status !== 'pending') return badRequest(res, `Invitation is already ${inv.status}`);

    // Ban check for accept
    if (action === 'accept' && inv.org_id) {
      const { data: ban } = await supabase
        .from('banned_members').select('id')
        .eq('user_id', userId).eq('org_id', inv.org_id).maybeSingle();
      if (ban) return forbidden(res, 'You are banned from this organization.');
    }

    // Update invitation status directly
    const newStatus = action === 'accept' ? 'accepted' : 'rejected';
    const updateData = { status: newStatus };
    if (action === 'accept') updateData.accepted_at = new Date().toISOString();

    const { error: updateErr } = await supabase
      .from('invitations').update(updateData).eq('id', invitation_id);
    if (updateErr) throw updateErr;

    // On accept: update profile org_id + create membership
    if (action === 'accept' && inv.org_id) {
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ org_id: inv.org_id })
        .eq('id', userId);
      if (profileErr) {
        logger.error('respondToInvitation: failed to update profile org_id', { err: profileErr.message, userId, org_id: inv.org_id });
        throw profileErr;
      }

      const { error: memberErr } = await supabase
        .from('memberships')
        .upsert({
          user_id: userId,
          org_id:  inv.org_id,
          role:    inv.role_name || 'client',
          status:  'active',
        }, { onConflict: 'user_id,org_id' });
      if (memberErr) {
        logger.error('respondToInvitation: failed to upsert membership', { err: memberErr.message, userId, org_id: inv.org_id });
        throw memberErr;
      }

      logger.info('Invitation accepted — profile + membership updated', { userId, org_id: inv.org_id, role: inv.role_name });
    }

    const auditAction = action === 'accept' ? 'invite.accepted' : 'invite.rejected';
    logAudit({ orgId: inv.org_id, actorId: userId, action: auditAction, targetType: 'invitation', targetId: invitation_id });

    const message = action === 'accept'
      ? 'You have joined the organization!'
      : 'Invitation declined';

    return ok(res, {
      success: true,
      message,
      org_id: action === 'accept' ? inv.org_id : null,
    }, message);
  } catch (err) {
    logger.error('respondToInvitation error', { err: err.message });
    return serverError(res, err.message);
  }
}

export async function getMyInvitations(req, res) {
  try {
    const { id: userId } = req.user;

    // Fetch received and sent invitations (no joins)
    const [receivedRes, sentRes] = await Promise.all([
      supabase.from('invitations').select('*').eq('target_user_id', userId).order('created_at', { ascending: false }),
      supabase.from('invitations').select('*').eq('invited_by', userId).order('created_at', { ascending: false }),
    ]);
    if (receivedRes.error) throw receivedRes.error;
    if (sentRes.error) throw sentRes.error;

    const received = receivedRes.data ?? [];
    const sent = sentRes.data ?? [];

    // Collect all org IDs and user IDs for manual enrichment
    const orgIds = [...new Set([
      ...received.map(i => i.org_id),
      ...sent.map(i => i.org_id),
    ].filter(Boolean))];

    const userIds = [...new Set([
      ...received.map(i => i.invited_by),
      ...sent.map(i => i.target_user_id),
    ].filter(Boolean))];

    // Fetch orgs and profiles separately
    const [orgsRes, profilesRes] = await Promise.all([
      orgIds.length > 0 ? supabase.from('organizations').select('id, name, logo_url').in('id', orgIds) : { data: [] },
      userIds.length > 0 ? supabase.from('profiles').select('id, name, email, display_id').in('id', userIds) : { data: [] },
    ]);

    const orgMap = Object.fromEntries((orgsRes.data ?? []).map(o => [o.id, o]));
    const profileMap = Object.fromEntries((profilesRes.data ?? []).map(p => [p.id, p]));

    const enrichedReceived = received.map(i => ({
      ...i,
      org: orgMap[i.org_id] ?? null,
      inviterProfile: profileMap[i.invited_by] ?? null,
    }));

    const enrichedSent = sent.map(i => ({
      ...i,
      org: orgMap[i.org_id] ?? null,
      targetProfile: profileMap[i.target_user_id] ?? null,
    }));

    return ok(res, { received: enrichedReceived, sent: enrichedSent });
  } catch (err) {
    logger.error('getMyInvitations error', { err: err.message });
    return serverError(res, err.message);
  }
}

export async function lookupUserByDisplayId(req, res) {
  try {
    const { display_id } = req.query;
    if (!display_id) return badRequest(res, 'display_id query param required');

    const { data, error } = await supabase
      .from('profiles')
      .select('name, email, display_id')
      .eq('display_id', display_id.toUpperCase())
      .maybeSingle();

    if (error) throw error;
    if (!data) return notFound(res, 'User not found');
    return ok(res, data);
  } catch (err) {
    return serverError(res, err.message);
  }
}
