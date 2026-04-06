import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/apiClient';
import type { BannedMember, MembershipAction } from '@/types/membership';

export function useLeaveOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ nextOrgId: string | null }>('/members/leave'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      queryClient.invalidateQueries({ queryKey: ['user_orgs'] });
    },
  });
}

export function useRemoveMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (action: MembershipAction) =>
      api.post('/members/remove', { target_user_id: action.targetUserId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['team'] }),
  });
}

export function useBanMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (action: MembershipAction) =>
      api.post('/members/ban', { target_user_id: action.targetUserId, reason: action.reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      queryClient.invalidateQueries({ queryKey: ['banned-members'] });
    },
  });
}

export function useUnbanMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (targetUserId: string) =>
      api.post('/members/unban', { target_user_id: targetUserId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['banned-members'] }),
  });
}

export function useBannedMembers() {
  return useQuery<BannedMember[]>({
    queryKey: ['banned-members'],
    queryFn: () => api.get<BannedMember[]>('/members/banned'),
  });
}
