import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Building2, Users, CreditCard, DollarSign, Loader2, Activity,
  ArrowUpRight, Globe, Shield, Zap, ToggleLeft, Eye,
  CheckCircle2, XCircle, Clock, PauseCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface OrgRow {
  id: string;
  name: string;
  owner_email: string;
  plan: string;
  status: string;
  created_at: string;
  user_count: number;
}

interface PlatformStats {
  total_orgs: number;
  total_users: number;
  active_subs: number;
  total_revenue: number;
}

const PLAN_STYLES: Record<string, string> = {
  free:       'bg-slate-100 text-slate-600 border-slate-200',
  pro:        'bg-blue-50 text-blue-600 border-blue-100',
  enterprise: 'bg-violet-50 text-violet-600 border-violet-100',
};

const STATUS_STYLES: Record<string, string> = {
  approved:  'bg-emerald-50 text-emerald-600 border-emerald-200',
  pending:   'bg-amber-50 text-amber-600 border-amber-200',
  suspended: 'bg-orange-50 text-orange-600 border-orange-200',
  rejected:  'bg-rose-50 text-rose-600 border-rose-200',
};

function StatCard({ title, value, icon: Icon, accent, sub }: {
  title: string; value: string | number; icon: React.ElementType; accent?: string; sub?: string;
}) {
  return (
    <Card className="border-border/50 hover:shadow-md transition-all duration-300">
      <CardContent className="p-6">
        <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl mb-4', accent || 'bg-primary/10 text-primary')}>
          <Icon className="h-5 w-5" />
        </div>
        <p className="text-3xl font-bold tracking-tight text-foreground">{value}</p>
        <p className="text-sm font-medium text-muted-foreground mt-0.5">{title}</p>
        {sub && <p className="text-xs text-muted-foreground/60 mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function Platform() {
  const { user, isPlatformOwner } = useAuth();
  const { toast } = useToast();
  const [orgs, setOrgs]     = useState<OrgRow[]>([]);
  const [stats, setStats]   = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  if (!user || !isPlatformOwner) return <Navigate to="/" replace />;

  const loadData = async () => {
    try {
      const [orgsRes, statsRes] = await Promise.all([
        supabase.rpc('get_all_organizations'),
        supabase.rpc('get_platform_stats'),
      ]);
      if (orgsRes.error) throw orgsRes.error;
      if (statsRes.error) throw statsRes.error;
      setOrgs(orgsRes.data || []);
      const s = statsRes.data as any;
      setStats({
        total_orgs:    s?.total_orgs    ?? 0,
        total_users:   s?.total_users   ?? 0,
        active_subs:   s?.active_subs   ?? 0,
        total_revenue: s?.total_revenue ?? 0,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load platform data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleOrgStatus = async (orgId: string, status: 'approved' | 'rejected' | 'suspended') => {
    setActionLoading(orgId + status);
    try {
      const { error } = await supabase.rpc('set_org_status', { p_org_id: orgId, p_status: status });
      if (error) throw error;
      const labels: Record<string, string> = { approved: 'Approved', rejected: 'Rejected', suspended: 'Suspended' };
      toast({ title: `Organization ${labels[status]}`, description: `Status updated to ${status}.` });
      await loadData();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  const pendingOrgs  = orgs.filter(o => o.status === 'pending');
  const approvedOrgs = orgs.filter(o => o.status !== 'pending');

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-destructive font-semibold">Failed to load platform data</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="h-6 w-6 rounded-md bg-violet-100 flex items-center justify-center">
              <Globe className="h-3.5 w-3.5 text-violet-600" />
            </div>
            <span className="text-xs font-bold text-violet-600 uppercase tracking-widest">Platform Control</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Platform Control Panel</h1>
          <p className="text-muted-foreground mt-1 text-sm">Monitor and manage all organizations on the platform.</p>
        </div>
        <Badge className="bg-violet-100 text-violet-700 border-violet-200 self-start sm:self-auto">
          <Shield className="h-3 w-3 mr-1" /> Super Admin
        </Badge>
      </div>

      {/* Top Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Organizations" value={stats?.total_orgs ?? 0}   icon={Building2} accent="bg-blue-50 text-blue-600" />
        <StatCard title="Total Users"         value={stats?.total_users ?? 0}  icon={Users}     accent="bg-violet-50 text-violet-600" />
        <StatCard title="Active Subscriptions" value={stats?.active_subs ?? 0} icon={CreditCard} accent="bg-emerald-50 text-emerald-600" />
        <StatCard title="Total Revenue"       value="₹0"                        icon={DollarSign} accent="bg-amber-50 text-amber-600" sub="Billing integration pending" />
      </div>

      {/* Pending Organizations — approval queue */}
      {pendingOrgs.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/30 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2 text-amber-700">
              <Clock className="h-4 w-4" /> Pending Approval
              <Badge className="bg-amber-100 text-amber-700 border-amber-200 ml-1">{pendingOrgs.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-amber-200/50 bg-amber-50/50">
                    <th className="text-left px-6 py-3 font-bold text-amber-700/70 uppercase tracking-widest text-[10px]">Organization</th>
                    <th className="text-left px-6 py-3 font-bold text-amber-700/70 uppercase tracking-widest text-[10px]">Owner</th>
                    <th className="text-left px-6 py-3 font-bold text-amber-700/70 uppercase tracking-widest text-[10px]">Submitted</th>
                    <th className="text-right px-6 py-3 font-bold text-amber-700/70 uppercase tracking-widest text-[10px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100">
                  {pendingOrgs.map(org => (
                    <tr key={org.id} className="hover:bg-amber-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700 text-xs font-bold shrink-0">
                            {org.name.charAt(0).toUpperCase()}
                          </div>
                          <p className="font-semibold text-foreground">{org.name}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground text-xs">{org.owner_email}</td>
                      <td className="px-6 py-4 text-xs text-muted-foreground">
                        {new Date(org.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            className="h-7 px-3 text-xs bg-emerald-500 hover:bg-emerald-600 text-white"
                            disabled={actionLoading === org.id + 'approved'}
                            onClick={() => handleOrgStatus(org.id, 'approved')}
                          >
                            {actionLoading === org.id + 'approved'
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : <><CheckCircle2 className="h-3 w-3 mr-1" /> Approve</>
                            }
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-3 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                            disabled={actionLoading === org.id + 'rejected'}
                            onClick={() => handleOrgStatus(org.id, 'rejected')}
                          >
                            {actionLoading === org.id + 'rejected'
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : <><XCircle className="h-3 w-3 mr-1" /> Reject</>
                            }
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Organizations Table */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" /> All Organizations
          </CardTitle>
          <span className="text-xs text-muted-foreground">{approvedOrgs.length} approved</span>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/20">
                  <th className="text-left px-6 py-3 font-bold text-muted-foreground uppercase tracking-widest text-[10px]">Organization</th>
                  <th className="text-left px-6 py-3 font-bold text-muted-foreground uppercase tracking-widest text-[10px]">Owner</th>
                  <th className="text-left px-6 py-3 font-bold text-muted-foreground uppercase tracking-widest text-[10px]">Plan</th>
                  <th className="text-left px-6 py-3 font-bold text-muted-foreground uppercase tracking-widest text-[10px]">Status</th>
                  <th className="text-left px-6 py-3 font-bold text-muted-foreground uppercase tracking-widest text-[10px]">Users</th>
                  <th className="text-left px-6 py-3 font-bold text-muted-foreground uppercase tracking-widest text-[10px]">Created</th>
                  <th className="text-right px-6 py-3 font-bold text-muted-foreground uppercase tracking-widest text-[10px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {orgs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground text-sm">
                      No organizations found.
                    </td>
                  </tr>
                )}
                {approvedOrgs.map(org => (
                  <tr key={org.id} className="hover:bg-accent/20 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                          {org.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-foreground group-hover:text-primary transition-colors">{org.name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{org.id.substring(0, 8)}...</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground text-xs">{org.owner_email}</td>
                    <td className="px-6 py-4">
                      <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-widest', PLAN_STYLES[org.plan] || PLAN_STYLES.free)}>
                        {org.plan}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-widest', STATUS_STYLES[org.status] || STATUS_STYLES.pending)}>
                        {org.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-semibold text-foreground">{org.user_count}</span>
                    </td>
                    <td className="px-6 py-4 text-xs text-muted-foreground">
                      {new Date(org.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-50 cursor-not-allowed" disabled title="View Details (coming soon)">
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        {org.status !== 'suspended' ? (
                          <Button
                            variant="ghost" size="icon"
                            className="h-7 w-7 text-orange-500 hover:bg-orange-50"
                            title="Suspend Organization"
                            disabled={actionLoading === org.id + 'suspended'}
                            onClick={() => handleOrgStatus(org.id, 'suspended')}
                          >
                            {actionLoading === org.id + 'suspended'
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <PauseCircle className="h-3.5 w-3.5" />}
                          </Button>
                        ) : (
                          <Button
                            variant="ghost" size="icon"
                            className="h-7 w-7 text-emerald-500 hover:bg-emerald-50"
                            title="Re-approve Organization"
                            disabled={actionLoading === org.id + 'approved'}
                            onClick={() => handleOrgStatus(org.id, 'approved')}
                          >
                            {actionLoading === org.id + 'approved'
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <CheckCircle2 className="h-3.5 w-3.5" />}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* System Activity + Feature Flags */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* System Activity */}
        <Card className="border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> System Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {orgs.slice(0, 5).map(org => (
              <div key={org.id} className="flex items-center gap-3 py-2 border-b border-border/10 last:border-0">
                <div className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    Organization <span className="text-primary">"{org.name}"</span> created
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(org.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                  </p>
                </div>
              </div>
            ))}
            {orgs.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No recent activity.</p>
            )}
          </CardContent>
        </Card>

        {/* Feature Flags */}
        <Card className="border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" /> Feature Flags
              <Badge variant="outline" className="text-[10px] ml-1">Coming Soon</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: 'Multi-org switching',    enabled: false },
              { label: 'Advanced analytics',     enabled: false },
              { label: 'Custom domain support',  enabled: false },
              { label: 'SSO / SAML login',       enabled: false },
              { label: 'API access tokens',      enabled: false },
            ].map(flag => (
              <div key={flag.label} className="flex items-center justify-between py-2 border-b border-border/10 last:border-0">
                <span className="text-sm text-foreground">{flag.label}</span>
                <span className={cn(
                  'text-[10px] font-bold px-2 py-0.5 rounded-full border',
                  flag.enabled
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                    : 'bg-slate-100 text-slate-500 border-slate-200'
                )}>
                  {flag.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
