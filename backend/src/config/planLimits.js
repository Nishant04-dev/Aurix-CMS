/**
 * Single source of truth for plan-based feature limits.
 * Used by all backend controllers that enforce plan restrictions.
 */
export const PLAN_LIMITS = {
  free: {
    chats:         2,
    audit_days:    1,
    files:         false,
    download_logs: false,
  },
  pro: {
    chats:         4,
    audit_days:    3,
    files:         true,
    download_logs: false,
  },
  enterprise: {
    chats:         10,
    audit_days:    7,
    files:         true,
    download_logs: true,
  },
};

/**
 * Get limits for a given plan, falling back to free.
 */
export function getLimits(plan) {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
}
