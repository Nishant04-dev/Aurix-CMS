import { useAuth } from '@/contexts/AuthContext';
import { hasFeature, PLANS, type FeatureKey, type PlanId } from '@/lib/plans';

/**
 * Returns plan-aware helpers for the current org.
 */
export function usePlan() {
  const { orgPlan } = useAuth();
  const plan = (orgPlan ?? 'free') as PlanId;
  const planDef = PLANS[plan] ?? PLANS.free;

  return {
    plan,
    planName: planDef.name,
    maxMembers: planDef.maxMembers,
    maxClients: planDef.maxClients,
    /** Check if the current org's plan includes a feature */
    can: (feature: FeatureKey) => hasFeature(plan, feature),
    isFree:       plan === 'free',
    isPro:        plan === 'pro',
    isEnterprise: plan === 'enterprise',
  };
}
