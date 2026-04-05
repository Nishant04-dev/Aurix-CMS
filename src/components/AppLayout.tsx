import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/use-permissions';
import { usePlan } from '@/hooks/use-plan';
import type { FeatureKey } from '@/lib/plans';
import {
  LayoutDashboard, Users, FolderKanban, CheckSquare, MessageSquare,
  FileText, CreditCard, UserCog, LogOut, ChevronLeft, Menu, User as UserIcon, ShieldCheck, Globe, Settings, Mail,
  ClipboardList, Hash, Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import NotificationsPanel from '@/components/NotificationsPanel';
import { Button } from './ui/button';

// Nav items — planFeature gates visibility by subscription plan
const NAV_ITEMS = [
  { label: 'Dashboard',  icon: LayoutDashboard, path: '/',                  perm: null,            superAdminOnly: false, planFeature: null },
  { label: 'Clients',    icon: Users,            path: '/clients',           perm: 'view_client',   superAdminOnly: false, planFeature: 'clients_limited' as FeatureKey },
  { label: 'Projects',   icon: FolderKanban,     path: '/projects',          perm: 'view_project',  superAdminOnly: false, planFeature: null },
  { label: 'Tasks',      icon: CheckSquare,      path: '/tasks',             perm: 'view_project',  superAdminOnly: false, planFeature: null },
  { label: 'Messages',   icon: MessageSquare,    path: '/messages',          perm: 'view_project',  superAdminOnly: false, planFeature: null },
  { label: 'Invoices',   icon: CreditCard,       path: '/invoices',          perm: 'view_invoices', superAdminOnly: false, planFeature: 'invoices_basic' as FeatureKey },
  { label: 'Files',      icon: FileText,         path: '/files',             perm: 'view_file',     superAdminOnly: false, planFeature: 'files' as FeatureKey },
  { label: 'Team',       icon: UserCog,          path: '/team',              perm: 'invite_user',   superAdminOnly: false, planFeature: 'team_limited' as FeatureKey },
  { label: 'Roles',      icon: ShieldCheck,      path: '/roles',             perm: 'manage_roles',  superAdminOnly: false, planFeature: 'roles_basic' as FeatureKey },
  { label: 'Invitations',icon: Mail,             path: '/invitations',       perm: null,            superAdminOnly: false, planFeature: null },
  { label: 'Team Chat',  icon: Hash,             path: '/org/chat',          perm: null,            superAdminOnly: false, planFeature: 'team_chat' as FeatureKey },
  { label: 'Audit Logs', icon: ClipboardList,    path: '/org/audit-logs',    perm: null,            superAdminOnly: false, adminOnly: true, planFeature: 'audit_logs_limited' as FeatureKey },
  { label: 'Platform',   icon: Globe,            path: '/platform/overview', perm: null,            superAdminOnly: true,  planFeature: null },
  { label: 'Settings',   icon: Settings,         path: '/settings',          perm: null,            superAdminOnly: false, planFeature: null },
  { label: 'Billing',    icon: CreditCard,       path: '/settings/billing',  perm: null,            superAdminOnly: false, planFeature: null },
  { label: 'Profile',    icon: UserIcon,         path: '/profile',           perm: null,            superAdminOnly: false, planFeature: null },
  { label: 'Support',    icon: MessageSquare,    path: '/support',           perm: null,            superAdminOnly: false, planFeature: null },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, isPlatformOwner, accountType } = useAuth();
  const { can } = usePermissions();
  const { can: planCan, planName } = usePlan();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!user) return null;

  // Filter nav items by permission + platform owner + plan
  const nav = NAV_ITEMS.filter(item => {
    if (item.superAdminOnly && !isPlatformOwner) return false;
    if ((item as any).adminOnly && !['admin','super_admin'].includes(user?.role ?? '')) return false;
    if (item.planFeature && !planCan(item.planFeature)) return false;
    if (!item.perm) return true;
    return can(item.perm);
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
            // Add separator before Platform
            const showSeparator = item.path === '/platform' && idx > 0;
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
                      : item.path === '/platform'
                        ? 'text-violet-600 hover:bg-violet-50 hover:text-violet-700'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <item.icon className={cn('h-[18px] w-[18px] shrink-0 transition-colors',
                    active ? 'text-primary-foreground'
                    : item.path === '/platform' ? 'text-violet-500'
                    : 'text-muted-foreground group-hover:text-foreground'
                  )} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
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
                {accountType === 'user'
                  ? 'User'
                  : user.role === 'super_admin' ? 'Super Admin'
                  : user.role === 'admin' ? 'Business Owner'
                  : user.role === 'manager' ? 'Manager'
                  : user.role === 'developer' ? 'Developer'
                  : user.role === 'support' ? 'Support'
                  : 'Team Member'
                }
              </div>
              <div className="mt-1 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 uppercase tracking-wider">
                {planName}
              </div>
            </div>
          )}
          {/* Upgrade CTA — only for free/pro plans, not enterprise */}
          {!collapsed && planName !== 'Enterprise' && (
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
