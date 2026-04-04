import React from 'react';
import { notifications, users } from '@/data/mock';
import { useAuth } from '@/contexts/AuthContext';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Bell } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function NotificationsPanel() {
  const { user } = useAuth();
  const userNotifications = notifications.filter(n => n.userId === user?.id);
  const unreadCount = userNotifications.filter(n => !n.read).length;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button className="relative p-1 text-muted-foreground hover:text-foreground transition-colors">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-medium">
              {unreadCount}
            </span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent className="w-[360px] sm:w-[400px]">
        <SheetHeader>
          <SheetTitle className="text-base font-semibold">Notifications</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-1">
          {userNotifications.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No notifications</p>
          ) : (
            userNotifications.map(n => (
              <div key={n.id} className={cn('flex items-start gap-3 rounded-md px-3 py-3 transition-colors', !n.read && 'bg-primary/5')}>
                <div className={cn('mt-1.5 h-2 w-2 rounded-full shrink-0', n.read ? 'bg-muted-foreground/20' : 'bg-primary')} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{n.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {new Date(n.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
