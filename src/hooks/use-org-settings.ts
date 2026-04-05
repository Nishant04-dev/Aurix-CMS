import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
    queryFn: async (): Promise<OrgSettings | null> => {
      if (!orgId) return null;
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name, logo_url, website, gst_number, address, phone, currency, timezone, plan, status')
        .eq('id', orgId)
        .single();
      if (error) throw error;
      return data as OrgSettings;
    },
    enabled: !!orgId,
    staleTime: 2 * 60 * 1000,
  });

  const updateSettings = useMutation({
    mutationFn: async (updates: Partial<Omit<OrgSettings, 'id' | 'plan' | 'status'>>) => {
      if (!orgId) throw new Error('No org');
      const { error } = await supabase
        .from('organizations')
        .update(updates)
        .eq('id', orgId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org_settings', orgId] });
      queryClient.invalidateQueries({ queryKey: ['org_currency', orgId] });
    },
  });

  return { settings, isLoading, updateSettings };
}
