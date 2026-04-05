import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, TrendingUp, CreditCard, Badge } from 'lucide-react';
import { cn } from '@/lib/utils';

function MetricCard({ title, value, sub, icon: Icon, accent }: any) {
  return (
    <Card className="border-border/50">
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

export default function PlatformRevenue() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard title="Total Revenue"  value="$0"  icon={DollarSign}  accent="bg-emerald-50 text-emerald-600" sub="Billing integration pending" />
        <MetricCard title="MRR"            value="$0"  icon={TrendingUp}  accent="bg-blue-50 text-blue-600"    sub="Monthly recurring revenue" />
        <MetricCard title="Active Paying"  value="0"   icon={CreditCard}  accent="bg-violet-50 text-violet-600" sub="Paid subscriptions" />
      </div>
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Revenue Chart</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48 flex items-center justify-center bg-muted/20 rounded-xl border-2 border-dashed border-border/50">
            <p className="text-sm text-muted-foreground">Revenue chart — connect billing provider to populate</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
