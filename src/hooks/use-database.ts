import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Client, Project, Task, Message, Invoice, FileItem, Notification } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

// Clients
export function useClients() {
  const { user, orgId } = useAuth();
  return useQuery({
    queryKey: ['clients', user?.role, orgId],
    queryFn: async () => {
      if (user?.role === 'client') return [];
      if (!orgId) return [];

      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('org_id', orgId)
        .order('name');

      if (error) throw error;
      if (!data) return [];

      return data.map((d: any) => ({
        id: d.id,
        name: d.name,
        company: d.company,
        email: d.email,
        phone: d.phone,
        userId: d.user_id,
        createdAt: d.created_at
      })) as Client[];
    },
    enabled: !!user && !!orgId && user.role !== 'client'
  });
}

// Projects
export function useProjects(clientId?: string) {
  const { user, orgId } = useAuth();
  return useQuery({
    queryKey: ['projects', clientId, user?.id, user?.role, orgId],
    queryFn: async () => {
      if (!orgId) return [];

      let query = supabase.from('projects')
        .select(`*, project_members (id, user_id, profiles (name, email, role))`)
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });

      if (user?.role === 'client') {
        const { data: client } = await supabase.from('clients').select('id').eq('user_id', user.id).eq('org_id', orgId).single();
        if (client) query = query.eq('client_id', client.id);
        else return [];
      } else if (user?.role === 'developer') {
        const { data: projectIds } = await supabase.from('project_members').select('project_id').eq('user_id', user.id);
        const ids = projectIds?.map(p => p.project_id) || [];
        if (ids.length === 0) return [];
        query = query.in('id', ids);
      } else if (user?.role === 'manager') {
        query = query.or(`manager_id.eq.${user.id},manager_id.is.null`);
      } else if (clientId) {
        query = query.eq('client_id', clientId);
      }

      const { data, error } = await query;
      if (error) throw error;
      if (!data) return [];

      return data.map((d: any) => ({
        id: d.id,
        title: d.title || 'Untitled Project',
        description: d.description || '',
        clientId: d.client_id,
        status: d.status || 'pending',
        progress: Number(d.progress || 0),
        deadline: d.deadline,
        createdAt: d.created_at,
        manager_id: d.manager_id,
        budget_total: Number(d.budget_total || 0),
        budget_spent: Number(d.budget_spent || 0),
        members: (d.project_members || []).map((m: any) => ({
          id: m.id,
          userId: m.user_id,
          profiles: m.profiles
        }))
      })) as Project[];
    },
    enabled: !!user && !!orgId
  });
}

// Tasks
export function useTasks(projectId?: string) {
  const { user, orgId } = useAuth();
  return useQuery({
    queryKey: ['tasks', projectId, user?.id, user?.role, orgId],
    queryFn: async () => {
      if (!orgId) return [];

      let query = supabase.from('tasks')
        .select('*, subtasks(*), profiles!tasks_assigned_to_fkey(name)')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });

      if (user?.role === 'client') {
        query = query.eq('assigned_to_id', user.id);
      } else if (user?.role === 'developer' || user?.role === 'support') {
        const { data: memberProjects } = await supabase.from('project_members').select('project_id').eq('user_id', user.id);
        const projectIds = memberProjects?.map((p: any) => p.project_id) || [];
        if (projectIds.length > 0) {
          query = query.or(`assigned_to_id.eq.${user.id}`);
        } else {
          query = query.eq('assigned_to_id', user.id);
        }
      } else if (projectId) {
        query = query.eq('project_id', projectId);
      }

      const { data, error } = await query;
      if (error) throw error;
      if (!data) return [];

      return data.map((d: any) => ({
        id: d.id,
        projectId: d.project_id,
        title: d.title || 'Untitled Task',
        description: d.description || '',
        assignedToId: d.assigned_to_id || d.assigned_to,
        assignedToName: d.profiles?.name,
        status: d.status || 'todo',
        priority: d.priority || 'medium',
        dueDate: d.due_date,
        createdAt: d.created_at,
        subtasks: (d.subtasks || []).map((s: any) => ({
          id: s.id,
          title: s.title || 'Untitled Subtask',
          done: s.done || false
        }))
      })) as (Task & { assignedToName?: string; priority?: string })[];
    },
    enabled: !!user && !!orgId
  });
}

