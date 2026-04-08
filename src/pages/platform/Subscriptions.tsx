import { useEffect, useState } from 'react';
import { api } from '@/lib/apiClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CreditCard } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const PLAN_STYLES: Record<string, string> = {
  free:       'bg-slate-100 text-slate-600 border-slate-200',
  pro:        'bg-blue-50 text-blue-600 border-blue-100',
  enterprise: 'bg-amber-50 text-amber-700 border-amber-200',
};
const STATUS_STYLES: Record<string, string> = {
  active:    'bg-emerald-50 text-emerald-600 border-emerald-100',
  cancelled: 'bg-rose-50 text-rose-600 border-rose-100',
  past_due:  'bg-amber-50 text-amber-600 border-amber-100',
  trialing:  'bg-blue-50 text-blue-600 border-blue-100',
};

export default function PlatformSubscriptions() {
  const [subs, setSubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const { toast } = useToast();

  const load = async () => {
    try {
      const data = await api.get<any[]>('/platform/subscriptions');
      setSubs(data || []);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error loading subscriptions', description: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const upgradePlan = async (subId: string, orgId: string, plan: string) => {
    const key = subId + plan;
    setActionId(key);
    try {
      await api.patch(`/platform/subscriptions/${subId}`, { plan, status: 'active', org_id: orgId });
      toast({ title: 'Plan upgraded', description: `Plan updated to ${plan}` });
      await load();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setActionId(null);
    }
  };

  const setSubStatus = async (subId: string, status: string) => {
    setActionId(subId + status);
    try {
      await api.patch(`/platform/subscriptions/${subId}`, { status });
      toast({ title: 'Status updated', description: `Subscription ${status}` });
      await load();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setActionId(null);
    }
  };

  if (loading) return <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary/40" /></div>;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-primary" /> Subscriptions ({subs.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/20">
                {['Organization','Plan','Status','Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {subs.map(s => {
                const org = s.organizations as any;
                const currentPlan = org?.plan || s.plan || 'free';
                return (
                  <tr key={s.id} className="hover:bg-accent/20 transition-colors">
                    <td className="px-4 py-3 font-medium">{org?.name || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase', PLAN_STYLES[currentPlan] || PLAN_STYLES.free)}>
                        {currentPlan}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase', STATUS_STYLES[s.status] || STATUS_STYLES.active)}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5 flex-wrap">
                        {currentPlan !== 'pro' && (
                          <Button size="sm" variant="outline" className="h-7 text-xs text-blue-600 border-blue-200"
                            disabled={!!actionId} onClick={() => upgradePlan(s.id, org?.id, 'pro')}>
                            {actionId === s.id + 'pro' ? <Loader2 className="h-3 w-3 animate-spin" /> : '→ Pro'}
                          </Button>
                        )}
                        {currentPlan !== 'enterprise' && (
                          <Button size="sm" variant="outline" className="h-7 text-xs text-amber-600 border-amber-200"
                            disabled={!!actionId} onClick={() => upgradePlan(s.id, org?.id, 'enterprise')}>
                            {actionId === s.id + 'enterprise' ? <Loader2 className="h-3 w-3 animate-spin" /> : '→ Enterprise'}
                          </Button>
                        )}
                        {currentPlan !== 'free' && (
                          <Button size="sm" variant="outline" className="h-7 text-xs"
                            disabled={!!actionId} onClick={() => upgradePlan(s.id, org?.id, 'free')}>
                            {actionId === s.id + 'free' ? <Loader2 className="h-3 w-3 animate-spin" /> : '→ Free'}
                          </Button>
                        )}
                        {s.status === 'active' ? (
                          <Button size="sm" variant="outline" className="h-7 text-xs text-destructive border-destructive/30"
                            disabled={!!actionId} onClick={() => setSubStatus(s.id, 'cancelled')}>
                            {actionId === s.id + 'cancelled' ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Cancel'}
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" className="h-7 text-xs text-emerald-600 border-emerald-200"
                            disabled={!!actionId} onClick={() => setSubStatus(s.id, 'active')}>
                            {actionId === s.id + 'active' ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Activate'}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {subs.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">No subscriptions found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
