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

// Leave org — uses atomic DB function to update invitations + profile in one transaction
async function leaveOrgDirect() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .single();

  if (!profile?.org_id) throw new Error('You are not in an organization');

  const { data, error } = await (supabase as any)
    .rpc('leave_organization', { p_org_id: profile.org_id });

  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);

  return { nextOrgId: data?.next_org_id ?? null };
}

export function useLeaveOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: leaveOrgDirect,
    onSuccess: () => {
      logAudit({ action: 'USER_LEFT', entity: 'organization' });
      queryClient.invalidateQueries({ queryKey: ['team'] });
      queryClient.invalidateQueries({ queryKey: ['user_orgs'] });
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