// Files
export function useFiles(projectId?: string) {
  const { user, orgId } = useAuth();
  return useQuery({
    queryKey: ['files', projectId, user?.id, user?.role, orgId],
    queryFn: async () => {
      if (!orgId) return [];

      let query = supabase.from('files').select('*').eq('org_id', orgId).order('created_at', { ascending: false });

      if (user?.role === 'client') {
        const { data: client } = await supabase.from('clients').select('id').eq('user_id', user.id).eq('org_id', orgId).single();
        if (client) {
          const { data: clientProjects } = await supabase.from('projects').select('id').eq('client_id', client.id).eq('org_id', orgId);
          const projectIds = clientProjects?.map((p: any) => p.id) || [];
          if (projectIds.length > 0) query = query.in('project_id', projectIds);
          else return [];
        } else {
          return [];
        }
      } else if (user?.role === 'developer' || user?.role === 'support') {
        const { data: memberProjects } = await supabase.from('project_members').select('project_id').eq('user_id', user.id);
        const projectIds = memberProjects?.map((p: any) => p.project_id) || [];
        if (projectIds.length > 0) query = query.in('project_id', projectIds);
        else return [];
      } else if (projectId) {
        query = query.eq('project_id', projectId);
      }

      const { data, error } = await query;
      if (error) throw error;
      if (!data || data.length === 0) return [];

      const uploaderIds = [...new Set(data.map((d: any) => d.uploaded_by).filter(Boolean))];
      let profileMap: Record<string, string> = {};
      if (uploaderIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', uploaderIds);
        profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.id, p.name]));
      }

      return data.map((d: any) => ({
        id: d.id,
        name: d.name,
        projectId: d.project_id,
        uploadedBy: d.uploaded_by,
        uploaderName: profileMap[d.uploaded_by] || 'Unknown',
        fileUrl: d.storage_path || d.file_url,
        size: d.size || 0,
        type: d.type || 'document',
        createdAt: d.created_at
      }));
    },
    enabled: !!user && !!orgId
  });
}

// Invoices
export function useInvoices(clientId?: string) {
  const { user, orgId } = useAuth();
  return useQuery({
    queryKey: ['invoices', clientId, user?.id, user?.role, orgId],
    queryFn: async () => {
      if (!orgId) return [];

      let query = supabase.from('invoices').select('*, invoice_items(*)').eq('org_id', orgId).order('created_at', { ascending: false });

      if (user?.role === 'client') {
        const { data: client } = await supabase.from('clients').select('id').eq('user_id', user.id).eq('org_id', orgId).single();
        if (client) query = query.eq('client_id', client.id);
        else return [];
      } else if (user?.role === 'developer' || user?.role === 'support') {
        return [];
      } else if (clientId) {
        query = query.eq('client_id', clientId);
      }

      const { data, error } = await query;
      if (error) throw error;
      if (!data) return [];

      return data.map((d: any) => ({
        id: d.id,
        clientId: d.client_id,
        projectId: d.project_id,
        amount: Number(d.amount || 0),
        status: d.status || 'pending',
        dueDate: d.due_date,
        items: (d.invoice_items || []).map((i: any) => ({
          description: i.description || 'Item',
          amount: Number(i.amount || 0)
        })),
        createdAt: d.created_at
      })) as Invoice[];
    },
    enabled: !!user && !!orgId
  });
}// Notifications
export function useNotifications() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((d: any) => ({
        id: d.id,
        userId: d.user_id,
        title: d.title,
        message: d.message,
        read: d.read,
        createdAt: d.created_at
      })) as Notification[];
    },
    enabled: !!user
  });
}

// Team Members
export function useTeamMembers() {
  const { user, orgId } = useAuth();
  return useQuery({
    queryKey: ['team', user?.role, orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('org_id', orgId);

      if (error) throw error;

      return (data || []).filter((d: any) => d.role !== 'client').map((d: any) => ({
        id: d.id,
        name: d.name || (d.email?.split('@')[0] || 'User'),
        email: d.email,
        role: d.role,
        avatar: null
      }));
    },
    enabled: !!user && !!orgId && user.role !== 'client'
  });
}

// Mutation: Add Client (via Edge Function)
export function useCreateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (clientData: any) => {
      return invokeEdgeFunction('create-client', clientData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['team'] });
    }
  });
}

