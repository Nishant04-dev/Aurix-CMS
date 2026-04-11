import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/apiClient';
import { formatCurrency, getCurrency, type Currency } from '@/lib/currency';
import { useOrganization, ORG_QUERY_KEY } from '@/hooks/use-organization';
import { useMutation } from '@tanstack/react-query';

export function useOrgCurrency() {
  const queryClient = useQueryClient();
  // Derive currency from the shared org cache — no separate fetch
  const { data: org } = useOrganization();
  const currencyCode = org?.currency ?? 'INR';

  const updateCurrency = useMutation({
    mutationFn: (newCurrency: string) => api.patch('/organizations', { currency: newCurrency }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORG_QUERY_KEY });
      queryClient.refetchQueries({ queryKey: ORG_QUERY_KEY });
    },
  });

  const currency: Currency = getCurrency(currencyCode);
  const fmt = (amount: number) => formatCurrency(amount, currencyCode);

  return { currencyCode, currency, fmt, updateCurrency };
}
