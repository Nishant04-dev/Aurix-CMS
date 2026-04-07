import { useAuth } from '@/contexts/AuthContext';
import type { UserRole } from '@/types';
import { useRoles } from './use-database';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/apiClient';
import { useAuth as useAuthCtx } from '@/contexts/AuthContext';

export const POWER_LEVELS: Record<string, number> = {
  super_admin: 100,
  admin: 90,
  manager: 70,
  developer: 50,
  support: 50,
  client: 10,
  inactive: 0,
};

const IMMUTABLE_ROLES = new Set(['super_admin']);
export const ASSIGNABLE_ROLES: UserRole[] = ['admin', 'manager', 'developer', 'support', 'client'];

export function usePermissions() {
  const { user, orgId, isPlatformOwner } = useAuth();
  const { data: roles = [] } = useRoles();
  const role = user?.role ?? 'client';
  const power = POWER_LEVELS[role] ?? 10;
  const userId = user?.id ?? '';

  // Super admins and platform owners always have full access — no DB lookup needed
  const isFullAccess = isPlatformOwner || role === 'super_admin';

  const roleObj = roles?.find(r =>
    r.powerLevel === power ||
    r.name.toLowerCase().replace(/\s+/g, '_') === role
  );

  // Fetch role_permissions via backend
  const { data: dbPermissions = [] } = useQuery({
    queryKey: ['role_permissions', roleObj?.id, orgId],
    queryFn: async () => {
      if (!roleObj?.id) return [] as string[];
      // Roles endpoint returns permissions embedded — extract from roleObj
      return Object.entries(roleObj.permissions || {})
        .filter(([, v]) => v === true)
        .map(([k]) => k) as string[];
    },
    enabled: !!roleObj?.id && !!orgId && !isFullAccess,
    placeholderData: [],
  });

  const rolePermissions: Record<string, boolean> = roleObj?.permissions ?? {};

  const can = (permission: string): boolean => {
    // Platform owner and super_admin bypass all permission checks
    if (isFullAccess) return true;
    // Admin gets most permissions by default
    if (role === 'admin') return true;
    if (rolePermissions.all === true) return true;
    if (dbPermissions?.includes(permission)) return true;
    return rolePermissions[permission] === true;
  };

  const isSuperAdmin = role === 'super_admin';
  const isAdmin      = role === 'admin' || isSuperAdmin;
  const isManager    = role === 'manager';
  const isStaff      = role === 'developer' || role === 'support';
  const isClient     = role === 'client';
  const canManage    = isAdmin || isManager;

  const canEditProject   = canManage;
  const canDeleteProject = isAdmin;
  const canCancelProject = isAdmin;
  const canAssignMembers = canManage;
  const canManageTasks   = canManage || isStaff;
  const canDeleteTask    = canManage;
  const canManageInvoices = canManage;
  const canManageTeam     = canManage;

  const canEditUser = (targetId: string, targetRole: string): boolean => {
    if (targetId === userId) return true;
    if (IMMUTABLE_ROLES.has(targetRole)) return false;
    const targetPower = POWER_LEVELS[targetRole] ?? 10;
    return canManage && power > targetPower;
  };

  const canChangeRole = (targetId: string, targetRole: string): boolean => {
    if (targetId === userId) return false;
    if (IMMUTABLE_ROLES.has(targetRole)) return false;
    const targetPower = POWER_LEVELS[targetRole] ?? 10;
    return isAdmin && power > targetPower;
  };

  const canAssignRole = (newRole: string): boolean => {
    if (newRole === 'super_admin') return false;
    const newPower = POWER_LEVELS[newRole] ?? 10;
    return isAdmin && newPower < power;
  };

  const canDeleteUser = (targetId: string, targetRole: string): boolean => {
    if (targetId === userId) return false;
    if (IMMUTABLE_ROLES.has(targetRole)) return false;
    const targetPower = POWER_LEVELS[targetRole] ?? 10;
    return isAdmin && power > targetPower;
  };

  const validateRoleChange = (targetId: string, targetRole: string, newRole: string): string | null => {
    if (targetId === userId)             return 'You cannot change your own role';
    if (IMMUTABLE_ROLES.has(targetRole)) return 'Super Admin role cannot be modified';
    if (newRole === 'super_admin')       return 'super_admin role cannot be assigned';
    const targetPower = POWER_LEVELS[targetRole] ?? 10;
    const newPower    = POWER_LEVELS[newRole] ?? 10;
    if (power <= targetPower)            return 'Insufficient power level to modify this user';
    if (newPower >= power)               return 'Cannot assign a role equal to or higher than your own';
    return null;
  };

  return {
    role, power, userId,
    isSuperAdmin, isAdmin, isManager, isStaff, isClient, canManage,
    canEditProject, canDeleteProject, canCancelProject, canAssignMembers,
    canManageTasks, canDeleteTask, canManageInvoices, canManageTeam,
    canEditUser, canChangeRole, canAssignRole, canDeleteUser, validateRoleChange,
    ASSIGNABLE_ROLES, can, rolePermissions, dbPermissions: dbPermissions ?? [],
  };
}
