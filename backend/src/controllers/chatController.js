import { supabase } from '../config/supabase.js';
import { ok, created, badRequest, forbidden, notFound, serverError } from '../utils/response.js';
import { logger } from '../utils/logger.js';
import { logAudit } from '../utils/auditLogger.js';

const CHANNEL_NAME_RE = /^[a-z0-9-]{1,50}$/;

// ── Channels ──────────────────────────────────────────────────

export async function createChannel(req, res) {
  try {
    const { id: userId, orgId, role } = req.user;
    if (!['admin', 'super_admin'].includes(role)) return forbidden(res, 'Only admins can create channels');

    const { name } = req.body;
    if (!name || !CHANNEL_NAME_RE.test(name)) {
      return badRequest(res, 'Channel name must be 1–50 lowercase alphanumeric characters or hyphens');
    }

    const { data: channel, error } = await supabase
      .from('chat_channels')
      .insert({ org_id: orgId, name, created_by: userId })
      .select().single();

    if (error) {
      if (error.code === '23505') return badRequest(res, 'A channel with this name already exists');
      throw error;
    }

    // Auto-add creator as member
    await supabase.from('channel_members').insert({ channel_id: channel.id, user_id: userId });

    logAudit({ orgId, actorId: userId, action: 'channel.created', targetType: 'channel', targetId: channel.id, metadata: { name } });

    return created(res, channel, 'Channel created');
  } catch (err) {
    logger.error('createChannel error', { err: err.message });
    return serverError(res, err.message);
  }
}

export async function deleteChannel(req, res) {
  try {
    const { id: userId, orgId, role } = req.user;
    if (!['admin', 'super_admin'].includes(role)) return forbidden(res, 'Only admins can delete channels');

    const { channelId } = req.params;
    const { data: ch } = await supabase.from('chat_channels').select('id, org_id, name').eq('id', channelId).maybeSingle();
    if (!ch) return notFound(res, 'Channel not found');
    if (ch.org_id !== orgId) return forbidden(res, 'Channel does not belong to your organization');

    await supabase.from('chat_channels').delete().eq('id', channelId).eq('org_id', orgId);
    logAudit({ orgId, actorId: userId, action: 'channel.deleted', targetType: 'channel', targetId: channelId, metadata: { name: ch.name } });

    return ok(res, null, 'Channel deleted');
  } catch (err) {
    logger.error('deleteChannel error', { err: err.message });
    return serverError(res, err.message);
  }
}

export async function addChannelMember(req, res) {
  try {
    const { id: userId, orgId, role } = req.user;
    if (!['admin', 'super_admin'].includes(role)) return forbidden(res, 'Only admins can add channel members');

    const { channelId } = req.params;
    const { user_id: targetUserId } = req.body;
    if (!targetUserId) return badRequest(res, 'user_id is required');

    const { data: ch } = await supabase.from('chat_channels').select('id, org_id').eq('id', channelId).maybeSingle();
    if (!ch) return notFound(res, 'Channel not found');
    if (ch.org_id !== orgId) return forbidden(res, 'Channel does not belong to your organization');

    // Verify target is active org member
    const { data: target } = await supabase.from('profiles').select('id, org_id').eq('id', targetUserId).maybeSingle();
    if (!target || target.org_id !== orgId) return forbidden(res, 'User is not an active member of this organization');

    const { error } = await supabase.from('channel_members').insert({ channel_id: channelId, user_id: targetUserId });
    if (error && error.code === '23505') return badRequest(res, 'User is already a member of this channel');
    if (error) throw error;

    logAudit({ orgId, actorId: userId, action: 'channel.member_added', targetType: 'user', targetId: targetUserId, metadata: { channelId } });
    return created(res, null, 'Member added to channel');
  } catch (err) {
    logger.error('addChannelMember error', { err: err.message });
    return serverError(res, err.message);
  }
}

