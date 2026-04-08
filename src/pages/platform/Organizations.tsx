import React, { useEffect, useState } from 'react';
import { api } from '@/lib/apiClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Building2, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<string, string> = {
  pending:  'bg-amber-50 text-amber-600 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  rejected: 'bg-rose-50 text-rose-600 border-rose-200',
  banned:   'bg-rose-100 text-rose-700 border-rose-300',
};
const PLAN_STYLES: Record<string, string> = {
  free:       'bg-slate-100 text-slate-600 border-slate-200',
  pro:        'bg-blue-50 text-blue-600 border-blue-100',
  enterprise: 'bg-amber-50 text-amber-700 border-amber-200',
};

export default function PlatformOrganizations() {
  const [orgs, setOrgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const { toast } = useToast();

  const load = async () => {
    console.log('[Organizations] load() called');
    try {
      const data = await api.get<any[]>('/platform/organizations');
      console.log('[Organizations] API response:', data);
      setOrgs(data || []);
    } catch (err: any) {
      console.error('[Organizations] load error:', err);
      toast({ variant: 'destructive', title: 'Error loading organizations', description: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const setStatus = async (id: string, status: string) => {
    setActionId(id + status);
    try {
      await api.post('/platform/organizations/status', { orgId: id, status });
      toast({ title: 'Updated', description: `Organization ${status}` }); await load();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    }
    setActionId(null);
  };

  if (loading) return <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary/40" /></div>;

  const pending  = orgs.filter(o => o.status === 'pending');
  const rest     = orgs.filter(o => o.status !== 'pending');

  return (
    <div className="space-y-6">
      {pending.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-amber-700 flex items-center gap-2">
              <Clock className="h-4 w-4" /> Pending Approval ({pending.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-amber-100">
                {pending.map(org => (
                  <tr key={org.id} className="px-6 py-3 flex items-center justify-between hover:bg-amber-50/50">
                    <td className="px-6 py-3 font-semibold text-foreground flex-1">{org.name}</td>
                    <td className="px-6 py-3 text-xs text-muted-foreground flex-1">{org.owner_email}</td>
                    <td className="px-6 py-3 text-xs text-muted-foreground">{new Date(org.created_at).toLocaleDateString()}</td>
                    <td className="px-6 py-3 flex gap-2">
                      <Button size="sm" className="h-7 text-xs bg-emerald-500 hover:bg-emerald-600 text-white"
                        disabled={actionId === org.id + 'approved'} onClick={() => setStatus(org.id, 'approved')}>
                        {actionId === org.id + 'approved' ? <Loader2 className="h-3 w-3 animate-spin" /> : <><CheckCircle2 className="h-3 w-3 mr-1" />Approve</>}
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs text-destructive border-destructive/30"
                        disabled={actionId === org.id + 'rejected'} onClick={() => setStatus(org.id, 'rejected')}>
                        {actionId === org.id + 'rejected' ? <Loader2 className="h-3 w-3 animate-spin" /> : <><XCircle className="h-3 w-3 mr-1" />Reject</>}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" /> All Organizations ({orgs.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/20">
                  {['Organization','Owner','Plan','Status','Users','Created','Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {orgs.map(org => (
                  <tr key={org.id} className="hover:bg-accent/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">{org.name.charAt(0)}</div>
                        <span className="font-medium text-foreground">{org.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{org.owner_email}</td>
                    <td className="px-4 py-3">
                      <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase', PLAN_STYLES[org.plan] || PLAN_STYLES.free)}>{org.plan}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase', STATUS_STYLES[org.status] || STATUS_STYLES.pending)}>{org.status}</span>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold">{org.user_count}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(org.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      {org.status === 'approved' && (
                        <div className="flex gap-1.5">
                          <Button size="sm" variant="outline" className="h-7 text-xs text-amber-600 border-amber-200"
                            onClick={() => setStatus(org.id, 'rejected')}>Suspend</Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs text-rose-600 border-rose-200"
                            onClick={() => setStatus(org.id, 'banned')}>Ban</Button>
                        </div>
                      )}
                      {(org.status === 'rejected' || org.status === 'banned') && (
                        <Button size="sm" variant="outline" className="h-7 text-xs text-emerald-600 border-emerald-200"
                          onClick={() => setStatus(org.id, 'approved')}>Restore</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
