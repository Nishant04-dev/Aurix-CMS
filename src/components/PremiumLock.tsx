import { useNavigate } from 'react-router-dom';
import { Lock, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

interface PremiumLockProps {
  feature?: string;
  description?: string;
}

/**
 * Role-aware premium lock wall.
 * - Owner/Admin → shows "Upgrade Plan" button
 * - Member/Staff → shows "Contact admin" message
 * - Client → shows "Not available" (no billing exposure)
 */
export function PremiumLock({ feature = 'This feature', description }: PremiumLockProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const role = user?.role ?? 'client';
  const isOwner = role === 'admin' || role === 'super_admin';
  const isClient = role === 'client';

  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-6 max-w-md mx-auto">
      <div className="h-20 w-20 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center">
        <Lock className="h-9 w-9 text-amber-500" />
      </div>
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          {isClient ? 'Not Available' : 'Premium Feature'}
        </h2>
        <p className="text-muted-foreground mt-2 text-sm">
          {description ?? `${feature} is available on Pro and Enterprise plans.`}
          {!isClient && (isOwner
            ? ' Upgrade your organization to unlock this feature.'
            : ' Please contact your admin to upgrade the plan.')}
        </p>
      </div>
      {isOwner && (
        <>
          <Button className="gap-2" onClick={() => navigate('/settings/billing')}>
            <Zap className="h-4 w-4" /> Upgrade Plan
          </Button>
          <p className="text-xs text-muted-foreground">Pro plan starts at ₹199/mo · Cancel anytime</p>
        </>
      )}
      {!isOwner && !isClient && (
        <div className="rounded-xl border border-border/50 bg-muted/30 px-6 py-4 text-sm text-muted-foreground">
          Contact your organization admin to upgrade the plan.
        </div>
      )}
    </div>
  );
}
