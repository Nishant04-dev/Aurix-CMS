/**
 * All data fetching goes through the backend API.
 * No direct supabase.from() calls here — only supabase.auth is used (in apiClient).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/apiClient';
import type { Client, Project, Task, Message, Invoice, FileItem, Notification } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

// ── Clients ───────────────────────────────────────────────────
export function useClients() {
  const { user, orgId, isPlatformOwner } = useAuth();
  return useQuery({
    queryKey: ['clients', orgId],
    queryFn: () => api.get<Client[]>('/clients'),
    enabled: !!user && (!!orgId || isPlatformOwner) && user.role !== 'client',
  });
}

// ── Projects ──────────────────────────────────────────────────
export function useProjects(clientId?: string) {
  const { user, orgId, isPlatformOwner } = useAuth();
  return useQuery({
    queryKey: ['projects', clientId, orgId],
    queryFn: () => api.get<Project[]>('/projects', clientId ? { client_id: clientId } : undefined),
    enabled: !!user && (!!orgId || isPlatformOwner),
  });
}

// ── Tasks ─────────────────────────────────────────────────────
export function useTasks(projectId?: string) {
  const { user, orgId, isPlatformOwner } = useAuth();
  return useQuery({
    queryKey: ['tasks', projectId, orgId],
    queryFn: () => api.get<Task[]>('/tasks', projectId ? { project_id: projectId } : undefined),
    enabled: !!user && (!!orgId || isPlatformOwner),
  });
}

// ── Files ─────────────────────────────────────────────────────
export function useFiles(projectId?: string) {
  const { user, orgId, isPlatformOwner } = useAuth();
  return useQuery({
    queryKey: ['files', projectId, orgId],
    queryFn: () => api.get<FileItem[]>('/files', projectId ? { project_id: projectId } : undefined),
    enabled: !!user && (!!orgId || isPlatformOwner),
  });
}

// ── Invoices ──────────────────────────────────────────────────
export function useInvoices(clientId?: string) {
  const { user, orgId, isPlatformOwner } = useAuth();
  return useQuery({
    queryKey: ['invoices', clientId, orgId],
    queryFn: () => api.get<Invoice[]>('/invoices', clientId ? { client_id: clientId } : undefined),
    enabled: !!user && (!!orgId || isPlatformOwner),
  });
}

// ── Notifications ─────────────────────────────────────────────
export function useNotifications() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: () => api.get<Notification[]>('/notifications'),
    enabled: !!user,
  });
}

// ── Team Members ──────────────────────────────────────────────
export function useTeamMembers() {
  const { user, orgId, isPlatformOwner } = useAuth();
  return useQuery({
    queryKey: ['team', orgId],
    queryFn: () => api.get<any[]>('/users'),
    enabled: !!user && (!!orgId || isPlatformOwner) && user.role !== 'client',
  });
}

// ── Messages (project chat) ───────────────────────────────────
export function useMessages(projectId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['messages', projectId],
    queryFn: () => api.get<Message[]>('/messages', { project_id: projectId! }),
    enabled: !!user && !!projectId,
  });
}

// ── Mutations: Clients ────────────────────────────────────────
export function useCreateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post('/clients', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['team'] });
    },
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; company?: string; email?: string; phone?: string }) =>
      api.patch(`/clients/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clients'] }),
  });
}

export function useDeleteClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/clients/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clients'] }),
  });
}

// ── Mutations: Team ───────────────────────────────────────────
export function useCreateTeamMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post('/users', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['team'] }),
  });
}

export function useUpdateTeamMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, ...data }: { userId: string; name?: string; email?: string }) =>
      api.patch(`/users/${userId}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['team'] }),
  });
}

export function useDeleteTeamMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.delete(`/users/${userId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['team'] }),
  });
}

export function useChangeUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      api.patch(`/users/${userId}`, { role }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['team'] }),
  });
}

// ── Mutations: Messages ───────────────────────────────────────
export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ content, projectId }: { content: string; projectId: string }) =>
      api.post('/messages', { content, project_id: projectId }),
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: ['messages', projectId] });
    },
  });
}

// ── Roles ─────────────────────────────────────────────────────
export interface Role {
  id: string;
  name: string;
  powerLevel: number;
  permissions: Record<string, boolean>;
  isSystem: boolean;
  createdAt: string;
}

export function useRoles() {
  const { user, orgId, isPlatformOwner } = useAuth();
  return useQuery({
    queryKey: ['roles', orgId],
    queryFn: async () => {
      const data = await api.get<any[]>('/roles');
      return data.map((r: any) => ({
        id: r.id,
        name: r.name,
        powerLevel: r.power_level,
        permissions: r.permissions || {},
        isSystem: r.is_system,
        createdAt: r.created_at,
      })) as Role[];
    },
    enabled: !!user && (!!orgId || isPlatformOwner),
    placeholderData: [],
  });
}

export function useCreateRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (role: { name: string; powerLevel: number; permissions: Record<string, boolean> }) =>
      api.post('/roles', { name: role.name, power_level: role.powerLevel, permissions: role.permissions }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['roles'] }),
  });
}

export function useUpdateRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (role: { id: string; name: string; powerLevel: number; permissions: Record<string, boolean> }) =>
      api.patch(`/roles/${role.id}`, { name: role.name, power_level: role.powerLevel, permissions: role.permissions }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['roles'] }),
  });
}

export function useDeleteRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/roles/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['roles'] }),
  });
}

export function useAssignRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) =>
      api.patch(`/users/${userId}`, { role_id: roleId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
  });
}

// ── Approval requests (kept for backward compat — no backend route yet) ──────
export function useApprovalRequests(_projectId?: string) {
  return useQuery({ queryKey: ['approvals'], queryFn: async () => [], enabled: false });
}
export function useCreateApprovalRequest() {
  return useMutation({ mutationFn: async (_: any) => ({}) });
}
export function useUpdateApprovalRequest() {
  return useMutation({ mutationFn: async (_: any) => ({}) });
}
