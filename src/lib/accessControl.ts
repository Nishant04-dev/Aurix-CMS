/**
 * Frontend access control — SINGLE SOURCE OF TRUTH.
 * Mirrors backend/src/config/accessControl.js exactly.
 *
 * Internal role values (from memberships / profiles):
 *   super_admin → displayed as "Owner"
 *   admin       → displayed as "Admin"
 *   member      → displayed as "Member"  (covers manager/developer/support/staff)
 *   client      → displayed as "Client"
 */

export const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Owner',
  admin:       'Admin',
  member:      'Member',
  manager:     'Member',
  developer:   'Member',
  support:     'Member',
  staff:       'Member',
  client:      'Client',
};

export const ROLE_POWER: Record<string, number> = {
  super_admin: 100,
  admin:       90,
  manager:     70,
  member:      50,
  developer:   50,
  support:     50,
  staff:       40,
  client:      10,
  inactive:    0,
};

/** Normalize any role to one of the 4 canonical roles. */
export function normalizeRole(role: string | undefined | null): 'super_admin' | 'admin' | 'member' | 'client' {
  if (!role) return 'client';
  const r = role.toLowerCase();
  if (r === 'super_admin' || r === 'superadmin') return 'super_admin';
  if (r === 'admin') return 'admin';
  if (r === 'client') return 'client';
  return 'member';
}

const ACCESS = {
  clients:    { view: ['super_admin', 'admin', 'member'] },
  team:       { view: ['super_admin', 'admin', 'member'] },
  roles:      { view: ['super_admin', 'admin'] },
  invoices:   { view: ['super_admin', 'admin', 'member', 'client'] },
  quotations: { view: ['super_admin', 'admin', 'member', 'client'] },
  files:      { view: ['super_admin', 'admin', 'member'] },
  chat:       { view: ['super_admin', 'admin', 'member', 'client'] },
  audit_logs: { view: ['super_admin', 'admin'] },
  projects:   { view: ['super_admin', 'admin', 'member'] },
  tasks:      { view: ['super_admin', 'admin', 'member'] },
  settings:   { view: ['super_admin', 'admin'] },
} as const;

export type AccessResource = keyof typeof ACCESS;

/**
 * Check if a role can access a resource.
 * Automatically normalizes legacy role aliases (manager/developer/support → member).
 */
export function canAccess(role: string | undefined | null, resource: AccessResource, action: 'view' = 'view'): boolean {
  const normalized = normalizeRole(role);
  const allowed = ACCESS[resource]?.[action] as readonly string[] | undefined;
  if (!allowed) return false;
  return allowed.includes(normalized);
}
