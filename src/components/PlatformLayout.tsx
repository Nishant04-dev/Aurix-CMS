import React from 'react';
import { Link, useLocation, Navigate } from 'react-router-dom';
import { usePlatformPermissions } from '@/hooks/use-platform-permissions';
import {
  LayoutDashboard, Building2, Users, CreditCard, DollarSign,
  Zap, UserCog, MessageSquare, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const PLATFORM_NAV = [
  { label: 'Overview',       path: '/platform/overview',       icon: LayoutDashboard, perm: null },
  { label: 'Organizations',  path: '/platform/organizations',  icon: Building2,       perm: 'view_orgs' },
  { label: 'Users',          path: '/platform/users',          icon: Users,           perm: 'manage_users' },
  { label: 'Subscriptions',  path: '/platform/subscriptions',  icon: CreditCard,      perm: 'manage_subscriptions' },
  { label: 'Revenue',        path: '/platform/revenue',        icon: DollarSign,      perm: 'view_revenue' },
  { label: 'Features',       path: '/platform/features',       icon: Zap,             perm: 'manage_features' },
  { label: 'Team',           path: '/platform/team',           icon: UserCog,         perm: 'manage_platform_team' },
  { label: 'Support',        path: '/platform/support',        icon: MessageSquare,   perm: 'view_support' },
];

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { hasPlatformAccess, can, role } = usePlatformPermissions();

  if (!hasPlatformAccess) return <Navigate to="/" replace />;

  const visibleNav = PLATFORM_NAV.filter(item => !item.perm || can(item.perm));

  return (
    <div className="space-y-6">
      {/* Platform header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-violet-100 flex items-center justify-center">
            <LayoutDashboard className="h-4 w-4 text-violet-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Platform Control</h1>
            <p className="text-xs text-muted-foreground">Global system management</p>
          </div>
        </div>
        {role && (
          <Badge className="bg-violet-100 text-violet-700 border-violet-200">
            {role.name}
          </Badge>
        )}
      </div>

      {/* Sub-nav tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-border/50">
        {visibleNav.map(item => {
          const active = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg whitespace-nowrap transition-all border-b-2 -mb-px',
                active
                  ? 'text-violet-700 border-violet-600 bg-violet-50/50'
                  : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-accent/50'
              )}
            >
              <item.icon className="h-3.5 w-3.5" />
              {item.label}
            </Link>
          );
        })}
      </div>

      {/* Page content */}
      <div>{children}</div>
    </div>
  );
}
