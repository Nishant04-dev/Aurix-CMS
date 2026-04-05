import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useClients, useProjects, useInvoices, useNotifications, useTasks } from '@/hooks/use-database';
import { usePermissions } from '@/hooks/use-permissions';
import { useOrgCurrency } from '@/hooks/use-org-currency';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  DollarSign, Users, FolderKanban, CreditCard, CheckSquare, Loader2,
  ArrowUpRight, XCircle, Plus, UserPlus, Upload, TrendingUp, Clock,
  AlertCircle, CheckCircle2, Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProjectFormModal, TaskFormModal } from '@/components/FormModals';

// ── Stat Card ────────────────────────────────────────────────
function StatCard({
  title, value, icon: Icon, accent, trend, sub,
}: {
  title: string; value: string | number; icon: React.ElementType;
  accent?: string; trend?: string; sub?: string;
}) {
  return (
    <Card className="hover:shadow-md transition-all duration-300 border-border/50 bg-card">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl', accent || 'bg-primary/10 text-primary')}>
            <Icon className="h-5 w-5" />
          </div>
          {trend && (
            <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> {trend}
            </span>
          )}
        </div>
        <div className="mt-4">
          <p className="text-3xl font-bold tracking-tight text-foreground">{value}</p>
          <p className="text-sm font-medium text-muted-foreground mt-0.5">{title}</p>
          {sub && <p className="text-xs text-muted-foreground/60 mt-1">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Status badge ─────────────────────────────────────────────
const STATUS_STYLES: Record<string, string> = {
  in_progress:  'bg-blue-50 text-blue-600 border-blue-100',
  pending:      'bg-slate-100 text-slate-600 border-slate-200',
  completed:    'bg-emerald-50 text-emerald-600 border-emerald-100',
  on_hold:      'bg-amber-50 text-amber-600 border-amber-100',
  cancelled:    'bg-rose-50 text-rose-600 border-rose-100',
};
const STATUS_LABELS: Record<string, string> = {
  in_progress: 'In Progress', pending: 'Pending',
  completed: 'Completed', on_hold: 'On Hold', cancelled: 'Cancelled',
};

// ── Admin / Staff Dashboard ───────────────────────────────────
function OrgDashboard() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const { fmt } = useOrgCurrency();
  const { data: clients }       = useClients();
  const { data: projects }      = useProjects();
  const { data: invoices }      = useInvoices();
  const { data: notifications } = useNotifications();
  const { data: tasks }         = useTasks();

  const [showProjectModal, setShowProjectModal] = useState(false);

  const isLoading = !projects && !invoices;

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
      </div>
    );
  }

  const activeProjects   = projects?.filter(p => p.status !== 'cancelled') || [];
  const inProgress       = projects?.filter(p => p.status === 'in_progress') || [];
  const pendingInvoices  = invoices?.filter(i => i.status === 'pending' || i.status === 'overdue') || [];
  const openTasks        = tasks?.filter(t => t.status !== 'done') || [];
  const recentActivity   = notifications?.slice(0, 6) || [];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Good {getGreeting()}, {user?.name?.split(' ')[0] || 'there'} 👋
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Here's what's happening in your workspace today.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-full border border-border/50">
          <Activity className="h-3.5 w-3.5 text-emerald-500" />
          <span>All systems operational</span>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Projects"   value={activeProjects.length}  icon={FolderKanban} accent="bg-blue-50 text-blue-600" />
        <StatCard title="Active Projects"  value={inProgress.length}      icon={TrendingUp}   accent="bg-emerald-50 text-emerald-600" />
        <StatCard title="Total Clients"    value={clients?.length || 0}   icon={Users}        accent="bg-violet-50 text-violet-600" />
        <StatCard title="Pending Invoices" value={pendingInvoices.length} icon={CreditCard}   accent="bg-amber-50 text-amber-600" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Active Projects — 2 cols */}
        <Card className="lg:col-span-2 border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <FolderKanban className="h-4 w-4 text-primary" /> Active Projects
            </CardTitle>
            {can('view_project') && (
              <Button variant="ghost" size="sm" className="text-xs text-primary h-7 px-2" asChild>
                <a href="/projects">View all <ArrowUpRight className="h-3 w-3 ml-1" /></a>
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {inProgress.length === 0 && (
              <div className="py-10 text-center text-muted-foreground text-sm">
                No active projects. <a href="/projects" className="text-primary underline underline-offset-2">Create one →</a>
              </div>
            )}
            {inProgress.slice(0, 5).map(p => (
              <div key={p.id} className="p-4 rounded-xl border border-border/40 hover:bg-muted/20 transition-colors group">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">{p.title}</p>
                    <span className={cn('shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full border', STATUS_STYLES[p.status])}>
                      {STATUS_LABELS[p.status]}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-primary font-mono shrink-0 ml-2">{p.progress}%</span>
                </div>
                <Progress value={p.progress} className="h-1.5 bg-muted/50" />
                {p.deadline && (
                  <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Due {new Date(p.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Right column */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {can('create_project') && (
                <ProjectFormModal
                  onSuccess={() => {}}
                  trigger={
                    <Button variant="outline" className="w-full justify-start gap-2 h-9 text-sm">
                      <Plus className="h-4 w-4 text-primary" /> New Project
                    </Button>
                  }
                />
              )}
              {can('invite_user') && (
                <Button variant="outline" className="w-full justify-start gap-2 h-9 text-sm" asChild>
                  <a href="/team"><UserPlus className="h-4 w-4 text-violet-500" /> Invite Team Member</a>
                </Button>
              )}
              {can('upload_file') && (
                <Button variant="outline" className="w-full justify-start gap-2 h-9 text-sm" asChild>
                  <a href="/files"><Upload className="h-4 w-4 text-emerald-500" /> Upload File</a>
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Task summary */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-primary" /> Tasks
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Open tasks</span>
                <span className="font-bold text-foreground">{openTasks.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Completed</span>
                <span className="font-bold text-emerald-600">{tasks?.filter(t => t.status === 'done').length || 0}</span>
              </div>
              {can('view_project') && (
                <Button variant="ghost" size="sm" className="w-full text-xs text-primary mt-1" asChild>
                  <a href="/tasks">View all tasks <ArrowUpRight className="h-3 w-3 ml-1" /></a>
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Activity */}
      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" /> Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-center py-6 text-muted-foreground">No recent activity.</p>
          ) : (
            <div className="space-y-4">
              {recentActivity.map(n => (
                <div key={n.id} className="flex items-start gap-3 pb-4 border-b border-border/10 last:border-0 last:pb-0">
                  <div className={cn('mt-1 h-2 w-2 rounded-full shrink-0 ring-4 ring-background', n.read ? 'bg-muted-foreground/30' : 'bg-primary')} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground leading-tight">{n.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{n.message}</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground/60 shrink-0">
                    {new Date(n.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Client Dashboard ──────────────────────────────────────────
function ClientDashboard() {
  const { user } = useAuth();
  const { data: projects }      = useProjects();
  const { data: invoices }      = useInvoices();
  const { data: notifications } = useNotifications();
  const { data: tasks }         = useTasks();

  const pendingInvoices  = invoices?.filter(i => i.status === 'pending' || i.status === 'overdue') || [];
  const activeProjects   = projects?.filter(p => p.status !== 'cancelled') || [];
  const inProgress       = projects?.filter(p => p.status === 'in_progress') || [];
  const cancelledProjects = projects?.filter(p => p.status === 'cancelled') || [];
  const recentNotifications = notifications?.slice(0, 5) || [];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Welcome back, {user?.name?.split(' ')[0] || 'there'} 👋
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">Your personal client portal.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="My Projects"      value={activeProjects.length}  icon={FolderKanban} />
        <StatCard title="Pending Invoices" value={pendingInvoices.length} icon={CreditCard}   accent="bg-amber-50 text-amber-600" />
        <StatCard title="Open Tasks"       value={tasks?.filter(t => t.status !== 'done').length || 0} icon={CheckSquare} accent="bg-blue-50 text-blue-600" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <FolderKanban className="h-4 w-4 text-primary" /> Active Projects
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {inProgress.length === 0 && <p className="text-sm text-center py-8 text-muted-foreground">No active projects currently.</p>}
            {inProgress.map(p => (
              <div key={p.id} className="p-4 rounded-xl bg-card border border-border/30">
                <div className="flex justify-between mb-2 items-center">
                  <span className="text-sm font-bold text-foreground">{p.title}</span>
                  <span className="text-xs font-bold font-mono text-primary px-2 py-0.5 rounded bg-primary/5 border border-primary/10">{p.progress}%</span>
                </div>
                <Progress value={p.progress} className="h-1.5 bg-muted/50" />
                {p.deadline && (
                  <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Due {new Date(p.deadline).toLocaleDateString()}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold">Updates & Notifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentNotifications.length === 0 && <p className="text-sm text-center py-8 text-muted-foreground">No new updates.</p>}
            {recentNotifications.map(n => (
              <div key={n.id} className="flex items-start gap-3 pb-4 border-b border-border/10 last:border-0 last:pb-0">
                <div className={cn('mt-1.5 h-2 w-2 rounded-full shrink-0', n.read ? 'bg-muted-foreground/30' : 'bg-primary ring-4 ring-primary/10')} />
                <div>
                  <p className="text-sm font-bold text-foreground leading-tight">{n.title}</p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{n.message}</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1.5">
                    {new Date(n.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {cancelledProjects.length > 0 && (
        <Card className="border-rose-100 bg-rose-50/30">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2 text-rose-700">
              <XCircle className="h-4 w-4" /> Cancelled Projects
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {cancelledProjects.map(p => (
              <div key={p.id} className="p-4 rounded-xl bg-card border border-rose-100 flex items-center justify-between opacity-70">
                <span className="text-sm font-bold text-foreground line-through">{p.title}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-600 border border-rose-200 uppercase">Cancelled</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

export default function Dashboard() {
  const { user } = useAuth();
  if (!user) return null;
  return user.role === 'client' ? <ClientDashboard /> : <OrgDashboard />;
}
