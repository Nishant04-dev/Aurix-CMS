import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Building2, Users, CreditCard, IndianRupee, Loader2,
  CheckCircle2, XCircle, Clock, PauseCircle, Activity,
  UserCheck, UserX, Zap, Rocket, Crown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PlatformStats {
  total_orgs: number;
  active_orgs: number;
  pending_orgs: number;
  suspended_orgs: number;
  rejected_orgs: number;
  total_users: number;
  active_users: number;
  banned_users: number;
  free_orgs: number;
  pro_orgs: number;
  enterprise_orgs: number;
  active_subs: number;
  total_revenue: number;
}

interface AuditRow {
  id: string;
  action: string;
  user_id: string | null;
  created_at: string;
  entity: string | null;
  metadata: any;
}

function StatCard({ title, value, icon: Icon, accent, sub }: {
  title: string; value: string | number; icon: React.ElementType; accent?: string; sub?: string;
}) {
  return (
    <Card className="border-border/50 hover:shadow-md transition-all">
      <CardContent className="p-5">
        <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center mb-3', accent || 'bg-primary/10 text-primary')}>
          <Icon className="h-4.5 w-4.5" />
        </div>
        <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
        <p className="text-xs font-medium text-muted-foreground mt-0.5">{title}</p>
        {sub && <p className="text-[10px] text-muted-foreground/60 mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

const ACTION_COLORS: Record<string, string> = {
  INVITE_ACCEPTED:      'bg-emerald-100 text-emerald-700',
  INVITE_REJECTED:      'bg-rose-100 text-rose-700',
  ORG_SETTINGS_UPDATED: 'bg-blue-100 text-blue-700',
  ORG_CREATED:          'bg-violet-100 text-violet-700',
  USER_BANNED:          'bg-red-100 text-red-700',
  USER_KICKED:          'bg-orange-100 text-orange-700',
  ROLE_CHANGED:         'bg-amber-100 text-amber-700',
};

export default function PlatformOverview() {
  const [stats, setStats]   = useState<PlatformStats | null>(null);
  const [logs, setLogs]     = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [statsRes, logsRes] = await Promise.all([
        supabase.rpc('get_platform_stats'),
        (supabase as any)
          .from('audit_logs')
          .select('id, action, user_id, created_at, entity, metadata')
          .order('created_at', { ascending: false })
          .limit(10),
      ]);
      if (statsRes.data) setStats(statsRes.data as PlatformStats);
      if (logsRes.data)  setLogs(logsRes.data);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary/40" />
      </div>
    );
  }

  const s = stats;

  return (
    <div className="space-y-6">

      {/* ── Org Status Breakdown ── */}
      <div>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Organizations</p>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
          <StatCard title="Total Orgs"    value={s?.total_orgs     ?? 0} icon={Building2}    accent="bg-blue-50 text-blue-600" />
          <StatCard title="Active"        value={s?.active_orgs    ?? 0} icon={CheckCircle2} accent="bg-emerald-50 text-emerald-600" />
          <StatCard title="Suspended"     value={s?.suspended_orgs ?? 0} icon={PauseCircle}  accent="bg-amber-50 text-amber-600" />
          <StatCard title="Rejected"      value={s?.rejected_orgs  ?? 0} icon={XCircle}      accent="bg-rose-50 text-rose-600" />
        </div>
      </div>

      {/* ── Users + Revenue ── */}
      <div>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Users & Revenue</p>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
          <StatCard title="Total Users"   value={s?.total_users  ?? 0} icon={Users}       accent="bg-violet-50 text-violet-600" />
          <StatCard title="Active Users"  value={s?.active_users ?? 0} icon={UserCheck}   accent="bg-sky-50 text-sky-600" />
          <StatCard title="Banned Users"  value={s?.banned_users ?? 0} icon={UserX}       accent="bg-red-50 text-red-600" />
          <StatCard title="Paid Subs"     value={s?.active_subs  ?? 0} icon={CreditCard}  accent="bg-indigo-50 text-indigo-600" />
        </div>
      </div>

      {/* ── Plan Distribution + Revenue ── */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* Plan breakdown */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" /> Plan Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: 'Free',       value: s?.free_orgs       ?? 0, icon: Zap,    color: 'bg-slate-100 text-slate-600' },
              { label: 'Pro',        value: s?.pro_orgs        ?? 0, icon: Rocket, color: 'bg-blue-100 text-blue-600' },
              { label: 'Enterprise', value: s?.enterprise_orgs ?? 0, icon: Crown,  color: 'bg-violet-100 text-violet-600' },
            ].map(p => (
              <div key={p.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={cn('h-7 w-7 rounded-lg flex items-center justify-center', p.color)}>
                    <p.icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-sm font-medium text-foreground">{p.label}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary/60"
                      style={{ width: `${s?.total_orgs ? Math.round((p.value / s.total_orgs) * 100) : 0}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold text-foreground w-6 text-right">{p.value}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Revenue summary */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <IndianRupee className="h-4 w-4 text-primary" /> Revenue Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: 'Monthly Revenue (MRR)', value: '₹0',  sub: 'Billing integration pending' },
              { label: 'Active Paid Users',      value: s?.active_subs ?? 0 },
              { label: 'Pending Orgs',           value: s?.pending_orgs ?? 0, sub: 'Awaiting approval' },
            ].map(r => (
              <div key={r.label} className="flex items-center justify-between py-2 border-b border-border/10 last:border-0">
                <div>
                  <p className="text-sm font-medium text-foreground">{r.label}</p>
                  {r.sub && <p className="text-[10px] text-muted-foreground">{r.sub}</p>}
                </div>
                <span className="text-sm font-bold text-foreground">{r.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ── Recent Audit Activity ── */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" /> Recent Activity
            <Badge variant="outline" className="text-[10px] ml-1">Last 10</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {logs.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">No recent activity.</p>
          )}
          {logs.map(log => (
            <div key={log.id} className="flex items-center justify-between py-2 border-b border-border/10 last:border-0 gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-2 w-2 rounded-full bg-primary/40 shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn(
                      'text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide',
                      ACTION_COLORS[log.action] || 'bg-slate-100 text-slate-600'
                    )}>
                      {log.action.replace(/_/g, ' ')}
                    </span>
                    {log.entity && (
                      <span className="text-xs text-muted-foreground capitalize">{log.entity}</span>
                    )}
                  </div>
                </div>
              </div>
              <span className="text-[10px] text-muted-foreground shrink-0">
                {new Date(log.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

    </div>
  );
}
