import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { messages as allMessages, users, clients, projects } from '@/data/mock';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Messages() {
  const { user } = useAuth();
  const [input, setInput] = useState('');

  if (!user) return null;

  // Group conversations
  const userMessages = allMessages.filter(m => m.senderId === user.id || m.recipientId === user.id);
  const conversationPartners = [...new Set(userMessages.map(m => m.senderId === user.id ? m.recipientId : m.senderId))];

  const [selectedPartner, setSelectedPartner] = useState(conversationPartners[0] || '');
  const conversation = userMessages
    .filter(m => m.senderId === selectedPartner || m.recipientId === selectedPartner)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-foreground">Messages</h1>

      <div className="flex border border-border rounded-lg overflow-hidden h-[calc(100vh-14rem)]">
        {/* Conversation list */}
        <div className="w-64 border-r border-border shrink-0 overflow-y-auto hidden sm:block">
          {conversationPartners.map(partnerId => {
            const partner = users.find(u => u.id === partnerId);
            const lastMsg = userMessages.filter(m => m.senderId === partnerId || m.recipientId === partnerId).slice(-1)[0];
            return (
              <button
                key={partnerId}
                onClick={() => setSelectedPartner(partnerId)}
                className={cn(
                  'w-full text-left px-4 py-3 border-b border-border transition-colors',
                  selectedPartner === partnerId ? 'bg-muted' : 'hover:bg-muted/50'
                )}
              >
                <p className="text-sm font-medium text-foreground">{partner?.name}</p>
                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{lastMsg?.content}</p>
              </button>
            );
          })}
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {conversation.map(msg => {
              const isOwn = msg.senderId === user.id;
              const sender = users.find(u => u.id === msg.senderId);
              return (
                <div key={msg.id} className={cn('flex', isOwn && 'justify-end')}>
                  <div className={cn('max-w-[70%] rounded-lg px-4 py-2', isOwn ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                    <p className={cn('text-xs font-medium mb-1', isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground')}>{sender?.name}</p>
                    <p className="text-sm">{msg.content}</p>
                    <p className={cn('text-[10px] mt-1', isOwn ? 'text-primary-foreground/50' : 'text-muted-foreground')}>
                      {new Date(msg.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-border p-3 flex gap-2">
            <Input placeholder="Type a message..." value={input} onChange={e => setInput(e.target.value)} className="flex-1" />
            <Button size="sm" disabled={!input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
