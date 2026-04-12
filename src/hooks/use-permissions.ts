import { useAuth } from '@/contexts/AuthContext';
import type { UserRole } from '@/types';
import { useRoles } from './use-database';
import { useQuery } from '@tanstack/react-query';
import { normalizeRole, ROLE_POWER, canAccess } from '@/lib/accessControl';

// Kept for backward compat — components that import POWER_LEVELS directly
export const POWER_LEVELS: Record<string, number> = ROLE_POWER;

// Roles that cannot be modified via the UI
const IMMUTABLE_ROLES = new Set(['super_admin']);

// Roles that can be assigned to new members
export const ASSIGNABLE_ROLES: UserRole[] = ['admin', 'member', 'client'];

export function usePermissions() {
  const { user, orgId, isPlatformOwner } = useAuth();
  const { data: roles = [] } = useRoles();
  const role = user?.role ?? 'client';
  const normalized = normalizeRole(role);
  const power = ROLE_POWER[role] ?? ROLE_POWER[normalized] ?? 10;
  const userId = user?.id ?? '';

  // Owner and platform owner always have full access
  const isFullAccess = isPlatformOwner || role === 'super_admin';

  const roleObj = roles?.find(r =>
    r.powerLevel === power ||
    r.name.toLowerCase().replace(/\s+/g, '_') === role
  );

  const { data: dbPermissions = [] } = useQuery({
    queryKey: ['role_permissions', roleObj?.id, orgId],
    queryFn: async () => {
      if (!roleObj?.id) return [] as string[];
      return Object.entries(roleObj.permissions || {})
        .filter(([, v]) => v === true)
        .map(([k]) => k) as string[];
    },
    enabled: !!roleObj?.id && !!orgId && !isFullAccess,
    placeholderData: [],
  });

  const rolePermissions: Record<string, boolean> = roleObj?.permissions ?? {};

  const can = (permission: string): boolean => {
    if (isFullAccess) return true;
    if (role === 'admin') return true;
    if (rolePermissions.all === true) return true;
    if (dbPermissions?.includes(permission)) return true;
    return rolePermissions[permission] === true;
  };

  // Canonical role booleans — use normalizeRole so legacy aliases work
  const isOwner      = normalized === 'super_admin';
  const isSuperAdmin = isOwner; // alias
  const isAdmin      = normalized === 'admin' || isOwner;
  const isMember     = normalized === 'member';
  const isManager    = role === 'manager' || isMember; // legacy alias
  const isStaff      = role === 'developer' || role === 'support' || isMember;
  const isClient     = normalized === 'client';
  const canManage    = isAdmin || isMember;

  const canEditProject    = canManage;
  const canDeleteProject  = isAdmin;
  const canCancelProject  = isAdmin;
  const canAssignMembers  = canManage;
  const canManageTasks    = canManage;
  const canDeleteTask     = canManage;
  const canManageInvoices = canManage;
  const canManageTeam     = canManage;

  const canEditUser = (targetId: string, targetRole: string): boolean => {
    if (targetId === userId) return true;
    if (IMMUTABLE_ROLES.has(targetRole)) return false;
    const targetPower = ROLE_POWER[targetRole] ?? 10;
    return canManage && power > targetPower;
  };

  const canChangeRole = (targetId: string, targetRole: string): boolean => {
    if (targetId === userId) return false;
    if (IMMUTABLE_ROLES.has(targetRole)) return false;
    const targetPower = ROLE_POWER[targetRole] ?? 10;
    return isAdmin && power > targetPower;
  };

  const canAssignRole = (newRole: string): boolean => {
    if (newRole === 'super_admin') return false;
    const newPower = ROLE_POWER[newRole] ?? 10;
    return isAdmin && newPower < power;
  };

  const canDeleteUser = (targetId: string, targetRole: string): boolean => {
    if (targetId === userId) return false;
    if (IMMUTABLE_ROLES.has(targetRole)) return false;
    const targetPower = ROLE_POWER[targetRole] ?? 10;
    return isAdmin && power > targetPower;
  };

  const validateRoleChange = (targetId: string, targetRole: string, newRole: string): string | null => {
    if (targetId === userId)             return 'You cannot change your own role';
    if (IMMUTABLE_ROLES.has(targetRole)) return 'Owner role cannot be modified';
    if (newRole === 'super_admin')       return 'Owner role cannot be assigned';
    const targetPower = ROLE_POWER[targetRole] ?? 10;
    const newPower    = ROLE_POWER[newRole] ?? 10;
    if (power <= targetPower)            return 'Insufficient power level to modify this user';
    if (newPower >= power)               return 'Cannot assign a role equal to or higher than your own';
    return null;
  };

  return {
    role, normalized, power, userId,
    isOwner, isSuperAdmin, isAdmin, isMember, isManager, isStaff, isClient, canManage,
    canEditProject, canDeleteProject, canCancelProject, canAssignMembers,
    canManageTasks, canDeleteTask, canManageInvoices, canManageTeam,
    canEditUser, canChangeRole, canAssignRole, canDeleteUser, validateRoleChange,
    ASSIGNABLE_ROLES, can, canAccess: (resource: Parameters<typeof canAccess>[1]) => canAccess(role, resource),
    rolePermissions, dbPermissions: dbPermissions ?? [],
  };
}
