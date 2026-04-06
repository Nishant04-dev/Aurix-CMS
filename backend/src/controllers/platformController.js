import { z } from 'zod';
import { supabase } from '../config/supabase.js';
import { ok, badRequest, forbidden, serverError } from '../utils/response.js';
import { logger } from '../utils/logger.js';

// ── Platform stats & orgs ─────────────────────────────────────

export async function getPlatformStats(req, res) {
  try {
    const { data, error } = await supabase.rpc('get_platform_stats');
    if (error) throw error;
    return ok(res, data);
  } catch (err) {
    logger.error('getPlatformStats error', { err: err.message });
    return serverError(res, err.message);
  }
}

export async function getAllOrganizations(req, res) {
  try {
    const { data, error } = await supabase.rpc('get_all_organizations');
    if (error) throw error;
    return ok(res, data ?? []);
  } catch (err) {
    logger.error('getAllOrganizations error', { err: err.message });
    return serverError(res, err.message);
  }
}

export async function setPlatformOrgStatus(req, res) {
  try {
    const { org_id, status } = req.body;
    if (!org_id || !status) return badRequest(res, 'org_id and status required');

    const { error } = await supabase.rpc('set_org_status', { p_org_id: org_id, p_status: status });
    if (error) throw error;

    // Cancel subscription if banning/rejecting
    if (['banned', 'rejected'].includes(status)) {
      await supabase.from('subscriptions').update({ status: 'cancelled' }).eq('org_id', org_id);
    }

    logger.info('Platform org status set', { org_id, status, by: req.user?.id });
    return ok(res, { org_id, status }, `Organization ${status}`);
  } catch (err) {
    logger.error('setPlatformOrgStatus error', { err: err.message });
    return serverError(res, err.message);
  }
}

// ── Subscriptions ─────────────────────────────────────────────

export async function getSubscriptions(req, res) {
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*, organizations(id, name, plan, owner_id)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return ok(res, data ?? []);
  } catch (err) {
    logger.error('getSubscriptions error', { err: err.message });
    return serverError(res, err.message);
  }
}

export async function updateSubscription(req, res) {
  try {
    const { id } = req.params;
    const { plan, status, org_id } = req.body;

    const updates = {};
    if (plan)   updates.plan   = plan;
    if (status) updates.status = status;

    const { error } = await supabase.from('subscriptions').update(updates).eq('id', id);
    if (error) throw error;

    // Sync plan to org if plan changed
    if (plan && org_id) {
      await supabase.from('organizations').update({ plan }).eq('id', org_id);
    }

    return ok(res, null, 'Subscription updated');
  } catch (err) {
    logger.error('updateSubscription error', { err: err.message });
    return serverError(res, err.message);
  }
}

// ── Feature flags ─────────────────────────────────────────────

export async function getFeatureFlags(req, res) {
  try {
    const { data, error } = await supabase.from('feature_flags').select('*').order('key');
    if (error) throw error;
    return ok(res, data ?? []);
  } catch (err) {
    logger.error('getFeatureFlags error', { err: err.message });
    return serverError(res, err.message);
  }
}

export async function updateFeatureFlag(req, res) {
  try {
    const { id } = req.params;
    const { enabled } = req.body;
    const { error } = await supabase.from('feature_flags')
      .update({ enabled, updated_at: new Date().toISOString(), updated_by: req.user.id })
      .eq('id', id);
    if (error) throw error;
    return ok(res, null, 'Feature flag updated');
  } catch (err) {
    logger.error('updateFeatureFlag error', { err: err.message });
    return serverError(res, err.message);
  }
}

// ── Platform team ─────────────────────────────────────────────

export async function getPlatformTeam(req, res) {
  try {
    const [membersRes, rolesRes] = await Promise.all([
      supabase.from('platform_user_roles').select('*, platform_roles(id,name,power_level), profiles(id,name,email)'),
      supabase.from('platform_roles').select('*').order('power_level', { ascending: false }),
    ]);
    if (membersRes.error) throw membersRes.error;
    return ok(res, { members: membersRes.data ?? [], roles: rolesRes.data ?? [] });
  } catch (err) {
    logger.error('getPlatformTeam error', { err: err.message });
    return serverError(res, err.message);
  }
}

export async function addPlatformMember(req, res) {
  try {
    const { display_id, role_id } = req.body;
    if (!display_id || !role_id) return badRequest(res, 'display_id and role_id required');

    const { data: profile } = await supabase
      .from('profiles').select('id, name, email').eq('display_id', display_id.toUpperCase()).maybeSingle();
    if (!profile) return badRequest(res, 'User not found');

    const { data: existing } = await supabase
      .from('platform_user_roles').select('id').eq('user_id', profile.id).maybeSingle();
    if (existing) return badRequest(res, 'User already has a platform role');

    const { error } = await supabase.from('platform_user_roles').insert({ user_id: profile.id, role_id });
    if (error) throw error;
    return ok(res, null, `${profile.name || profile.email} added to platform team`);
  } catch (err) {
    logger.error('addPlatformMember error', { err: err.message });
    return serverError(res, err.message);
  }
}

