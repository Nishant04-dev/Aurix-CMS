import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, getCurrency, type Currency } from '@/lib/currency';

export function useOrgCurrency() {
  const { orgId } = useAuth();
  const queryClient = useQueryClient();

  const { data: currencyCode = 'INR' } = useQuery({
    queryKey: ['org_currency', orgId],
    queryFn: async () => {
      const org = await api.get<{ currency: string }>('/organizations');
      return org?.currency ?? 'INR';
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  });

  const updateCurrency = useMutation({
    mutationFn: (newCurrency: string) => api.patch('/organizations', { currency: newCurrency }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org_currency', orgId] });
      queryClient.invalidateQueries({ queryKey: ['org_settings', orgId] });
    },
  });

  const currency: Currency = getCurrency(currencyCode);
  const fmt = (amount: number) => formatCurrency(amount, currencyCode);

  return { currencyCode, currency, fmt, updateCurrency };
}
