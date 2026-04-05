import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useMessages, useSendMessage, useTeamMembers, useClients, useProjects } from '@/hooks/use-database';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, Loader2, User as UserIcon, Building2, Hash, Clock, AlertTriangle, Ban } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import type { Message } from '@/types';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface ChannelInfo {
  id: string;
  name: string;
  type: 'project';
  status?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
}

export default function Messages() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: projects } = useProjects();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [channels, setChannels] = useState<ChannelInfo[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch last message for each project to sort channels
  useEffect(() => {
    const fetchChannelInfo = async () => {
      if (!projects?.length) return;
      
      const projectIds = projects.map(p => p.id);
      
      // Get last message for each project
      const { data: lastMessages } = await supabase
        .from('messages')
        .select('id, content, created_at, project_id')
        .in('project_id', projectIds)
        .order('created_at', { ascending: false });
      
      // Create a map of project_id -> last message
      const lastMsgMap = new Map<string, { content: string; time: string }>();
      if (lastMessages) {
        lastMessages.forEach(msg => {
          if (!lastMsgMap.has(msg.project_id)) {
            lastMsgMap.set(msg.project_id, {
              content: msg.content,
              time: msg.created_at
            });
          }
        });
      }
      
      // Build channel list with last message info, sorted by time
      const channelList: ChannelInfo[] = projects
        .map(p => ({
          id: p.id,
          name: p.title,
          type: 'project' as const,
          status: p.status,
          lastMessage: lastMsgMap.get(p.id)?.content,
          lastMessageTime: lastMsgMap.get(p.id)?.time
        }))
        .sort((a, b) => {
          if (!a.lastMessageTime && !b.lastMessageTime) return 0;
          if (!a.lastMessageTime) return 1;
          if (!b.lastMessageTime) return -1;
          return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
        });
      
      setChannels(channelList);
    };
    
    fetchChannelInfo();
  }, [projects]);

  // Real-time subscription for project status changes
  useEffect(() => {
    const channel = supabase
      .channel('projects-status-realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'projects'
        },
        (payload) => {
          // Update channel status when project status changes
          setChannels(prev => 
            prev.map(ch => 
              ch.id === payload.new.id 
                ? { ...ch, status: payload.new.status }
                : ch
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const activeProjectId = selectedProjectId || channels[0]?.id || '';
  const activeChannel = channels.find(c => c.id === activeProjectId);
  const isProjectCancelled = activeChannel?.status === 'cancelled';
  const canSendMessage = !isProjectCancelled || isAdmin;

  // Only fetch messages for the currently selected project
  const { data: messages, isLoading } = useMessages(activeProjectId);
  const sendMessage = useSendMessage();
  const [input, setInput] = useState('');
  const { toast } = useToast();

  // Realtime subscription
  useEffect(() => {
    if (!user || !activeProjectId) return;

    const channel = supabase
      .channel('messages-realtime')
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'messages'
        },
        (payload) => {
          // Check if message belongs to current active project
          if (payload.new.project_id !== activeProjectId) return;

          // Invalidate messages query
          queryClient.invalidateQueries({ queryKey: ['messages', user.id, activeProjectId] });
          
          // Update channel list with new message
          setChannels(prev => {
            return prev.map(ch => {
              if (ch.id === payload.new.project_id) {
                return {
                  ...ch,
                  lastMessage: payload.new.content,
                  lastMessageTime: payload.new.created_at
                };
              }
              return ch;
            }).sort((a, b) => {
              if (!a.lastMessageTime && !b.lastMessageTime) return 0;
              if (!a.lastMessageTime) return 1;
              if (!b.lastMessageTime) return -1;
              return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
            });
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, activeProjectId, queryClient]);

  // Scroll to bottom on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, activeProjectId]);

  if (!user) return null;

  const conversation = messages || [];

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || !activeProjectId) return;
    
    // Check if project is cancelled (backend safety)
    if (isProjectCancelled && !isAdmin) {
      toast({ variant: 'destructive', title: 'Project Cancelled', description: 'Cannot send messages to a cancelled project. Please contact admin.' });
      return;
    }
    
    const content = input.trim();
    setInput(''); // Optimistically clear input
    try {
      await sendMessage.mutateAsync({
        projectId: activeProjectId,
        content: content
      });
    } catch (error: any) {
      console.error('Failed to send message:', error);
      // Check if error is about cancelled project (case insensitive)
      const errorMsg = error?.message?.toLowerCase() || '';
      if (errorMsg.includes('cancelled') || errorMsg.includes('messaging disabled')) {
        toast({ variant: 'destructive', title: 'Project Cancelled', description: 'Cannot send messages to a cancelled project. Please contact admin.' });
      } else {
        toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to send message' });
      }
      // Restore input if failed
      setInput(content);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
         <h1 className="text-3xl font-bold tracking-tight text-foreground">Communications</h1>
         <p className="text-muted-foreground mt-1 text-sm font-medium">Real-time collaboration with team members and clients.</p>
      </div>

      <div className="flex border border-border/50 rounded-2xl overflow-hidden h-[calc(100vh-16rem)] bg-card shadow-sm">
        {/* Conversation list */}
        <div className="w-80 border-r border-border/50 shrink-0 flex flex-col bg-muted/5">
            <div className="p-4 border-b border-border/50">
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary/60 mb-3 px-2">Project Channels</p>
              <div className="space-y-1">
                {channels.map(item => {
                  const isActive = activeProjectId === item.id;
                  const formatTime = (time?: string) => {
                    if (!time) return '';
                    const date = new Date(time);
                    const now = new Date();
                    const diff = now.getTime() - date.getTime();
                    const hours = diff / (1000 * 60 * 60);
                    if (hours < 24) {
                      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    }
                    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
                  };
                  return (
                    <button
                      key={item.id}
                      onClick={() => setSelectedProjectId(item.id)}
                      className={cn(
                        'w-full text-left px-3 py-2.5 rounded-lg transition-all group flex items-start gap-2.5',
                        isActive ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50 text-foreground',
                        item.status === 'cancelled' && !isActive && 'opacity-60'
                      )}
                    >
                      <Hash className={cn('h-4 w-4 mt-0.5 shrink-0', isActive ? 'text-primary' : item.status === 'cancelled' ? 'text-destructive/50' : 'text-muted-foreground/50')} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold truncate">{item.name}</p>
                          {item.status === 'cancelled' && (
                            <Ban className="h-3 w-3 text-destructive shrink-0" />
                          )}
                          {item.lastMessageTime && item.status !== 'cancelled' && (
                            <span className="text-[9px] text-muted-foreground/50 shrink-0">
                              {formatTime(item.lastMessageTime)}
                            </span>
                          )}
                        </div>
                        {item.lastMessage && item.status !== 'cancelled' && (
                          <p className="text-[10px] text-muted-foreground/70 truncate mt-0.5">
                            {item.lastMessage}
                          </p>
                        )}
                        {item.status === 'cancelled' && (
                          <p className="text-[10px] text-destructive/60 truncate mt-0.5">Project cancelled</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col bg-background/50">
          {activeChannel ? (
            <>
              {/* Chat Header */}
              <div className="px-6 py-4 border-b border-border/50 flex items-center justify-between bg-card/10 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
                    <Hash size={16} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-foreground leading-none">{activeChannel.name}</p>
                      {activeChannel.status === 'cancelled' && (
                        <Badge variant="destructive" className="text-[9px] px-2 py-0">
                          <Ban className="h-3 w-3 mr-1" /> Cancelled
                        </Badge>
                      )}
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-primary/60 mt-1">
                      Project Channel
                    </p>
                  </div>
                </div>
              </div>

              {/* Message History */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth">
                {conversation.length === 0 && (
                   <div className="h-full flex flex-col items-center justify-center space-y-4 opacity-40 py-20">
                     <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center border-2 border-dashed border-border/50">
                       <Send size={24} className="text-muted-foreground" />
                     </div>
                     <p className="text-sm font-medium italic">Start a new conversation in {activeChannel.name}</p>
                   </div>
                )}
                {conversation.map(msg => {
                  const isOwn = msg.senderId === user.id;
                  const senderName = isOwn ? 'You' : (msg.senderProfile?.name || 'User');
                  const avatarUrl = isOwn 
                    ? (msg.senderProfile?.avatarUrl || user.avatar || '/placeholder.svg')
                    : (msg.senderProfile?.avatarUrl || '/placeholder.svg');
                    
                  // If we use initials:
                  const initials = senderName.split(' ').map(n=>n[0]).join('').substring(0, 2).toUpperCase();

                  return (
                    <div key={msg.id} className={cn('flex items-end gap-2 mb-4', isOwn ? 'justify-end' : 'justify-start')}>
                      
                      {/* Avatar (LEFT for others) */}
                      {!isOwn && (
                        <div title={senderName} className="w-8 h-8 rounded-full overflow-hidden bg-muted flex items-center justify-center shrink-0 border border-border/50 text-xs font-bold font-mono">
                           {avatarUrl && avatarUrl !== '/placeholder.svg' ? <img src={avatarUrl} alt={senderName} className="w-full h-full object-cover" /> : initials}
                        </div>
                      )}

                      <div className={cn("flex flex-col", isOwn ? "items-end" : "items-start")}>
                        {/* Name */}
                        {!isOwn && (
                          <p className="text-[10px] text-muted-foreground font-bold mb-1 ml-1">
                            {senderName}
                          </p>
                        )}
                        
                        <div className={cn(
                          'max-w-md rounded-2xl px-4 py-2.5 shadow-sm border',
                          isOwn 
                            ? 'bg-primary text-primary-foreground border-primary rounded-br-none rounded-tr-xl pr-5' 
                            : 'bg-card text-foreground border-border/50 rounded-bl-none rounded-tl-xl shadow-sm'
                        )}>
                          <p className="text-sm leading-relaxed">{msg.content}</p>
                          <p className={cn(
                            'text-[10px] mt-2 font-mono flex items-center font-bold',
                            isOwn ? 'justify-end text-primary-foreground/50' : 'justify-start text-muted-foreground/40'
                          )}>
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>

                      {/* Avatar (RIGHT for self) */}
                      {isOwn && (
                        <div title={senderName} className="w-8 h-8 rounded-full overflow-hidden bg-primary/20 text-primary flex items-center justify-center shrink-0 border border-primary/30 text-xs font-bold font-mono">
                           {avatarUrl && avatarUrl !== '/placeholder.svg' ? <img src={avatarUrl} alt={senderName} className="w-full h-full object-cover" /> : initials}
                        </div>
                      )}

                    </div>
                  );
                })}
              </div>

              {/* Input Area */}
              {isProjectCancelled && !isAdmin ? (
                <div className="p-4 border-t border-border/50 bg-destructive/10">
                  <div className="flex items-center justify-center gap-2 text-destructive text-sm font-medium p-4 bg-destructive/20 rounded-lg border border-destructive/30">
                    <Ban className="h-4 w-4" />
                    This project has been cancelled. Please contact admin for further assistance.
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSend} className="p-4 border-t border-border/50 bg-card/10 backdrop-blur-md">
                  <div className="flex gap-3 bg-muted/30 p-2 rounded-xl border border-border/30 focus-within:bg-muted/50 focus-within:border-primary/20 transition-all">
                    <Input 
                      placeholder="Write a message..." 
                      value={input} 
                      onChange={e => setInput(e.target.value)} 
                      className="flex-1 border-0 bg-transparent focus-visible:ring-0 shadow-none px-2" 
                    />
                    <Button 
                      type="submit"
                      size="icon" 
                      disabled={!input.trim() || sendMessage.isPending}
                      className="rounded-lg shadow-elevation-low transition-transform active:scale-95"
                    >
                      {sendMessage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                </form>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-4 opacity-50">
               <div className="relative">
                  <div className="h-24 w-24 rounded-full bg-accent/20 flex items-center justify-center border-2 border-border/30 animate-pulse" />
                  <Send className="absolute bottom-6 right-6 h-12 w-12 text-primary/40 -rotate-12" />
               </div>
               <div className="space-y-1">
                 <h3 className="text-lg font-bold">Secure Communication</h3>
                 <p className="text-xs max-w-xs text-muted-foreground leading-relaxed">
                   Select a contact from the left sidebar to start collaborating securely on your projects.
                 </p>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