// Mutation: Update Client
export function useUpdateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; company?: string; email?: string; phone?: string }) => {
      const { error } = await supabase.from('clients').update(data).eq('id', id);
      if (error) throw new Error(error.message);
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    }
  });
}

// Mutation: Delete Client
export function useDeleteClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('clients').delete().eq('id', id);
      if (error) throw new Error(error.message);
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    }
  });
}

// Helper to handle edge function responses
async function invokeEdgeFunction(functionName: string, body: any) {
  console.log(`Invoking edge function: ${functionName}`, body);
  
  const { data, error } = await supabase.functions.invoke(functionName, {
    body
  });
  
  console.log(`Edge function response:`, { data, error });
  
  if (error) {
    console.error(`Edge function error (${functionName}):`, error);
    // Try to get the actual error message from the response body
    // supabase.functions.invoke puts the parsed body in error.context for non-2xx responses
    const context = (error as any).context;
    if (context) {
      try {
        const bodyText = typeof context === 'string' ? context : await context.text?.();
        const parsed = typeof bodyText === 'string' ? JSON.parse(bodyText) : bodyText;
        if (parsed?.error) throw new Error(parsed.error);
      } catch (parseErr: any) {
        if (parseErr.message && parseErr.message !== 'Unexpected end of JSON input') {
          throw parseErr;
        }
      }
    }
    throw new Error(error.message || 'Unknown error');
  }
  
  // Handle cases where the function returns an error in the response body
  if (data && typeof data === 'object' && 'error' in data) {
    throw new Error(data.error);
  }
  
  return data;
}

// Mutation: Add Team Member (via Edge Function)
export function useCreateTeamMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userData: any) => {
      return invokeEdgeFunction('create-user', { ...userData, action: 'create' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
    }
  });
}

// Mutation: Update Team Member (direct DB update — RLS allows admin/manager/self)
export function useUpdateTeamMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, name, email }: { userId: string, name?: string, email?: string }) => {
      const updateData: Record<string, string> = {};
      if (name?.trim()) updateData.name = name.trim();
      if (email?.trim()) updateData.email = email.trim();

      if (Object.keys(updateData).length === 0) throw new Error('No fields to update');

      const { error } = await supabase.from('profiles').update(updateData).eq('id', userId);
      if (error) throw new Error(error.message);
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
    }
  });
}

// Mutation: Delete Team Member (via Edge Function)
export function useDeleteTeamMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      return invokeEdgeFunction('create-user', { action: 'delete', userId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
    }
  });
}

// Mutation: Change Role (via Edge Function)
export function useChangeUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string, role: string }) => {
      return invokeEdgeFunction('create-user', { action: 'changeRole', userId, role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
    }
  });
}

export function useMessages(projectId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['messages', user?.id, projectId],
    queryFn: async () => {
      if (!user || !projectId) return [];

      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          profiles (
            id,
            name,
            avatar_url
          )
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });
        
      if (error) throw error;
      return (data || []).map((d: any) => ({
        id: d.id,
        senderId: d.sender_id,
        projectId: d.project_id,
        content: d.content,
        createdAt: d.created_at,
        senderProfile: d.profiles ? {
          id: d.profiles.id,
          name: d.profiles.name || d.profiles.full_name,
          avatarUrl: d.profiles.avatar_url
        } : undefined
      })) as Message[];
    },
    enabled: !!user && !!projectId
  });
}

// Mutation: Send Message
export function useSendMessage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ content, projectId }: { content: string, projectId: string }) => {
      if (!user) throw new Error('Not authenticated');
      
      // Check project status - block messages if cancelled (unless admin)
      const isAdmin = user.role === 'admin' || user.role === 'super_admin';
      if (!isAdmin) {
        const { data: project } = await supabase
          .from('projects')
          .select('status')
          .eq('id', projectId)
          .single();
        
        if (project && project.status === 'cancelled') {
          throw new Error('Project is cancelled - cannot send messages');
        }
      }
      
      console.log({
        message: content,
        userId: user?.id,
        projectId: projectId
      });

      const { data, error } = await supabase
        .from('messages')
        .insert([{
          content: content,
          sender_id: user.id,
          project_id: projectId
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['messages', user?.id, variables.projectId] });
    }
  });
}

