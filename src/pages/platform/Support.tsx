import React, { useEffect, useState, useRef } from 'react';
import { api } from '@/lib/apiClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, MessageSquare, Send, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

export default function PlatformSupport() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const loadConversations = async () => {
    const { data, error } = await supabase
      .from('support_conversations')
      .select('*, organizations(name)')
      .order('updated_at', { ascending: false });
    if (!error) setConversations(data || []);
    setLoading(false);
  };

  const loadMessages = async (convId: string) => {
    const { data } = await supabase
      .from('support_messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });
    setMessages(data || []);
    setTimeout(() => scrollRef.current?.scrollTo({ top: 9999, behavior: 'smooth' }), 100);
  };

  useEffect(() => { loadConversations(); }, []);
  useEffect(() => {
    if (!selected) return;
    loadMessages(selected.id);

    const channel = supabase
      .channel(`platform-support-${selected.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `conversation_id=eq.${selected.id}` },
        () => loadMessages(selected.id)
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selected?.id]);

  const sendReply = async () => {
    if (!reply.trim() || !selected) return;
    setSending(true);
    try {
      await api.post('/platform/support/messages', { conversation_id: selected.id, message: reply.trim() });
      setReply(''); await loadMessages(selected.id);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    }
    setSending(false);
  };

  const closeTicket = async () => {
    try {
      await api.patch(`/platform/support/${selected.id}/close`);
      setSelected({ ...selected, status: 'closed' }); await loadConversations();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    }
  };

  if (loading) return <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary/40" /></div>;

  return (
    <div className="flex gap-4 h-[calc(100vh-20rem)]">
      {/* Conversation list */}
      <div className="w-72 shrink-0 flex flex-col gap-2 overflow-y-auto">
        {conversations.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No support tickets yet.</p>}
        {conversations.map(c => (
          <button key={c.id} onClick={() => setSelected(c)}
            className={cn('text-left p-3 rounded-xl border transition-all', selected?.id === c.id ? 'border-primary bg-primary/5' : 'border-border/50 hover:bg-accent/30')}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-semibold text-foreground truncate">{c.subject}</p>
              <Badge className={cn('text-[9px] shrink-0 ml-1', c.status === 'open' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600')}>
                {c.status}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{(c.organizations as any)?.name}</p>
            <p className="text-[10px] text-muted-foreground/60 mt-1">{new Date(c.created_at).toLocaleDateString()}</p>
          </button>
        ))}
      </div>

      {/* Chat area */}
      <Card className="flex-1 flex flex-col border-border/50 overflow-hidden">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">Select a conversation</div>
        ) : (
          <>
            <CardHeader className="pb-3 border-b border-border/50 flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">{selected.subject}</CardTitle>
                <p className="text-xs text-muted-foreground">{(selected.organizations as any)?.name}</p>
              </div>
              {selected.status === 'open' && (
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={closeTicket}>
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Close Ticket
                </Button>
              )}
            </CardHeader>
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map(m => (
                <div key={m.id} className={cn('flex', m.is_platform ? 'justify-end' : 'justify-start')}>
                  <div className={cn('max-w-xs rounded-2xl px-4 py-2.5 text-sm', m.is_platform ? 'bg-primary text-primary-foreground rounded-br-none' : 'bg-muted text-foreground rounded-bl-none')}>
                    <p>{m.message}</p>
                    <p className={cn('text-[10px] mt-1', m.is_platform ? 'text-primary-foreground/60' : 'text-muted-foreground')}>
                      {m.is_platform ? 'Platform Team' : 'Customer'} · {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            {selected.status === 'open' && (
              <div className="p-3 border-t border-border/50 flex gap-2">
                <Input value={reply} onChange={e => setReply(e.target.value)} placeholder="Type a reply..."
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendReply()} />
                <Button size="icon" onClick={sendReply} disabled={!reply.trim() || sending}>
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
