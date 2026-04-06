import { useEffect, useState } from 'react';
import { api } from '@/lib/apiClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Users, Search, Ban, UserX, UserCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<string, string> = {
  active:   'bg-emerald-50 text-emerald-600 border-emerald-200',
  banned:   'bg-rose-50 text-rose-600 border-rose-200',
  disabled: 'bg-slate-100 text-slate-500 border-slate-200',
};

export default function PlatformUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);
  const { toast } = useToast();

  const load = async () => {
    try {
      const data = await api.get<any[]>('/platform/users');
      setUsers(data || []);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const setStatus = async (id: string, status: string) => {
    setActionId(id + status);
    try {
      await api.patch(`/platform/users/${id}/status`, { status });
      setUsers(prev => prev.map(u => u.id === id ? { ...u, status } : u));
      toast({ title: 'Updated', description: `User ${status}` });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setActionId(null);
    }
  };

  const filtered = users.filter(u =>
    (u.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary/40" /></div>;

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" /> All Users ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/20">
                  {['User','Email','Role','Status','Organization','Joined','Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filtered.map(u => (
                  <tr key={u.id} className={cn('hover:bg-accent/20 transition-colors', u.status !== 'active' && 'opacity-60')}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                          {(u.name || u.email || '?').charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium">{u.name || '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted border border-border/50 uppercase">{u.role}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase', STATUS_STYLES[u.status ?? 'active'] || STATUS_STYLES.active)}>
                        {u.status ?? 'active'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{u.org_name || '—'}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        {u.status !== 'banned' && (
                          <Button size="sm" variant="outline" className="h-7 text-xs text-rose-600 border-rose-200 gap-1"
                            disabled={!!actionId} onClick={() => setStatus(u.id, 'banned')}>
                            {actionId === u.id + 'banned' ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Ban className="h-3 w-3" />Ban</>}
                          </Button>
                        )}
                        {u.status === 'active' && (
                          <Button size="sm" variant="outline" className="h-7 text-xs text-amber-600 border-amber-200 gap-1"
                            disabled={!!actionId} onClick={() => setStatus(u.id, 'disabled')}>
                            {actionId === u.id + 'disabled' ? <Loader2 className="h-3 w-3 animate-spin" /> : <><UserX className="h-3 w-3" />Disable</>}
                          </Button>
                        )}
                        {u.status !== 'active' && (
                          <Button size="sm" variant="outline" className="h-7 text-xs text-emerald-600 border-emerald-200 gap-1"
                            disabled={!!actionId} onClick={() => setStatus(u.id, 'active')}>
                            {actionId === u.id + 'active' ? <Loader2 className="h-3 w-3 animate-spin" /> : <><UserCheck className="h-3 w-3" />Reactivate</>}
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
    </div>
  );
}
