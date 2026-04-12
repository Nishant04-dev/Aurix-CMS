export type PlanId = 'free' | 'pro' | 'enterprise';

export type FeatureKey =
  | 'dashboard'
  | 'clients'
  | 'clients_limited'
  | 'projects'
  | 'tasks'
  | 'messages'
  | 'invoices'
  | 'invoices_basic'
  | 'files'
  | 'team'
  | 'team_limited'
  | 'roles_basic'
  | 'roles_advanced'
  | 'invitations'
  | 'team_chat'
  | 'audit_logs'
  | 'audit_logs_limited'
  | 'settings'
  | 'platform'
  | 'quotations'
  | 'templates_pro'
  | 'templates_enterprise'
  | 'all';

export interface Plan {
  name: string;
  price: number;
  maxMembers: number;   // -1 = unlimited
  maxClients: number;   // -1 = unlimited
  features: FeatureKey[];
}

// ── Plan-based limits ─────────────────────────────────────────
export const PLAN_CHAT_LIMITS: Record<PlanId, number> = {
  free:       2,
  pro:        4,
  enterprise: 10,
};

export const PLAN_AUDIT_DAYS: Record<PlanId, number> = {
  free:       1,
  pro:        3,
  enterprise: 7,
};

export const PLANS: Record<PlanId, Plan> = {
  free: {
    name: 'Free',
    price: 0,
    maxMembers: 2,
    maxClients: 3,
    features: [
      'dashboard',
      'clients_limited',
      'projects',
      'tasks',
      'messages',
      'invoices_basic',
      'invoices',
      'quotations',        // unlimited on all plans
      'team_limited',
      'invitations',
      'roles_basic',       // roles unlimited on all plans
      'audit_logs_limited',
    ],
  },
  pro: {
    name: 'Pro',
    price: 199,
    maxMembers: 10,
    maxClients: -1,
    features: [
      'dashboard',
      'clients',
      'projects',
      'tasks',
      'messages',
      'invoices',
      'quotations',
      'files',
      'team',
      'roles_basic',
      'invitations',
      'team_chat',
      'audit_logs_limited',
      'settings',
      'templates_pro',
    ],
  },
  enterprise: {
    name: 'Enterprise',
    price: 599,
    maxMembers: -1,
    maxClients: -1,
    features: ['all'],
  },
};

/**
 * Check if an org's plan includes a specific feature.
 * Enterprise plan with 'all' always returns true.
 * Also handles implied features: e.g. 'clients' implies 'clients_limited'.
 */
export function hasFeature(plan: PlanId | null | undefined, feature: FeatureKey): boolean {
  const p = PLANS[plan ?? 'free'];
  if (!p) return false;
  if (p.features.includes('all')) return true;
  if (p.features.includes(feature)) return true;

  // Implied: full feature implies limited version
  const implied: Partial<Record<FeatureKey, FeatureKey>> = {
    clients_limited: 'clients',
    invoices_basic:  'invoices',
    team_limited:    'team',
    roles_basic:     'roles_advanced',
    audit_logs_limited: 'audit_logs',
  };
  const full = implied[feature];
  if (full && p.features.includes(full)) return true;

  return false;
}

/** Human-readable upgrade message for a locked feature */
export function upgradeMessage(feature: FeatureKey): string {
  const messages: Partial<Record<FeatureKey, string>> = {
    files:              'File uploads require the Pro plan.',
    team_chat:          'Team Chat requires the Pro plan.',
    invitations:        'Invitations require the Pro plan.',
    audit_logs:         'Full Audit Logs require the Enterprise plan.',
    audit_logs_limited: 'Audit Logs require the Pro plan.',
    roles_basic:        'Role management requires the Pro plan.',
    roles_advanced:     'Advanced roles require the Enterprise plan.',
    platform:           'Platform access requires the Enterprise plan.',
  };
  return messages[feature] ?? 'Upgrade your plan to unlock this feature.';
}
