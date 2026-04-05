export type UserRole = 'super_admin' | 'admin' | 'manager' | 'developer' | 'support' | 'client';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  orgId?: string;
  avatar?: string;
  createdAt: string;
}

export interface Client {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  userId?: string;
  createdAt: string;
}

export type ProjectStatus = 'pending' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';

export interface Project {
  id: string;
  title: string;
  description: string;
  clientId: string;
  manager_id?: string;
  developer_ids?: string[];
  status: ProjectStatus;
  progress: number;
  deadline: string;
  createdAt: string;
  budget_total: number;
  budget_spent: number;
  members?: ProjectMember[];
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  profiles?: {
    name: string;
    email: string;
    avatar?: string;
    role: UserRole;
  };
}

export type TaskStatus = 'todo' | 'in_progress' | 'done';

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  assignedToId?: string; // Legacy
  assigned_to?: string; 
  status: TaskStatus;
  priority?: string;
  dueDate?: string;
  subtasks?: { id: string; title: string; done: boolean }[];
  createdAt: string;
  profiles?: {
    name?: string | null;
    full_name?: string | null;
  };
}

export interface Message {
  id: string;
  senderId: string;
  projectId: string;
  content: string;
  createdAt: string;
  senderProfile?: {
    id: string;
    name?: string | null;
    avatarUrl?: string | null;
  };
}

export type InvoiceStatus = 'paid' | 'pending' | 'overdue' | 'cancelled' | 'on_hold';

export interface Invoice {
  id: string;
  clientId: string;
  projectId?: string;
  amount: number;
  status: InvoiceStatus;
  dueDate: string;
  items: { description: string; amount: number }[];
  createdAt: string;
}

export interface FileItem {
  id: string;
  name: string;
  projectId?: string;
  project_id?: string;
  uploadedBy?: string;
  uploaded_by?: string;
  file_url?: string;
  url?: string;
  size?: number;
  type?: string;
  createdAt: string;
  created_at?: string;
  profiles?: {
    name?: string | null;
    full_name?: string | null;
  };
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}
