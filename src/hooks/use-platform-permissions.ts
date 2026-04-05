import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface PlatformRole {
  id: string;
  name: string;
  powerLevel: number;
}

export function usePlatformPermissions() {
  const { user, isPlatformOwner } = useAuth();

  const { data: platformData } = useQuery({
    queryKey: ['platform_permissions', user?.id],
    queryFn: async () => {
      if (!user) return { permissions: [] as string[], role: null as PlatformRole | null, power: 0 };

      const { data: userRoles } = await supabase
        .from('platform_user_roles')
        .select('role_id, platform_roles(id, name, power_level)')
        .eq('user_id', user.id);

      if (!userRoles || userRoles.length === 0) {
        return { permissions: [] as string[], role: null as PlatformRole | null, power: 0 };
      }

      // Get highest power role
      const topRole = userRoles.reduce((best: any, cur: any) => {
        const curPower = (cur.platform_roles as any)?.power_level ?? 0;
        const bestPower = (best?.platform_roles as any)?.power_level ?? 0;
        return curPower > bestPower ? cur : best;
      }, userRoles[0]);

      const roleObj = topRole?.platform_roles as any;
      const role: PlatformRole = roleObj
        ? { id: roleObj.id, name: roleObj.name, powerLevel: roleObj.power_level }
        : { id: '', name: '', powerLevel: 0 };

      // Get all permissions across all roles
      const roleIds = userRoles.map((r: any) => r.role_id);
      const { data: perms } = await supabase
        .from('platform_role_permissions')
        .select('permission_key')
        .in('role_id', roleIds);

      const permissions = (perms || []).map((p: any) => p.permission_key);

      return { permissions, role, power: role.powerLevel };
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  const permissions = platformData?.permissions ?? [];
  const role        = platformData?.role ?? null;
  const power       = platformData?.power ?? (isPlatformOwner ? 100 : 0);

  const can = (key: string): boolean => {
    if (isPlatformOwner) return true; // platform owner always has all
    return permissions.includes(key);
  };

  const isOwner = () => isPlatformOwner || role?.name === 'Owner';

  const canManageUser = (targetPower: number): boolean => {
    return power > targetPower;
  };

  const hasPlatformAccess = isPlatformOwner || (role !== null && role.powerLevel > 0);

  return {
    role,
    power,
    permissions,
    can,
    isOwner,
    canManageUser,
    hasPlatformAccess,
  };
}
