import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { API_BASE } from '@/lib/apiUrl';

const API = API_BASE;

async function authFetch(path: string, options: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${API}/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token ?? ''}`,
      ...(options.headers || {}),
    },
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.error || 'Request failed');
  return json.data;
}

export interface Channel {
  id: string;
  name: string;
  org_id: string;
  created_by: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  channel_id: string;
  sender_id: string;
  sender_name: string;
  sender_avatar: string | null;
  content: string;
  attachments: string[];
  created_at: string;
}

export function useChannels() {
  return useQuery<Channel[]>({
    queryKey: ['chat-channels'],
    queryFn: () => authFetch('/chat/channels'),
    placeholderData: [],
  });
}

export function useMessages(channelId: string | null) {
  return useQuery<ChatMessage[]>({
    queryKey: ['chat-messages', channelId],
    queryFn: () => authFetch(`/chat/channels/${channelId}/messages`),
    enabled: !!channelId,
    placeholderData: [],
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ channelId, content }: { channelId: string; content: string }) =>
      authFetch('/chat/messages', { method: 'POST', body: JSON.stringify({ channel_id: channelId, content }) }),
    onSuccess: (_, { channelId }) => {
      queryClient.invalidateQueries({ queryKey: ['chat-messages', channelId] });
    },
  });
}

export function useCreateChannel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      authFetch('/chat/channels', { method: 'POST', body: JSON.stringify({ name }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chat-channels'] }),
  });
}

export function useDeleteChannel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (channelId: string) =>
      authFetch(`/chat/channels/${channelId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chat-channels'] }),
  });
}

/** Subscribes to new messages in a channel via Supabase Realtime */
export function useRealtimeMessages(
  channelId: string | null,
  onNewMessage: (msg: any) => void
) {
  useEffect(() => {
    if (!channelId) return;

    const channel = (supabase as any)
      .channel(`chat:${channelId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `channel_id=eq.${channelId}`,
      }, (payload: any) => {
        onNewMessage(payload.new);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [channelId]);
}
