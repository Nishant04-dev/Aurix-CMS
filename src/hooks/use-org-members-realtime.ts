import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Subscribes to organization_members changes for the given org.
 * Calls onSelfRemoved when the current user's membership is deleted.
 * Otherwise invalidates the 'team' query to refresh the member list.
 */
export function useOrgMembersRealtime(
  orgId: string | null | undefined,
  currentUserId: string | null | undefined,
  onSelfRemoved: () => void
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!orgId || !currentUserId) return;

    const channel = supabase
      .channel(`org-members:${orgId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `org_id=eq.${orgId}`,
        },
        (payload) => {
          // Detect self-removal: org_id was set to null for current user
          if (
            payload.eventType === 'UPDATE' &&
            (payload.new as any)?.id === currentUserId &&
            (payload.new as any)?.org_id === null
          ) {
            onSelfRemoved();
            return;
          }
          queryClient.invalidateQueries({ queryKey: ['team'] });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [orgId, currentUserId]);
}
