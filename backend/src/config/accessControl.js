/**
 * Central access control matrix.
 * SOURCE OF TRUTH for role-based feature access.
 *
 * Roles (from memberships table):
 *   super_admin — org owner, full access
 *   admin       — org admin, manages everything except ownership transfer
 *   manager     — internal team lead, limited admin
 *   developer   — internal team member (technical)
 *   support     — internal team member (non-technical)
 *   client      — external client, sees only their own data
 *
 * Plan limits are enforced separately via planLimits.js.
 * This file only governs ROLE-based access.
 */

export const ACCESS = {
  // ── Client management ──────────────────────────────────────
  clients: {
    view:   ['super_admin', 'admin', 'manager'],
    create: ['super_admin', 'admin', 'manager'],
    edit:   ['super_admin', 'admin', 'manager'],
    delete: ['super_admin', 'admin'],
  },

  // ── Team / user management ─────────────────────────────────
  team: {
    view:   ['super_admin', 'admin', 'manager'],
    invite: ['super_admin', 'admin', 'manager'],
    remove: ['super_admin', 'admin'],
    ban:    ['super_admin', 'admin'],
  },

  // ── Role management ────────────────────────────────────────
  roles: {
    view:   ['super_admin', 'admin'],
    create: ['super_admin', 'admin'],
    edit:   ['super_admin', 'admin'],
    delete: ['super_admin', 'admin'],
  },

  // ── Invoices ───────────────────────────────────────────────
  // Clients see only their own (filtered in controller)
  invoices: {
    view:   ['super_admin', 'admin', 'manager', 'client'],
    create: ['super_admin', 'admin', 'manager'],
    edit:   ['super_admin', 'admin', 'manager'],
    delete: ['super_admin', 'admin'],
  },

  // ── Quotations ─────────────────────────────────────────────
  // Clients see only their own (filtered in controller)
  quotations: {
    view:    ['super_admin', 'admin', 'manager', 'client'],
    create:  ['super_admin', 'admin', 'manager'],
    edit:    ['super_admin', 'admin', 'manager'],
    delete:  ['super_admin', 'admin'],
    convert: ['super_admin', 'admin', 'manager'],
  },

  // ── Files ──────────────────────────────────────────────────
  // Also gated by plan (files: true/false in planLimits)
  files: {
    view:   ['super_admin', 'admin', 'manager', 'developer', 'support'],
    upload: ['super_admin', 'admin', 'manager', 'developer', 'support'],
    delete: ['super_admin', 'admin', 'manager'],
  },

  // ── Chat channels ──────────────────────────────────────────
  // Also gated by plan (chats limit in planLimits)
  chat: {
    view:           ['super_admin', 'admin', 'manager', 'developer', 'support', 'client'],
    create_channel: ['super_admin', 'admin'],
    delete_channel: ['super_admin', 'admin'],
    send_message:   ['super_admin', 'admin', 'manager', 'developer', 'support', 'client'],
  },

  // ── Audit logs ─────────────────────────────────────────────
  // Also gated by plan (audit_days in planLimits)
  audit_logs: {
    view: ['super_admin', 'admin'],
  },

  // ── Projects ───────────────────────────────────────────────
  projects: {
    view:   ['super_admin', 'admin', 'manager', 'developer', 'support'],
    create: ['super_admin', 'admin', 'manager'],
    edit:   ['super_admin', 'admin', 'manager'],
    delete: ['super_admin', 'admin'],
  },

  // ── Tasks ──────────────────────────────────────────────────
  tasks: {
    view:   ['super_admin', 'admin', 'manager', 'developer', 'support'],
    create: ['super_admin', 'admin', 'manager', 'developer', 'support'],
    edit:   ['super_admin', 'admin', 'manager', 'developer', 'support'],
    delete: ['super_admin', 'admin', 'manager'],
  },

  // ── Org settings ───────────────────────────────────────────
  settings: {
    view:   ['super_admin', 'admin'],
    edit:   ['super_admin', 'admin'],
  },
};

/**
 * Check if a role has access to a resource action.
 * @param {string} role - The user's role
 * @param {string} resource - Key from ACCESS (e.g. 'clients')
 * @param {string} action - Action key (e.g. 'view')
 * @returns {boolean}
 */
export function can(role, resource, action) {
  const allowed = ACCESS[resource]?.[action];
  if (!allowed) return false;
  return allowed.includes(role);
}
