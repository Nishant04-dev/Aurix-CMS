/**
 * Single source of truth for organization data across the app.
 * All components that need org data use this hook — same cache key,
 * same fetch, no duplication, no stale-data mismatches.
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';

export interface Organization {
  id: string;
  name: string;
  logo_url: string | null;
  website: string | null;
  gst_number: string | null;
  address: string | null;
  phone: string | null;
  email?: string | null;
  currency: string;  timezone: string;
  plan: string;
  status: string;
  template_id: string | null;
  branding: Record<string, any> | null;
  terms: string | null;
  payment_terms: string | null;
  bank_details: string | null;
  upi_id: string | null;
}

// Canonical query key — used everywhere so invalidation works globally
export const ORG_QUERY_KEY = ['organization'] as const;

export function useOrganization() {
  const { orgId, isPlatformOwner } = useAuth();

  return useQuery<Organization>({
    queryKey: ORG_QUERY_KEY,
    queryFn: () => api.get<Organization>('/organizations'),
    enabled: !!orgId || isPlatformOwner,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
}
