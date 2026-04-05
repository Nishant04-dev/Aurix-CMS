/** Numeric power levels for role hierarchy enforcement */
export const ROLE_POWER: Record<string, number> = {
  super_admin: 100,
  superadmin:  100,
  admin:       90,
  manager:     70,
  member:      50,
  developer:   50,
  support:     50,
  client:      10,
  inactive:    0,
};

export function getPowerLevel(role: string): number {
  return ROLE_POWER[role?.toLowerCase()] ?? 10;
}

/** Returns true if actor can act on target (actor must strictly outrank target) */
export function canActOn(actorRole: string, targetRole: string): boolean {
  return getPowerLevel(actorRole) > getPowerLevel(targetRole);
}
