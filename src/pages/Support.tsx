import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, MessageSquare, Plus, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function Support() {
  const { user, orgId, isPlatformOwner } = useAuth();

  // Platform owner/team should use the platform support panel
  if (isPlatformOwner) return <Navigate to="/platform/support" replace />;
  const [conversations, setConversations] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMsg, setNewMsg] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [subject, setSubject] = useState('');
  const [firstMsg, setFirstMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const loadConversations = async () => {
    if (!orgId) return;
    const { data } = await supabase
      .from('support_conversations')
      .select('*')
      .eq('org_id', orgId)
      .order('updated_at', { ascending: false });
    setConversations(data || []);
    setLoading(false);
  };

  const loadMessages = async (convId: string) => {
    const { data, error } = await supabase
      .from('support_messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });
    setMessages(data || []);
    setTimeout(() => scrollRef.current?.scrollTo({ top: 9999, behavior: 'smooth' }), 100);
  };

  useEffect(() => { loadConversations(); }, [orgId]);
  useEffect(() => {
    if (!selected) return;
    loadMessages(selected.id);

    // Real-time: new messages appear instantly
    const channel = supabase
      .channel(`support-${selected.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `conversation_id=eq.${selected.id}` },
        () => loadMessages(selected.id)
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selected?.id]);

  const createTicket = async () => {
    if (!subject.trim() || !firstMsg.trim() || !orgId) return;
    setSending(true);
    const { data: conv, error: convErr } = await supabase
      .from('support_conversations')
      .insert({ org_id: orgId, created_by: user?.id, subject: subject.trim() })
      .select().single();
    if (convErr) { toast({ variant: 'destructive', title: 'Error', description: convErr.message }); setSending(false); return; }
    await supabase.from('support_messages').insert({
      conversation_id: conv.id, sender_id: user?.id, message: firstMsg.trim(), is_platform: false,
    });
    toast({ title: 'Ticket created', description: 'Our team will respond shortly.' });
    setShowNew(false); setSubject(''); setFirstMsg('');
    await loadConversations();
    setSelected(conv);
    setSending(false);
  };

  const sendMessage = async () => {
    if (!newMsg.trim() || !selected) return;
    setSending(true);
    const { error } = await supabase.from('support_messages').insert({
      conversation_id: selected.id, sender_id: user?.id, message: newMsg.trim(), is_platform: false,
    });
    if (error) toast({ variant: 'destructive', title: 'Error', description: error.message });
    else { setNewMsg(''); await loadMessages(selected.id); }
    setSending(false);
  };

  if (loading) return <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary/40" /></div>;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Support</h1>
          <p className="text-muted-foreground mt-1 text-sm">Get help from our platform team.</p>
        </div>
        <Button size="sm" onClick={() => setShowNew(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> New Ticket
        </Button>
      </div>

      <div className="flex gap-4 h-[calc(100vh-20rem)]">
        {/* Ticket list */}
        <div className="w-72 shrink-0 flex flex-col gap-2 overflow-y-auto">
          {conversations.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No tickets yet.</p>
              <p className="text-xs mt-1">Create one to get help.</p>
            </div>
          )}
          {conversations.map(c => (
            <button key={c.id} onClick={() => setSelected(c)}
              className={cn('text-left p-3 rounded-xl border transition-all', selected?.id === c.id ? 'border-primary bg-primary/5' : 'border-border/50 hover:bg-accent/30')}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-semibold text-foreground truncate">{c.subject}</p>
                <Badge className={cn('text-[9px] shrink-0 ml-1', c.status === 'open' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600')}>
                  {c.status}
                </Badge>
              </div>
              <p className="text-[10px] text-muted-foreground/60">{new Date(c.created_at).toLocaleDateString()}</p>
            </button>
          ))}
        </div>

        {/* Chat */}
        <Card className="flex-1 flex flex-col border-border/50 overflow-hidden">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">Select a ticket or create a new one</div>
          ) : (
            <>
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-sm font-semibold">{selected.subject}</CardTitle>
                <Badge className={cn('w-fit text-[9px]', selected.status === 'open' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600')}>
                  {selected.status}
                </Badge>
              </CardHeader>
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map(m => (
                  <div key={m.id} className={cn('flex', !m.is_platform ? 'justify-end' : 'justify-start')}>
                    <div className={cn('max-w-xs rounded-2xl px-4 py-2.5 text-sm', !m.is_platform ? 'bg-primary text-primary-foreground rounded-br-none' : 'bg-muted text-foreground rounded-bl-none')}>
                      <p>{m.message}</p>
                      <p className={cn('text-[10px] mt-1', !m.is_platform ? 'text-primary-foreground/60' : 'text-muted-foreground')}>
                        {m.is_platform ? 'Support Team' : 'You'} · {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              {selected.status === 'open' && (
                <div className="p-3 border-t border-border/50 flex gap-2">
                  <Input value={newMsg} onChange={e => setNewMsg(e.target.value)} placeholder="Type a message..."
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()} />
                  <Button size="icon" onClick={sendMessage} disabled={!newMsg.trim() || sending}>
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              )}
            </>
          )}
        </Card>
      </div>

      {/* New Ticket Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Create Support Ticket</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Brief description of your issue" />
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <textarea value={firstMsg} onChange={e => setFirstMsg(e.target.value)}
                placeholder="Describe your issue in detail..."
                className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button onClick={createTicket} disabled={!subject.trim() || !firstMsg.trim() || sending}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create Ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
