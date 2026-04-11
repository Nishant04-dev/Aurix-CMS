import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';

export interface Tax {
  id: string;
  org_id: string;
  name: string;
  percentage: number;
  created_at: string;
}

export function useTaxes() {
  const { orgId, isPlatformOwner } = useAuth();
  const queryClient = useQueryClient();

  const { data: taxes = [], isLoading } = useQuery<Tax[]>({
    queryKey: ['taxes', orgId],
    queryFn: () => api.get<Tax[]>('/taxes'),
    enabled: !!orgId || isPlatformOwner,
  });

  const createTax = useMutation({
    mutationFn: (data: { name: string; percentage: number }) => api.post('/taxes', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['taxes', orgId] }),
  });

  const deleteTax = useMutation({
    mutationFn: (id: string) => api.delete(`/taxes/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['taxes', orgId] }),
  });

  return { taxes, isLoading, createTax, deleteTax };
}
