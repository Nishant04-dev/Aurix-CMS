import { useAuth } from '@/contexts/AuthContext';
import type { UserRole } from '@/types';
import { useRoles } from './use-database';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const POWER_LEVELS: Record<string, number> = {
  super_admin: 100,
  admin: 90,
  manager: 70,
  developer: 50,
  support: 50,
  client: 10,
  inactive: 0,
};

/** Roles that can never be assigned or modified by anyone */
const IMMUTABLE_ROLES = new Set(['super_admin']);

/** Roles that can be assigned — super_admin is excluded */
export const ASSIGNABLE_ROLES: UserRole[] = ['admin', 'manager', 'developer', 'support', 'client'];

export function usePermissions() {
  const { user, orgId } = useAuth();
  const { data: roles = [] } = useRoles();
  const role = user?.role ?? 'client';
  const power = POWER_LEVELS[role] ?? 10;
  const userId = user?.id ?? '';

  // Find the role object from DB — safe when roles array is empty
  const roleObj = roles?.find(r =>
    r.powerLevel === power ||
    r.name.toLowerCase().replace(/\s+/g, '_') === role
  );

  // Fetch role_permissions — only when we have a roleObj and an org
  const { data: dbPermissions = [] } = useQuery({
    queryKey: ['role_permissions', roleObj?.id, orgId],
    queryFn: async () => {
      if (!roleObj?.id) return [] as string[];
      const { data, error } = await supabase
        .from('role_permissions')
        .select('permission_key')
        .eq('role_id', roleObj.id);
      if (error) return [] as string[];
      return (data || []).map((r: any) => r.permission_key) as string[];
    },
    enabled: !!roleObj?.id && !!orgId,
    placeholderData: [],
  });

  // Merge DB permissions with JSONB permissions on the role object
  const rolePermissions: Record<string, boolean> = roleObj?.permissions ?? {};

  /**
   * Check a named permission.
   * Super admin (all: true) always passes.
   * Otherwise checks role_permissions table OR JSONB permissions field.
   */
  const can = (permission: string): boolean => {
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

  // ── Project permissions ──────────────────────────────────
  const canEditProject   = canManage;
  const canDeleteProject = isAdmin;
  const canCancelProject = isAdmin;
  const canAssignMembers = canManage;

  // ── Task permissions ─────────────────────────────────────
  const canManageTasks = canManage || isStaff;
  const canDeleteTask  = canManage;

  // ── Invoice / team permissions ───────────────────────────
  const canManageInvoices = canManage;
  const canManageTeam     = canManage;

  // ── User management — all enforce hierarchy ───────────────

  /**
   * Can the current user edit another user's profile?
   * Rules:
   *  - Always allowed to edit yourself (name/email only, not role)
   *  - Cannot edit a super_admin
   *  - Must strictly outrank the target
   *  - Must be admin or manager
   */
  const canEditUser = (targetId: string, targetRole: string): boolean => {
    if (targetId === userId) return true;                    // self-edit always ok
    if (IMMUTABLE_ROLES.has(targetRole)) return false;       // super_admin is untouchable
    const targetPower = POWER_LEVELS[targetRole] ?? 10;
    return canManage && power > targetPower;
  };

  /**
   * Can the current user change another user's role?
   * Rules:
   *  - Cannot change own role
   *  - Cannot touch a super_admin
   *  - Must strictly outrank the target
   *  - Cannot assign a role >= own power
   *  - Cannot assign super_admin
   */
  const canChangeRole = (targetId: string, targetRole: string): boolean => {
    if (targetId === userId) return false;                   // no self-role-change
    if (IMMUTABLE_ROLES.has(targetRole)) return false;       // super_admin immutable
    const targetPower = POWER_LEVELS[targetRole] ?? 10;
    return isAdmin && power > targetPower;
  };

  /**
   * Can the current user assign a specific new role to someone?
   * The new role must be strictly below the actor's power.
   */
  const canAssignRole = (newRole: string): boolean => {
    if (newRole === 'super_admin') return false;             // never assignable
    const newPower = POWER_LEVELS[newRole] ?? 10;
    return isAdmin && newPower < power;
  };

  /**
   * Can the current user delete/deactivate another user?
   * Rules:
   *  - Cannot delete yourself
   *  - Cannot delete a super_admin
   *  - Must strictly outrank the target
   *  - Admin only (not manager)
   */
  const canDeleteUser = (targetId: string, targetRole: string): boolean => {
    if (targetId === userId) return false;                   // no self-delete
    if (IMMUTABLE_ROLES.has(targetRole)) return false;       // super_admin protected
    const targetPower = POWER_LEVELS[targetRole] ?? 10;
    return isAdmin && power > targetPower;
  };

  /**
   * Validate a role change action and return an error string if blocked,
   * or null if allowed. Use this before calling the DB function.
   */
  const validateRoleChange = (
    targetId: string,
    targetRole: string,
    newRole: string
  ): string | null => {
    if (targetId === userId)                  return 'You cannot change your own role';
    if (IMMUTABLE_ROLES.has(targetRole))      return 'Super Admin role cannot be modified';
    if (newRole === 'super_admin')            return 'super_admin role cannot be assigned';
    const targetPower = POWER_LEVELS[targetRole] ?? 10;
    const newPower    = POWER_LEVELS[newRole] ?? 10;
    if (power <= targetPower)                 return 'Insufficient power level to modify this user';
    if (newPower >= power)                    return 'Cannot assign a role equal to or higher than your own';
    return null;
  };

  return {
    role,
    power,
    userId,
    isSuperAdmin,
    isAdmin,
    isManager,
    isStaff,
    isClient,
    canManage,
    canEditProject,
    canDeleteProject,
    canCancelProject,
    canAssignMembers,
    canManageTasks,
    canDeleteTask,
    canManageInvoices,
    canManageTeam,
    canEditUser,
    canChangeRole,
    canAssignRole,
    canDeleteUser,
    validateRoleChange,
    ASSIGNABLE_ROLES,
    can,
    rolePermissions,
    dbPermissions: dbPermissions ?? [],
  };
}
