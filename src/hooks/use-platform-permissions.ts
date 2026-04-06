import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/apiClient';
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
      return await api.get('/platform/permissions');
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
