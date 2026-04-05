import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, getCurrency, type Currency } from '@/lib/currency';

export function useOrgCurrency() {
  const { orgId } = useAuth();
  const queryClient = useQueryClient();

  const { data: currencyCode = 'INR' } = useQuery({
    queryKey: ['org_currency', orgId],
    queryFn: async () => {
      if (!orgId) return 'INR';
      const { data } = await supabase
        .from('organizations')
        .select('currency')
        .eq('id', orgId)
        .single();
      return (data as any)?.currency ?? 'INR';
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  });

  const updateCurrency = useMutation({
    mutationFn: async (newCurrency: string) => {
      if (!orgId) throw new Error('No org');
      const { error } = await supabase
        .from('organizations')
        .update({ currency: newCurrency })
        .eq('id', orgId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org_currency', orgId] });
    },
  });

  const currency: Currency = getCurrency(currencyCode);

  const fmt = (amount: number) => formatCurrency(amount, currencyCode);

  return {
    currencyCode,
    currency,
    fmt,
    updateCurrency,
  };
}
