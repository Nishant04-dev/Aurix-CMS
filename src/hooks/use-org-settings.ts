import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';

export interface OrgSettings {
  id: string;
  name: string;
  logo_url: string | null;
  website: string | null;
  gst_number: string | null;
  address: string | null;
  phone: string | null;
  currency: string;
  timezone: string;
  plan: string;
  status: string;
}

export function useOrgSettings() {
  const { orgId } = useAuth();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['org_settings', orgId],
    queryFn: () => api.get<OrgSettings>('/organizations'),
    enabled: !!orgId,
    staleTime: 2 * 60 * 1000,
  });

  const updateSettings = useMutation({
    mutationFn: (updates: Partial<Omit<OrgSettings, 'id' | 'plan' | 'status'>>) =>
      api.patch('/organizations', updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org_settings', orgId] });
      queryClient.invalidateQueries({ queryKey: ['org_currency', orgId] });
    },
  });

  return { settings, isLoading, updateSettings };
}
