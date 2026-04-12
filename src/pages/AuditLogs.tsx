import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { usePermissions } from '@/hooks/use-permissions';
import { useAuditLogs, type AuditFilters } from '@/hooks/use-audit-logs';
import { usePlan } from '@/hooks/use-plan';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ChevronDown, ChevronRight, ClipboardList, Download, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

const ACTION_OPTIONS = [
  'member.joined','member.left','member.removed','member.banned','member.unbanned',
  'invite.sent','invite.accepted','invite.rejected',
  'role.changed','org.updated','settings.updated',
  'channel.created','channel.deleted','channel.member_added','channel.member_removed',
];

const ACTION_COLORS: Record<string, string> = {
  'member.removed':  'bg-rose-100 text-rose-700',
  'member.banned':   'bg-rose-100 text-rose-700',
  'member.left':     'bg-amber-100 text-amber-700',
  'member.joined':   'bg-emerald-100 text-emerald-700',
  'invite.accepted': 'bg-emerald-100 text-emerald-700',
  'invite.sent':     'bg-blue-100 text-blue-700',
  'invite.rejected': 'bg-slate-100 text-slate-600',
  'channel.created': 'bg-violet-100 text-violet-700',
  'channel.deleted': 'bg-rose-100 text-rose-700',
};

export default function AuditLogs() {
  const { isAdmin } = usePermissions();
  if (!isAdmin) return <Navigate to="/" replace />;

  const { plan, isEnterprise } = usePlan();
  const AUDIT_DAYS: Record<string, number> = { free: 1, pro: 3, enterprise: 7 };
  const maxDays = AUDIT_DAYS[plan] ?? 1;

  const [filters, setFilters] = useState<AuditFilters>({ page: 1, limit: 50 });
  const [expanded, setExpanded] = useState<string | null>(null);
  const { data, isLoading } = useAuditLogs(filters);

  const entries = data?.data ?? [];
  const total   = data?.total ?? 0;
  const page    = data?.page ?? 1;
  const limit   = data?.limit ?? 50;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const handleDownloadCSV = () => {
    const rows = [
      ['Time', 'Actor', 'Email', 'Action', 'Entity', 'Entity ID'],
      ...entries.map(e => [
        new Date(e.created_at).toLocaleString(),
        e.actor_name, e.actor_email, e.action,
        e.entity ?? '', e.entity_id ?? '',
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'audit-logs.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Audit Logs</h1>
            <p className="text-sm text-muted-foreground">Track all org-level actions</p>
          </div>
        </div>
        {isEnterprise && (
          <Button size="sm" variant="outline" onClick={handleDownloadCSV} className="gap-1.5">
            <Download className="h-4 w-4" /> Download CSV
          </Button>
        )}
      </div>

      {/* Plan info banner */}
      <div className={cn(
        'flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-sm',
        plan === 'enterprise' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
        plan === 'pro'        ? 'bg-blue-50 border-blue-200 text-blue-700' :
                                'bg-amber-50 border-amber-200 text-amber-700'
      )}>
        <span>
          Showing logs from the last <strong>{maxDays} day{maxDays > 1 ? 's' : ''}</strong>
          {' '}({plan} plan).
          {plan !== 'enterprise' && ' Upgrade for longer history.'}
        </span>
        {plan !== 'enterprise' && (
          <a href="/settings/billing" className="flex items-center gap-1 font-semibold underline underline-offset-2">
            <Zap className="h-3.5 w-3.5" /> Upgrade
          </a>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 p-4 rounded-xl border border-border/50 bg-card">
        <Select value={filters.action ?? 'all'} onValueChange={v => setFilters(f => ({ ...f, action: v === 'all' ? undefined : v, page: 1 }))}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="All actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {ACTION_OPTIONS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input
          placeholder="Filter by actor ID"
          className="w-64"
          value={filters.actorId || ''}
          onChange={e => setFilters(f => ({ ...f, actorId: e.target.value || undefined, page: 1 }))}
        />
        <Input type="date" className="w-40" value={filters.from || ''}
          onChange={e => setFilters(f => ({ ...f, from: e.target.value || undefined, page: 1 }))} />
        <Input type="date" className="w-40" value={filters.to || ''}
          onChange={e => setFilters(f => ({ ...f, to: e.target.value || undefined, page: 1 }))} />
        <Button variant="outline" size="sm" onClick={() => setFilters({ page: 1, limit: 50 })}>
          Clear
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border/50 bg-card overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary/40" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/20">
                <th className="text-left px-4 py-3 font-bold text-muted-foreground uppercase tracking-widest text-[10px] w-8" />
                <th className="text-left px-4 py-3 font-bold text-muted-foreground uppercase tracking-widest text-[10px]">Actor</th>
                <th className="text-left px-4 py-3 font-bold text-muted-foreground uppercase tracking-widest text-[10px]">Action</th>
                <th className="text-left px-4 py-3 font-bold text-muted-foreground uppercase tracking-widest text-[10px]">Target</th>
                <th className="text-left px-4 py-3 font-bold text-muted-foreground uppercase tracking-widest text-[10px]">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {entries.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">No audit events found.</td></tr>
              )}
              {entries.map(entry => (
                <>
                  <tr
                    key={entry.id}
                    className="hover:bg-accent/30 cursor-pointer transition-colors"
                    onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                  >
                    <td className="px-4 py-3 text-muted-foreground">
                      {expanded === entry.id
                        ? <ChevronDown className="h-3.5 w-3.5" />
                        : <ChevronRight className="h-3.5 w-3.5" />
                      }
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{entry.actor_name}</p>
                      <p className="text-xs text-muted-foreground">{entry.actor_email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold', ACTION_COLORS[entry.action] || 'bg-slate-100 text-slate-600')}>
                        {entry.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                      {entry.entity}{entry.entity_id ? ` · ${entry.entity_id.slice(0, 8)}…` : ''}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(entry.created_at).toLocaleString()}
                    </td>
                  </tr>
                  {expanded === entry.id && (
                    <tr key={`${entry.id}-meta`} className="bg-muted/10">
                      <td colSpan={5} className="px-8 py-3">
                        <pre className="text-xs text-muted-foreground overflow-auto max-h-48 rounded-lg bg-muted/30 p-3">
                          {JSON.stringify(entry.metadata, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{total} total events</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1}
            onClick={() => setFilters(f => ({ ...f, page: (f.page ?? 1) - 1 }))}>
            Previous
          </Button>
          <span>Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages}
            onClick={() => setFilters(f => ({ ...f, page: (f.page ?? 1) + 1 }))}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
