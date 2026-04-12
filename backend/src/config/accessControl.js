/**
 * Central access control matrix — SINGLE SOURCE OF TRUTH.
 *
 * Internal role values (stored in memberships table):
 *   super_admin — org owner / platform owner (displayed as "Owner")
 *   admin       — org administrator (displayed as "Admin")
 *   member      — internal team member: developer, support, manager, staff
 *                 (any role with power_level 40–70 maps here)
 *   client      — external client, sees only their own data
 *
 * Aliases accepted everywhere (legacy / custom org roles):
 *   manager, developer, support, staff → treated as 'member'
 *
 * Plan limits are enforced separately via planLimits.js.
 */

// Canonical roles
export const ROLES = {
  OWNER:  'super_admin',
  ADMIN:  'admin',
  MEMBER: 'member',
  CLIENT: 'client',
};

// Display labels for UI
export const ROLE_LABELS = {
  super_admin: 'Owner',
  admin:       'Admin',
  member:      'Member',
  // legacy aliases — same display
  manager:     'Member',
  developer:   'Member',
  support:     'Member',
  staff:       'Member',
  client:      'Client',
};

// Power levels — used for hierarchy enforcement
export const ROLE_POWER = {
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

/**
 * Normalize any role string to one of the 4 canonical roles.
 * manager/developer/support/staff all become 'member'.
 */
export function normalizeRole(role) {
  if (!role) return 'client';
  const r = role.toLowerCase();
  if (r === 'super_admin' || r === 'superadmin') return 'super_admin';
  if (r === 'admin') return 'admin';
  if (r === 'client') return 'client';
  // Everything in the middle is a member
  return 'member';
}

// ── Access matrix ─────────────────────────────────────────────
// Uses canonical roles. normalizeRole() is called before checking.
const ACCESS = {
  clients: {
    view:   ['super_admin', 'admin', 'member'],
    create: ['super_admin', 'admin', 'member'],
    edit:   ['super_admin', 'admin', 'member'],
    delete: ['super_admin', 'admin'],
  },
  team: {
    view:   ['super_admin', 'admin', 'member'],
    invite: ['super_admin', 'admin', 'member'],
    remove: ['super_admin', 'admin'],
    ban:    ['super_admin', 'admin'],
  },
  roles: {
    view:   ['super_admin', 'admin'],
    create: ['super_admin', 'admin'],
    edit:   ['super_admin', 'admin'],
    delete: ['super_admin', 'admin'],
  },
  invoices: {
    view:   ['super_admin', 'admin', 'member', 'client'],
    create: ['super_admin', 'admin', 'member'],
    edit:   ['super_admin', 'admin', 'member'],
    delete: ['super_admin', 'admin'],
  },
  quotations: {
    view:    ['super_admin', 'admin', 'member', 'client'],
    create:  ['super_admin', 'admin', 'member'],
    edit:    ['super_admin', 'admin', 'member'],
    delete:  ['super_admin', 'admin'],
    convert: ['super_admin', 'admin', 'member'],
  },
  files: {
    view:   ['super_admin', 'admin', 'member', 'client'],  // clients can view & download
    upload: ['super_admin', 'admin', 'member'],             // clients cannot upload
    delete: ['super_admin', 'admin'],
  },
  chat: {
    view:           ['super_admin', 'admin', 'member', 'client'],
    create_channel: ['super_admin', 'admin'],
    delete_channel: ['super_admin', 'admin'],
    send_message:   ['super_admin', 'admin', 'member', 'client'],
  },
  audit_logs: {
    view: ['super_admin', 'admin'],
  },
  projects: {
    view:   ['super_admin', 'admin', 'member', 'client'],  // clients see their own (filtered in controller)
    create: ['super_admin', 'admin', 'member'],
    edit:   ['super_admin', 'admin', 'member'],
    delete: ['super_admin', 'admin'],
  },
  tasks: {
    view:   ['super_admin', 'admin', 'member', 'client'],  // clients see tasks on their projects
    create: ['super_admin', 'admin', 'member'],
    edit:   ['super_admin', 'admin', 'member'],
    delete: ['super_admin', 'admin'],
  },
  settings: {
    view: ['super_admin', 'admin'],
    edit: ['super_admin', 'admin'],
  },
};

/**
 * Check if a role has access to a resource action.
 * Automatically normalizes legacy role aliases.
 *
 * @param {string} role
 * @param {string} resource
 * @param {string} action
 * @returns {boolean}
 */
export function can(role, resource, action) {
  const normalized = normalizeRole(role);
  const allowed = ACCESS[resource]?.[action];
  if (!allowed) return false;
  return allowed.includes(normalized);
}
