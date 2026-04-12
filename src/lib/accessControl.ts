/**
 * Frontend access control matrix — mirrors backend/src/config/accessControl.js.
 * SOURCE OF TRUTH for role-based UI visibility and feature gating.
 *
 * Roles: super_admin | admin | manager | developer | support | client
 * Plans: free | pro | enterprise  (enforced via usePlan hook)
 */

type Role = 'super_admin' | 'admin' | 'manager' | 'developer' | 'support' | 'client';

const ACCESS = {
  clients:    { view: ['super_admin','admin','manager'] as Role[] },
  team:       { view: ['super_admin','admin','manager'] as Role[] },
  roles:      { view: ['super_admin','admin'] as Role[] },
  invoices:   { view: ['super_admin','admin','manager','client'] as Role[] },
  quotations: { view: ['super_admin','admin','manager','client'] as Role[] },
  files:      { view: ['super_admin','admin','manager','developer','support'] as Role[] },
  chat:       { view: ['super_admin','admin','manager','developer','support','client'] as Role[] },
  audit_logs: { view: ['super_admin','admin'] as Role[] },
  projects:   { view: ['super_admin','admin','manager','developer','support'] as Role[] },
  tasks:      { view: ['super_admin','admin','manager','developer','support'] as Role[] },
  settings:   { view: ['super_admin','admin'] as Role[] },
} as const;

export function canAccess(role: string, resource: keyof typeof ACCESS, action: 'view' = 'view'): boolean {
  const allowed = ACCESS[resource]?.[action] as readonly string[] | undefined;
  if (!allowed) return false;
  return allowed.includes(role);
}

export type { Role };