export async function removeChannelMember(req, res) {
  try {
    const { id: userId, orgId, role } = req.user;
    if (!['admin', 'super_admin'].includes(role)) return forbidden(res, 'Only admins can remove channel members');

    const { channelId, memberId } = req.params;
    const { data: ch } = await supabase.from('chat_channels').select('id, org_id').eq('id', channelId).maybeSingle();
    if (!ch) return notFound(res, 'Channel not found');
    if (ch.org_id !== orgId) return forbidden(res, 'Channel does not belong to your organization');

    await supabase.from('channel_members').delete().eq('channel_id', channelId).eq('user_id', memberId);
    logAudit({ orgId, actorId: userId, action: 'channel.member_removed', targetType: 'user', targetId: memberId, metadata: { channelId } });

    return ok(res, null, 'Member removed from channel');
  } catch (err) {
    logger.error('removeChannelMember error', { err: err.message });
    return serverError(res, err.message);
  }
}

export async function getChannels(req, res) {
  try {
    const { id: userId, orgId } = req.user;

    const { data: memberships, error } = await supabase
      .from('channel_members')
      .select('channel_id')
      .eq('user_id', userId);

    if (error) throw error;
    if (!memberships?.length) return ok(res, []);

    const channelIds = memberships.map(m => m.channel_id);
    const { data: channels, error: chErr } = await supabase
      .from('chat_channels')
      .select('id, name, org_id, created_by, created_at, project_id, type')
      .in('id', channelIds)
      .eq('org_id', orgId);

    if (chErr) throw chErr;
    return ok(res, channels ?? []);
  } catch (err) {
    logger.error('getChannels error', { err: err.message });
    return serverError(res, err.message);
  }
}

// ── Messages ──────────────────────────────────────────────────

export async function sendMessage(req, res) {
  try {
    const { id: userId } = req.user;
    const { channel_id, content, attachments = [] } = req.body;

    if (!channel_id) return badRequest(res, 'channel_id is required');
    if (!content || content.length < 1 || content.length > 4000) {
      return badRequest(res, 'Message content must be between 1 and 4000 characters');
    }

    // Verify sender is a channel member
    const { data: membership } = await supabase
      .from('channel_members').select('id').eq('channel_id', channel_id).eq('user_id', userId).maybeSingle();
    if (!membership) return forbidden(res, 'You are not a member of this channel');

    const { data: msg, error } = await supabase
      .from('chat_messages')
      .insert({ channel_id, sender_id: userId, content, attachments })
      .select().single();

    if (error) throw error;
    return created(res, msg, 'Message sent');
  } catch (err) {
    logger.error('sendMessage error', { err: err.message });
    return serverError(res, err.message);
  }
}

export async function getMessages(req, res) {
  try {
    const { id: userId } = req.user;
    const { channelId } = req.params;
    const { before, limit: rawLimit = 50 } = req.query;
    const limit = Math.min(parseInt(rawLimit) || 50, 100);

    // Verify membership
    const { data: membership } = await supabase
      .from('channel_members').select('id').eq('channel_id', channelId).eq('user_id', userId).maybeSingle();
    if (!membership) return forbidden(res, 'You are not a member of this channel');

    let query = supabase
      .from('chat_messages')
      .select('*')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (before) query = query.lt('created_at', before);

    const { data, error } = await query;
    if (error) throw error;

    // Fetch sender profiles manually
    const senderIds = [...new Set((data || []).map(m => m.sender_id).filter(Boolean))];
    let profileMap = {};
    if (senderIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles').select('id, name, avatar_url').in('id', senderIds);
      profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]));
    }

    const msgs = (data || []).reverse().map(m => ({
      id:            m.id,
      channel_id:    m.channel_id,
      sender_id:     m.sender_id,
      sender_name:   profileMap[m.sender_id]?.name || 'Unknown',
      sender_avatar: profileMap[m.sender_id]?.avatar_url || null,
      content:       m.content,
      attachments:   m.attachments,
      created_at:    m.created_at,
    }));

    return ok(res, msgs);
  } catch (err) {
    logger.error('getMessages error', { err: err.message });
    return serverError(res, err.message);
  }
}
