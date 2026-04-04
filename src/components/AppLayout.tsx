import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard, Users, FolderKanban, CheckSquare, MessageSquare,
  FileText, CreditCard, UserCog, Bell, LogOut, ChevronLeft, Menu
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { users } from '@/data/mock';

const adminNav = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { label: 'Clients', icon: Users, path: '/clients' },
  { label: 'Projects', icon: FolderKanban, path: '/projects' },
  { label: 'Tasks', icon: CheckSquare, path: '/tasks' },
  { label: 'Messages', icon: MessageSquare, path: '/messages' },
  { label: 'Invoices', icon: CreditCard, path: '/invoices' },
  { label: 'Files', icon: FileText, path: '/files' },
  { label: 'Team', icon: UserCog, path: '/team' },
];

const clientNav = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { label: 'Projects', icon: FolderKanban, path: '/projects' },
  { label: 'Messages', icon: MessageSquare, path: '/messages' },
  { label: 'Invoices', icon: CreditCard, path: '/invoices' },
  { label: 'Files', icon: FileText, path: '/files' },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, switchUser } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!user) return null;

  const nav = user.role === 'client' ? clientNav : adminNav;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-foreground/20 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        'fixed md:static z-50 flex flex-col h-full border-r border-border bg-sidebar transition-all duration-200',
        collapsed ? 'w-16' : 'w-60',
        mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      )}>
        {/* Logo */}
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          {!collapsed && <span className="text-base font-semibold text-foreground">Aurix</span>}
          <button onClick={() => setCollapsed(!collapsed)} className="hidden md:flex p-1 rounded hover:bg-accent text-muted-foreground">
            <ChevronLeft className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {nav.map(item => {
            const active = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                  active ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User switcher (demo) */}
        <div className="border-t border-border p-3">
          {!collapsed && (
            <select
              value={user.id}
              onChange={e => switchUser(e.target.value)}
              className="w-full text-xs bg-accent text-accent-foreground rounded px-2 py-1.5 border border-border mb-2"
            >
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
              ))}
            </select>
          )}
          <button
            onClick={logout}
            className="flex items-center gap-2 w-full rounded px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span>Log out</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-14 items-center justify-between border-b border-border px-4 md:px-6 bg-background">
          <button onClick={() => setMobileOpen(true)} className="md:hidden p-1 text-muted-foreground">
            <Menu className="h-5 w-5" />
          </button>
          <div className="text-sm font-medium text-foreground">
            {nav.find(n => n.path === '/' ? location.pathname === '/' : location.pathname.startsWith(n.path))?.label || 'Aurix'}
          </div>
          <div className="flex items-center gap-3">
            <button className="relative p-1 text-muted-foreground hover:text-foreground">
              <Bell className="h-5 w-5" />
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary" />
            </button>
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
              {user.name.split(' ').map(n => n[0]).join('')}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
