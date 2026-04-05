import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { BannedMember, MembershipAction } from '@/types/membership';
import { logAudit } from '@/lib/auditLog';
import { API_BASE } from '@/lib/apiUrl';

const API = API_BASE;

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session?.access_token ?? ''}`,
  };
}

async function post(path: string, body: object) {
  const res = await fetch(`${API}/api${path}`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.error || 'Request failed');
  return json;
}

async function get(path: string) {
  const res = await fetch(`${API}/api${path}`, { headers: await authHeaders() });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.error || 'Request failed');
  return json.data;
}

// Leave org — auto-switch to another org if available (owned or joined), otherwise clear
async function leaveOrgDirect() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('org_id, role')
    .eq('id', user.id)
    .single();

  if (!profile?.org_id) throw new Error('You are not in an organization');

  // Block sole superadmin from leaving
  if (profile.role === 'super_admin') {
    const { count } = await (supabase as any)
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', profile.org_id)
      .in('role', ['super_admin']);
    if ((count ?? 0) <= 1) {
      throw new Error('You are the only owner. Transfer ownership before leaving.');
    }
  }

  // Find next org: first check owned orgs, then accepted invitations
  const { data: ownedOrgs } = await (supabase as any)
    .from('organizations')
    .select('id')
    .eq('owner_id', user.id)
    .neq('id', profile.org_id)
    .limit(1);

  let nextOrgId: string | null = ownedOrgs?.[0]?.id ?? null;
  let nextRole = 'admin';

  if (!nextOrgId) {
    const { data: otherInvites } = await (supabase as any)
      .from('invitations')
      .select('org_id, role_name')
      .eq('target_user_id', user.id)
      .eq('status', 'accepted')
      .neq('org_id', profile.org_id)
      .limit(1);
    nextOrgId = otherInvites?.[0]?.org_id ?? null;
    nextRole = otherInvites?.[0]?.role_name ?? 'client';
  }

  const { error } = await (supabase as any)
    .from('profiles')
    .update({
      org_id: nextOrgId,
      role: nextOrgId ? nextRole : 'client',
      // Reset account_type to 'user' only if truly no org left
      account_type: nextOrgId ? 'business' : 'user',
    })
    .eq('id', user.id);

  if (error) throw new Error(error.message);
  return { nextOrgId };
}

export function useLeaveOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: leaveOrgDirect,
    onSuccess: () => {
      logAudit({ action: 'USER_LEFT', entity: 'organization' });
      queryClient.invalidateQueries({ queryKey: ['team'] });
    },
  });
}

export function useRemoveMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (action: MembershipAction) =>
      post('/members/remove', { target_user_id: action.targetUserId }),
    onSuccess: (_, action) => {
      logAudit({ action: 'USER_REMOVED', entity: 'profile', entityId: action.targetUserId });
      queryClient.invalidateQueries({ queryKey: ['team'] });
    },
  });
}

export function useBanMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (action: MembershipAction) =>
      post('/members/ban', { target_user_id: action.targetUserId, reason: action.reason }),
    onSuccess: (_, action) => {
      logAudit({ action: 'USER_BANNED', entity: 'profile', entityId: action.targetUserId });
      queryClient.invalidateQueries({ queryKey: ['team'] });
      queryClient.invalidateQueries({ queryKey: ['banned-members'] });
    },
  });
}

export function useUnbanMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (targetUserId: string) =>
      post('/members/unban', { target_user_id: targetUserId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['banned-members'] }),
  });
}

export function useBannedMembers() {
  return useQuery<BannedMember[]>({
    queryKey: ['banned-members'],
    queryFn: () => get('/members/banned'),
  });
}
