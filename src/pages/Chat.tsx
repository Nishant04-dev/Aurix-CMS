import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/use-permissions';
import { usePlan } from '@/hooks/use-plan';
import {
  useChannels, useMessages, useSendMessage,
  useCreateChannel, useDeleteChannel, useRealtimeMessages,
  type Channel, type ChatMessage,
} from '@/hooks/use-chat';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Hash, Plus, Send, Trash2, MessageSquare } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';

export default function Chat() {
  const { user } = useAuth();
  const { isAdmin } = usePermissions();
  const { plan } = usePlan();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const CHAT_LIMITS: Record<string, number> = { free: 2, pro: 4, enterprise: 10 };
  const maxChats = CHAT_LIMITS[plan] ?? 2;

  const { data: channels = [], isLoading: channelsLoading } = useChannels();
  const atLimit = channels.length >= maxChats;
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<Channel | null>(null);
  const [deletedChannelId, setDeletedChannelId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: fetchedMessages = [], isLoading: msgsLoading } = useMessages(activeChannelId);
  const sendMessage = useSendMessage();
  const createChannel = useCreateChannel();
  const deleteChannel = useDeleteChannel();

  // Sync fetched messages into local state
  useEffect(() => {
    setLocalMessages(fetchedMessages);
  }, [fetchedMessages]);

  // Auto-select first channel
  useEffect(() => {
    if (channels.length > 0 && !activeChannelId) {
      setActiveChannelId(channels[0].id);
    }
    // If active channel was deleted, switch to first available
    if (activeChannelId && !channels.find(c => c.id === activeChannelId)) {
      setDeletedChannelId(activeChannelId);
      setActiveChannelId(channels[0]?.id ?? null);
    }
  }, [channels]);

  // Realtime: append new messages
  useRealtimeMessages(activeChannelId, (newMsg) => {
    setLocalMessages(prev => {
      if (prev.find(m => m.id === newMsg.id)) return prev;
      return [...prev, {
        id:            newMsg.id,
        channel_id:    newMsg.channel_id,
        sender_id:     newMsg.sender_id,
        sender_name:   newMsg.sender_name || (newMsg.sender_id === user?.id ? (user?.name || 'You') : 'Team Member'),
        sender_avatar: newMsg.sender_avatar || null,
        content:       newMsg.content,
        attachments:   newMsg.attachments || [],
        created_at:    newMsg.created_at,
      }];
    });
  });

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [localMessages]);

  const handleSend = async () => {
    if (!input.trim() || !activeChannelId) return;
    const content = input.trim();
    setInput('');
    try {
      await sendMessage.mutateAsync({ channelId: activeChannelId, content });
      queryClient.invalidateQueries({ queryKey: ['chat-messages', activeChannelId] });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
      setInput(content);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;
    try {
      await createChannel.mutateAsync(newChannelName.trim());
      toast({ title: 'Channel created' });
      setShowCreate(false);
      setNewChannelName('');
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    }
  };

  const handleDeleteChannel = async () => {
    if (!confirmDelete) return;
    try {
      await deleteChannel.mutateAsync(confirmDelete.id);
      toast({ title: 'Channel deleted' });
      setConfirmDelete(null);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    }
  };

  const activeChannel = channels.find(c => c.id === activeChannelId);

  return (
    <div className="flex h-[calc(100vh-8rem)] rounded-xl border border-border/50 overflow-hidden bg-card shadow-sm">

      {/* ── Sidebar ── */}
      <div className="w-60 shrink-0 border-r border-border/50 flex flex-col bg-muted/10">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Channels</span>
            <span className="text-[10px] font-bold text-muted-foreground">{channels.length}/{maxChats}</span>
          </div>
          {isAdmin && (
            <Button
              variant="ghost" size="icon" className="h-6 w-6"
              onClick={() => atLimit
                ? toast({ variant: 'destructive', title: `Channel limit reached (${channels.length}/${maxChats})`, description: `Upgrade to ${plan === 'free' ? 'Pro' : 'Enterprise'} to create more channels.` })
                : setShowCreate(true)
              }
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {channelsLoading && <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-primary/40" /></div>}
          {channels.map(ch => (
            <button
              key={ch.id}
              onClick={() => { setActiveChannelId(ch.id); setDeletedChannelId(null); }}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left',
                ch.id === activeChannelId
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <Hash className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{ch.name}</span>
            </button>
          ))}
          {!channelsLoading && channels.length === 0 && (
            <p className="text-xs text-muted-foreground px-3 py-2">No channels yet.</p>
          )}
        </div>
      </div>

      {/* ── Main area ── */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/50 bg-background/60">
          {activeChannel ? (
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-foreground">{activeChannel.name}</span>
            </div>
          ) : (
            <span className="text-muted-foreground text-sm">Select a channel</span>
          )}
          {isAdmin && activeChannel && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => setConfirmDelete(activeChannel)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {deletedChannelId && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
              Channel was deleted.
            </div>
          )}
          {!activeChannelId && !deletedChannelId && (
            <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
              Select a channel to start chatting
            </div>
          )}
          {msgsLoading && <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary/40" /></div>}
          {localMessages.map(msg => (
            <div key={msg.id} className={cn('flex gap-3', msg.sender_id === user?.id && 'flex-row-reverse')}>
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                {(msg.sender_name || '?').charAt(0).toUpperCase()}
              </div>
              <div className={cn('max-w-[70%]', msg.sender_id === user?.id && 'items-end flex flex-col')}>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-xs font-semibold text-foreground">{msg.sender_name}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className={cn(
                  'rounded-2xl px-3.5 py-2 text-sm leading-relaxed',
                  msg.sender_id === user?.id
                    ? 'bg-primary text-primary-foreground rounded-tr-sm'
                    : 'bg-muted text-foreground rounded-tl-sm'
                )}>
                  {msg.content}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        {activeChannelId && !deletedChannelId && (
          <div className="px-4 py-3 border-t border-border/50 bg-background/60">
            <div className="flex gap-2 items-end">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Message #${activeChannel?.name ?? '...'}`}
                rows={1}
                className="flex-1 resize-none rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 min-h-[42px] max-h-32"
              />
              <Button size="icon" className="h-10 w-10 shrink-0" onClick={handleSend}
                disabled={!input.trim() || sendMessage.isPending}>
                {sendMessage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 px-1">Enter to send · Shift+Enter for newline</p>
          </div>
        )}
      </div>

      {/* Create channel dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Create Channel</DialogTitle></DialogHeader>
          <form onSubmit={handleCreateChannel} className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Channel name</label>
              <Input
                value={newChannelName}
                onChange={e => setNewChannelName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="e.g. general"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">Lowercase letters, numbers, and hyphens only.</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button type="submit" disabled={!newChannelName.trim() || createChannel.isPending}>
                {createChannel.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete channel confirmation */}
      <AlertDialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete #{confirmDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the channel and all its messages. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteChannel} disabled={deleteChannel.isPending}>
              Delete Channel
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