// Approval Requests
export function useApprovalRequests(projectId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['approvals', projectId, user?.id, user?.role],
    queryFn: async () => {
      let query = supabase.from('approval_requests')
        .select('*, profiles!approval_requests_requested_by_fkey(name)')
        .order('created_at', { ascending: false });
      
      // Admin/Manager sees all pending approvals
      if (user?.role === 'admin' || user?.role === 'manager' || user?.role === 'super_admin') {
        // See all, optionally filter by project
        if (projectId) {
          query = query.eq('project_id', projectId);
        }
      } else {
        // Others see only their requests
        query = query.eq('requested_by', user?.id);
        if (projectId) {
          query = query.eq('project_id', projectId);
        }
      }
      
      const { data, error } = await query;
      console.log("🛠️ USE_APPROVALS: Raw Response", { count: data?.length, error: error?.message });
      
      if (error) throw error;
      return (data || []).map((d: any) => ({
        id: d.id,
        projectId: d.project_id,
        requestedBy: d.requested_by,
        requesterName: d.profiles?.name || 'Unknown',
        changeType: d.change_type,
        oldValue: d.old_value,
        newValue: d.new_value,
        status: d.status, // pending, approved, rejected
        createdAt: d.created_at
      }));
    },
    enabled: !!user
  });
}

// Mutation: Create Approval Request
export function useCreateApprovalRequest() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({ projectId, changeType, oldValue, newValue }: { 
      projectId: string, 
      changeType: string, 
      oldValue: string, 
      newValue: string 
    }) => {
      if (!user) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('approval_requests')
        .insert([{
          project_id: projectId,
          requested_by: user.id,
          change_type: changeType,
          old_value: oldValue,
          new_value: newValue,
          status: 'pending'
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
    }
  });
}

// Mutation: Approve/Reject Request
export function useUpdateApprovalRequest() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({ requestId, action, projectId, field, newValue }: { 
      requestId: string, 
      action: 'approved' | 'rejected',
      projectId?: string,
      field?: string,
      newValue?: string
    }) => {
      if (!user) throw new Error('Not authenticated');
      if (user.role !== 'admin' && user.role !== 'manager' && user.role !== 'super_admin') {
        throw new Error('Not authorized to approve/reject requests');
      }
      
      // Update the approval request status
      const { error: updateError } = await supabase
        .from('approval_requests')
        .update({ status: action })
        .eq('id', requestId);
      
      if (updateError) throw updateError;
      
      // If approved, apply the changes to the project
      if (action === 'approved' && projectId && field && newValue) {
        const { error: projectError } = await supabase
          .from('projects')
          .update({ [field]: newValue })
          .eq('id', projectId);
        
        if (projectError) throw projectError;
      }
      
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    }
  });
}

// ── Roles ────────────────────────────────────────────────────────────────────

export interface Role {
  id: string;
  name: string;
  powerLevel: number;
  permissions: Record<string, boolean>;
  isSystem: boolean;
  createdAt: string;
}

export function useRoles() {
  const { user, orgId } = useAuth();
  return useQuery({
    queryKey: ['roles', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('roles')
        .select('*')
        .order('power_level', { ascending: false });
      if (error) throw error;
      return (data || []).map((r: any) => ({
        id: r.id,
        name: r.name,
        powerLevel: r.power_level,
        permissions: r.permissions || {},
        isSystem: r.is_system,
        createdAt: r.created_at,
      })) as Role[];
    },
    // Roles are only relevant for business users with an org
    enabled: !!user && !!orgId,
    // Return empty array immediately if not enabled — no blocking
    placeholderData: [],
  });
}

export function useCreateRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (role: { name: string; powerLevel: number; permissions: Record<string, boolean> }) => {
      const { error } = await supabase.from('roles').insert({
        name: role.name,
        power_level: role.powerLevel,
        permissions: role.permissions,
        is_system: false,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['roles'] }),
  });
}

export function useUpdateRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (role: { id: string; name: string; powerLevel: number; permissions: Record<string, boolean> }) => {
      const { error } = await supabase.from('roles').update({
        name: role.name,
        power_level: role.powerLevel,
        permissions: role.permissions,
      }).eq('id', role.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['roles'] }),
  });
}

export function useDeleteRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('roles').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['roles'] }),
  });
}

export function useAssignRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, roleId }: { userId: string; roleId: string }) => {
      const { error } = await supabase.from('profiles').update({ role_id: roleId }).eq('id', userId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
  });
}