export async function removePlatformMember(req, res) {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('platform_user_roles').delete().eq('id', id);
    if (error) throw error;
    return ok(res, null, 'Platform member removed');
  } catch (err) {
    logger.error('removePlatformMember error', { err: err.message });
    return serverError(res, err.message);
  }
}

// ── Support ───────────────────────────────────────────────────

export async function getSupportConversations(req, res) {
  try {
    const { org_id } = req.query;
    let query = supabase.from('support_conversations')
      .select('*, organizations(name)')
      .order('updated_at', { ascending: false });
    if (org_id) query = query.eq('org_id', org_id);

    const { data, error } = await query;
    if (error) throw error;
    return ok(res, data ?? []);
  } catch (err) {
    logger.error('getSupportConversations error', { err: err.message });
    return serverError(res, err.message);
  }
}

export async function createSupportConversation(req, res) {
  try {
    const { orgId, id: userId } = req.user;
    const { subject, message } = req.body;
    if (!subject || !message) return badRequest(res, 'subject and message required');

    const { data: conv, error: convErr } = await supabase
      .from('support_conversations')
      .insert({ org_id: orgId, created_by: userId, subject: subject.trim() })
      .select().single();
    if (convErr) throw convErr;

    await supabase.from('support_messages').insert({
      conversation_id: conv.id, sender_id: userId, message: message.trim(), is_platform: false,
    });

    return ok(res, conv, 'Support ticket created');
  } catch (err) {
    logger.error('createSupportConversation error', { err: err.message });
    return serverError(res, err.message);
  }
}

export async function getSupportMessages(req, res) {
  try {
    const { conversation_id } = req.query;
    if (!conversation_id) return badRequest(res, 'conversation_id required');
    const { data, error } = await supabase
      .from('support_messages').select('*')
      .eq('conversation_id', conversation_id)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return ok(res, data ?? []);
  } catch (err) {
    logger.error('getSupportMessages error', { err: err.message });
    return serverError(res, err.message);
  }
}

export async function sendSupportMessage(req, res) {
  try {
    const { id: userId, isPlatformOwner } = req.user;
    const { conversation_id, message, is_platform = false } = req.body;
    if (!conversation_id || !message) return badRequest(res, 'conversation_id and message required');

    const { error } = await supabase.from('support_messages').insert({
      conversation_id, sender_id: userId, message: message.trim(), is_platform,
    });
    if (error) throw error;
    return ok(res, null, 'Message sent');
  } catch (err) {
    logger.error('sendSupportMessage error', { err: err.message });
    return serverError(res, err.message);
  }
}

export async function closeSupportConversation(req, res) {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('support_conversations').update({ status: 'closed' }).eq('id', id);
    if (error) throw error;
    return ok(res, null, 'Ticket closed');
  } catch (err) {
    logger.error('closeSupportConversation error', { err: err.message });
    return serverError(res, err.message);
  }
}

// ── Platform permissions ────────────────────────────────────

export async function getPlatformPermissions(req, res) {
  try {
    const { id: userId } = req.user;

    const { data: userRoles } = await supabase
      .from('platform_user_roles')
      .select('role_id')
      .eq('user_id', userId);

    if (!userRoles || userRoles.length === 0) {
      return ok(res, { permissions: [], role: null, power: 0 });
    }

    // Get highest power role
    const roleIds = userRoles.map(r => r.role_id);
    const { data: roles } = await supabase
      .from('platform_roles')
      .select('id, name, power_level')
      .in('id', roleIds);

    const topRole = roles?.reduce((best, cur) => cur.power_level > best.power_level ? cur : best);
    const role = topRole ? { id: topRole.id, name: topRole.name, powerLevel: topRole.power_level } : null;

    // Get permissions
    const { data: perms } = await supabase
      .from('platform_role_permissions')
      .select('permission_key')
      .in('role_id', roleIds);

    const permissions = perms?.map(p => p.permission_key) || [];

    return ok(res, { permissions, role, power: role?.powerLevel || 0 });
  } catch (err) {
    logger.error('getPlatformPermissions error', { err: err.message });
    return serverError(res, err.message);
  }
}

// ── Platform audit logs ───────────────────────────────────────

export async function getPlatformAuditLogs(req, res) {
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('id, action, user_id, created_at, entity, metadata')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return ok(res, data ?? []);
  } catch (err) {
    logger.error('getPlatformAuditLogs error', { err: err.message });
    return serverError(res, err.message);
  }
}

// ── Platform users ────────────────────────────────────────────

export async function getAllUsers(req, res) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, email, role, status, org_id, created_at, organizations(name)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    const users = (data ?? []).map(u => ({
      ...u,
      org_name: u.organizations?.name ?? null,
      organizations: undefined,
    }));
    return ok(res, users);
  } catch (err) {
    logger.error('getAllUsers error', { err: err.message });
    return serverError(res, err.message);
  }
}

export async function updateUserStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!['active', 'banned', 'disabled'].includes(status)) {
      return badRequest(res, 'status must be active, banned, or disabled');
    }
    const { error } = await supabase
      .from('profiles').update({ status }).eq('id', id);
    if (error) throw error;
    return ok(res, { id, status }, `User ${status}`);
  } catch (err) {
    logger.error('updateUserStatus error', { err: err.message });
    return serverError(res, err.message);
  }
}
