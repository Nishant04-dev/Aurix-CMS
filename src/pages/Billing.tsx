import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlan } from '@/hooks/use-plan';
import { PLANS, type PlanId } from '@/lib/plans';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Check, Zap, Crown, Rocket, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

const PLAN_ICONS = { free: Zap, pro: Rocket, enterprise: Crown };
const PLAN_COLORS = {
  free:       'border-slate-200 bg-slate-50',
  pro:        'border-primary/30 bg-primary/5 ring-2 ring-primary/20',
  enterprise: 'border-amber-200 bg-amber-50',
};
const PLAN_BADGE = {
  free:       'bg-slate-100 text-slate-600',
  pro:        'bg-primary/10 text-primary',
  enterprise: 'bg-amber-100 text-amber-700',
};

const PLAN_FEATURES: Record<PlanId, string[]> = {
  free: [
    'Dashboard',
    'Up to 3 clients',
    'Projects & Tasks',
    'Messages',
    'Basic Invoices',
    'Up to 2 team members',
  ],
  pro: [
    'Everything in Free',
    'Unlimited clients',
    'File uploads',
    'Team management (up to 10)',
    'Invitations',
    'Team Chat',
    'Audit Logs (7 days)',
    'Basic role management',
    'Settings',
  ],
  enterprise: [
    'Everything in Pro',
    'Unlimited team members',
    'Advanced roles & permissions',
    'Full Audit Logs (unlimited)',
    'Org-level controls (kick, ban)',
    'Multi-team chat groups',
    'Platform admin access',
    'Priority support',
  ],
};

export default function Billing() {
  const { plan, planName, maxMembers, maxClients } = usePlan();
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [targetPlan, setTargetPlan] = useState<PlanId | null>(null);

  const handleUpgradeClick = (id: PlanId) => {
    setTargetPlan(id);
    setShowModal(true);
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto animate-in fade-in duration-700">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Billing & Plan</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your subscription and unlock more features.</p>
      </div>

      {/* Current plan summary */}
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" /> Current Plan
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-6">
          <div>
            <p className="text-2xl font-bold text-foreground">{planName}</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {plan === 'free' ? 'Free forever' : plan === 'pro' ? '$199/month' : '$599/month'}
            </p>
          </div>
          <div className="flex gap-4 text-sm">
            <div className="rounded-lg bg-muted/40 px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Team Members</p>
              <p className="font-semibold text-foreground">{maxMembers === -1 ? 'Unlimited' : `Up to ${maxMembers}`}</p>
            </div>
            <div className="rounded-lg bg-muted/40 px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Clients</p>
              <p className="font-semibold text-foreground">{maxClients === -1 ? 'Unlimited' : `Up to ${maxClients}`}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {(Object.entries(PLANS) as [PlanId, typeof PLANS[PlanId]][]).map(([id, p]) => {
          const Icon = PLAN_ICONS[id];
          const isCurrent = id === plan;
          return (
            <div key={id} className={cn('rounded-2xl border p-6 flex flex-col gap-4 relative', PLAN_COLORS[id])}>
              {isCurrent && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-[10px] font-bold text-primary-foreground uppercase tracking-wider">
                  Current Plan
                </span>
              )}
              <div className="flex items-center gap-3">
                <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center', PLAN_BADGE[id])}>
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-bold text-foreground">{p.name}</p>
                  <p className="text-sm text-muted-foreground">{p.price === 0 ? 'Free' : `$${p.price}/mo`}</p>
                </div>
              </div>

              <ul className="space-y-2 flex-1">
                {PLAN_FEATURES[id].map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm text-foreground">
                    <Check className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              {!isCurrent ? (
                <Button
                  className={cn('w-full mt-2', id === 'enterprise' ? 'bg-amber-500 hover:bg-amber-600 text-white' : '')}
                  variant={id === 'pro' ? 'default' : 'outline'}
                  onClick={() => handleUpgradeClick(id)}
                >
                  {id === 'enterprise' ? 'Upgrade to Enterprise' : `Upgrade to ${p.name}`}
                </Button>
              ) : (
                <Button variant="outline" disabled className="w-full mt-2 opacity-60">
                  Current Plan
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* Upgrade modal — no DB write, contact support */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-sm text-center">
          <DialogHeader className="items-center">
            <div className="mx-auto h-14 w-14 rounded-full bg-amber-100 flex items-center justify-center mb-2">
              <Zap className="h-7 w-7 text-amber-600" />
            </div>
            <DialogTitle>Upgrade to {targetPlan ? PLANS[targetPlan].name : 'Pro'}</DialogTitle>
            <DialogDescription className="text-center">
              To upgrade your plan, please contact our support team. We'll get you set up right away.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              className="w-full gap-2"
              onClick={() => { setShowModal(false); navigate('/support'); }}
            >
              <MessageSquare className="h-4 w-4" /> Contact Support
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setShowModal(false)}>
              Maybe Later
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
