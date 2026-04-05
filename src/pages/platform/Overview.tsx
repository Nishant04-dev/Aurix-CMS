import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Users, CreditCard, DollarSign, Loader2, TrendingUp, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

function StatCard({ title, value, icon: Icon, accent, sub }: any) {
  return (
    <Card className="border-border/50 hover:shadow-md transition-all">
      <CardContent className="p-6">
        <div className={cn('h-11 w-11 rounded-xl flex items-center justify-center mb-4', accent || 'bg-primary/10 text-primary')}>
          <Icon className="h-5 w-5" />
        </div>
        <p className="text-3xl font-bold tracking-tight text-foreground">{value}</p>
        <p className="text-sm text-muted-foreground mt-0.5">{title}</p>
        {sub && <p className="text-xs text-muted-foreground/60 mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function PlatformOverview() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.rpc('get_platform_stats').then(({ data }) => {
      setStats(data);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary/40" /></div>;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Organizations" value={stats?.total_orgs ?? 0}   icon={Building2} accent="bg-blue-50 text-blue-600" />
        <StatCard title="Total Users"         value={stats?.total_users ?? 0}  icon={Users}     accent="bg-violet-50 text-violet-600" />
        <StatCard title="Active Subscriptions" value={stats?.active_subs ?? 0} icon={CreditCard} accent="bg-emerald-50 text-emerald-600" />
        <StatCard title="Total Revenue"       value="$0"                        icon={DollarSign} accent="bg-amber-50 text-amber-600" sub="Billing pending" />
      </div>
    </div>
  );
}
