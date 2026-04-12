import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePlan } from '@/hooks/use-plan';
import { useOrgSettings } from '@/hooks/use-org-settings';
import { OrgSwitcher } from '@/components/OrgSwitcher';
import { canAccess, ROLE_LABELS, normalizeRole } from '@/lib/accessControl';
import type { FeatureKey } from '@/lib/plans';
import {
  LayoutDashboard, Users, FolderKanban, CheckSquare, MessageSquare,
  FileText, CreditCard, UserCog, LogOut, ChevronLeft, Menu, User as UserIcon, ShieldCheck, Globe, Settings, Mail,
  ClipboardList, Hash, Zap, Lock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import NotificationsPanel from '@/components/NotificationsPanel';
import { Button } from './ui/button';

// Nav items — roleAccess uses canonical roles (super_admin/admin/member/client).
// null = visible to all authenticated users with an org.
// planFeature = show locked icon if plan doesn't include it (never hide).
const NAV_ITEMS = [
  { label: 'Dashboard',  icon: LayoutDashboard, path: '/',                  planFeature: null,                            roleAccess: null },
  { label: 'Clients',    icon: Users,            path: '/clients',           planFeature: 'clients_limited' as FeatureKey, roleAccess: ['super_admin','admin','member'] },
  { label: 'Projects',   icon: FolderKanban,     path: '/projects',          planFeature: null,                            roleAccess: ['super_admin','admin','member'] },
  { label: 'Tasks',      icon: CheckSquare,      path: '/tasks',             planFeature: null,                            roleAccess: ['super_admin','admin','member'] },
  { label: 'Messages',   icon: MessageSquare,    path: '/messages',          planFeature: null,                            roleAccess: null },
  { label: 'Invoices',   icon: CreditCard,       path: '/invoices',          planFeature: 'invoices_basic' as FeatureKey,  roleAccess: null },
  { label: 'Quotations', icon: FileText,         path: '/quotations',        planFeature: null,                            roleAccess: ['super_admin','admin','member','client'] },
  { label: 'Files',      icon: FileText,         path: '/files',             planFeature: 'files' as FeatureKey,           roleAccess: ['super_admin','admin','member'] },
  { label: 'Team',       icon: UserCog,          path: '/team',              planFeature: 'team_limited' as FeatureKey,    roleAccess: ['super_admin','admin','member'] },
  { label: 'Roles',      icon: ShieldCheck,      path: '/roles',             planFeature: null,                            roleAccess: ['super_admin','admin'] },
  { label: 'Invitations',icon: Mail,             path: '/invitations',       planFeature: null,                            roleAccess: null },
  { label: 'Team Chat',  icon: Hash,             path: '/org/chat',          planFeature: 'team_chat' as FeatureKey,       roleAccess: null },
  { label: 'Audit Logs', icon: ClipboardList,    path: '/org/audit-logs',    planFeature: 'audit_logs_limited' as FeatureKey, roleAccess: ['super_admin','admin'] },
  { label: 'Platform',   icon: Globe,            path: '/platform/overview', planFeature: null,                            roleAccess: null, platformOwnerOnly: true },
  { label: 'Settings',   icon: Settings,         path: '/settings',          planFeature: null,                            roleAccess: ['super_admin','admin'] },
  { label: 'Billing',    icon: CreditCard,       path: '/settings/billing',  planFeature: null,                            roleAccess: ['super_admin','admin'], businessOnly: true },
  { label: 'Profile',    icon: UserIcon,         path: '/profile',           planFeature: null,                            roleAccess: null },
  { label: 'Support',    icon: MessageSquare,    path: '/support',           planFeature: null,                            roleAccess: null },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, isPlatformOwner, accountType } = useAuth();
  const { can: planCan, planName } = usePlan();
  const { settings: orgSettings } = useOrgSettings();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!user) return null;

  const role = user?.role ?? 'client';
  const normalized = normalizeRole(role);
  const isOwner  = normalized === 'super_admin' || isPlatformOwner;
  const isClient = normalized === 'client';

  // Filter nav items using the centralized access matrix
  const nav = NAV_ITEMS.filter(item => {
    if ((item as any).platformOwnerOnly && !isPlatformOwner) return false;
    if ((item as any).businessOnly && accountType !== 'business') return false;
    // roleAccess: null = visible to all authenticated users
    if (item.roleAccess && !isPlatformOwner) {
      // Check if any of the item's allowed roles match the normalized role
      const allowed = item.roleAccess as string[];
      if (!allowed.includes(normalized)) return false;
    }
    return true;
  });

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-foreground/20 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        'fixed md:static z-50 flex flex-col h-full border-r border-border bg-card transition-all duration-300 ease-in-out shadow-sm',
        collapsed ? 'w-16' : 'w-64',
        mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      )}>
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b border-border/50 px-4">
          {!collapsed && (
            <div className="flex items-center gap-2 font-bold text-xl tracking-tight text-primary">
              <div className="h-2.5 w-2.5 rounded-full bg-primary" />
              <span>Aurix</span>
            </div>
          )}
          {collapsed && (
             <div className="mx-auto h-2.5 w-2.5 rounded-full bg-primary" />
          )}
          <button onClick={() => setCollapsed(!collapsed)} className="hidden md:flex p-1.5 rounded-lg hover:bg-accent text-muted-foreground transition-all duration-200">
            <ChevronLeft className={cn('h-4 w-4 transition-transform duration-300', collapsed && 'rotate-180')} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {nav.map((item, idx) => {
            const active = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            const showSeparator = item.path === '/platform/overview' && idx > 0;
            // Item is locked if plan doesn't support it (for any role)
            const isPlanLocked = !!(item.planFeature && !planCan(item.planFeature as FeatureKey));
            return (
              <React.Fragment key={item.path}>
                {showSeparator && <div className="my-2 border-t border-border/50" />}
                <Link
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                    active
                      ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                      : item.path === '/platform/overview'
                        ? 'text-violet-600 hover:bg-violet-50 hover:text-violet-700'
                        : isPlanLocked
                          ? 'text-muted-foreground/50 hover:bg-accent hover:text-accent-foreground'
                          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <item.icon className={cn('h-[18px] w-[18px] shrink-0 transition-colors',
                    active ? 'text-primary-foreground'
                    : item.path === '/platform/overview' ? 'text-violet-500'
                    : 'text-muted-foreground group-hover:text-foreground'
                  )} />
                  {!collapsed && <span className="truncate flex-1">{item.label}</span>}
                  {!collapsed && isPlanLocked && (
                    <Lock className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                  )}
                </Link>
              </React.Fragment>
            );
          })}
        </nav>

        {/* Footer info & Logout */}
        <div className="border-t border-border/50 p-4 space-y-3">
          {!collapsed && (
            <div className="px-3 py-2 rounded-lg bg-accent/30 border border-border/10">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Active Account</div>
              <div className="text-sm font-semibold truncate text-foreground">{user.name}</div>
              <div className="text-[11px] text-muted-foreground truncate">{user.email}</div>
              <div className="mt-1 inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary capitalize">
                {ROLE_LABELS[role] ?? 'Member'}
              </div>
              {/* Plan badge — only visible to owners/admins */}
              {isOwner && (
                <div className="mt-1 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 uppercase tracking-wider">
                  {planName}
                </div>
              )}
            </div>
          )}
          {/* Upgrade CTA — only for owners/admins on free/pro plans */}
          {!collapsed && accountType === 'business' && isOwner && planName !== 'Enterprise' && (
            <Link
              to="/settings/billing"
              className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-colors"
            >
              <Zap className="h-3.5 w-3.5 shrink-0" />
              {planName === 'Free' ? 'Upgrade to Pro' : 'Upgrade to Enterprise'}
            </Link>
          )}
          <Button
            variant="ghost"
            onClick={handleLogout}
            className={cn(
              "flex items-center gap-3 w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-all duration-200",
              collapsed ? "px-2" : "px-3"
            )}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="font-medium">Sign Out</span>}
          </Button>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-16 items-center justify-between border-b border-border/50 px-4 md:px-8 bg-background/80 backdrop-blur-md sticky top-0 z-10 transition-shadow duration-300">
          <div className="flex items-center gap-4">
            <button onClick={() => setMobileOpen(true)} className="md:hidden p-2 rounded-lg text-muted-foreground hover:bg-accent">
              <Menu className="h-5 w-5" />
            </button>
            <div className="text-sm font-semibold text-foreground tracking-tight flex items-center gap-2">
              <span className="text-muted-foreground font-normal">/</span>
              {nav.find(n => n.path === '/' ? location.pathname === '/' : location.pathname.startsWith(n.path))?.label || (location.pathname === '/profile' ? 'Profile' : location.pathname === '/settings' ? 'Settings' : 'Aurix')}
            </div>
            <OrgSwitcher />
          </div>
          
          <div className="flex items-center gap-4">
            <NotificationsPanel />
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10 flex items-center justify-center text-xs font-bold text-primary shadow-sm">
              {user.name ? user.name.split(' ').map(n => n[0]).join('') : '??'}
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-[#FAFBFC] custom-scrollbar">
          <div className="mx-auto max-w-7xl animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
