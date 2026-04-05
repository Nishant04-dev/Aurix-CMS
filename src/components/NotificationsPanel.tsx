import React from 'react';
import { useNotifications } from '@/hooks/use-database';
import { useAuth } from '@/contexts/AuthContext';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function NotificationsPanel() {
  const { user } = useAuth();
  const { data: userNotifications, isLoading } = useNotifications();
  const unreadCount = userNotifications?.filter(n => !n.read).length || 0;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button className="relative p-1 text-muted-foreground hover:text-foreground transition-colors group">
          <Bell className="h-5 w-5 transition-transform group-hover:scale-110" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[9px] flex items-center justify-center font-bold animate-in zoom-in duration-300">
              {unreadCount}
            </span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent className="w-[360px] sm:w-[400px] border-l border-border/50 shadow-2xl">
        <SheetHeader className="pb-4 border-b border-border/10">
          <SheetTitle className="text-lg font-bold tracking-tight">Activity Feed</SheetTitle>
        </SheetHeader>
        
        <div className="mt-6 flex flex-col h-[calc(100vh-8rem)]">
          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3 opacity-40">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-xs font-bold uppercase tracking-widest">Retrieving Updates</p>
            </div>
          ) : !userNotifications || userNotifications.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20 gap-4 opacity-30">
               <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center border-2 border-dashed border-border/50">
                 <BellOff size={24} />
               </div>
               <p className="text-sm font-medium italic">You're all caught up!</p>
            </div>
          ) : (
            <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar">
              {userNotifications.map(n => (
                <div key={n.id} className={cn('flex items-start gap-4 rounded-xl px-4 py-4 transition-all border border-transparent hover:border-border/40 hover:bg-muted/30 group', !n.read && 'bg-primary/[0.03] border-primary/5')}>
                  <div className={cn('mt-1.5 h-2 w-2 rounded-full shrink-0 transition-all', n.read ? 'bg-muted-foreground/20' : 'bg-primary shadow-[0_0_8px_rgba(var(--primary),0.4)]')} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground leading-tight group-hover:text-primary transition-colors">{n.title}</p>
                    <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{n.message}</p>
                    <p className="text-[10px] text-muted-foreground/50 mt-3 font-mono font-bold uppercase tracking-tighter">
                      {n.createdAt ? new Date(n.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Recently'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
