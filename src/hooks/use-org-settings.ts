import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';
import { ORG_QUERY_KEY } from '@/hooks/use-organization';

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
  template_id: string | null;
  branding: Record<string, any> | null;
}

export function useOrgSettings() {
  const { orgId, isPlatformOwner } = useAuth();
  const queryClient = useQueryClient();

  // Use the same canonical key as useOrganization so they share the cache
  const { data: settings, isLoading } = useQuery({
    queryKey: ORG_QUERY_KEY,
    queryFn: () => api.get<OrgSettings>('/organizations'),
    enabled: !!orgId || isPlatformOwner,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  const updateSettings = useMutation({
    mutationFn: (updates: Partial<Omit<OrgSettings, 'id' | 'plan' | 'status'>>) =>
      api.patch('/organizations', updates),
    onSuccess: () => {
      // Single invalidation — covers useOrganization + useOrgSettings + useOrgCurrency
      queryClient.invalidateQueries({ queryKey: ORG_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['org_settings'] });
      queryClient.invalidateQueries({ queryKey: ['org_currency'] });
    },
  });

  return { settings, isLoading, updateSettings };
}
