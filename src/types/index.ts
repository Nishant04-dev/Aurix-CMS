export type UserRole = 'admin' | 'team' | 'client';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
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

export type ProjectStatus = 'pending' | 'in_progress' | 'completed' | 'on_hold';

export interface Project {
  id: string;
  title: string;
  description: string;
  clientId: string;
  status: ProjectStatus;
  progress: number;
  deadline: string;
  createdAt: string;
}

export type TaskStatus = 'todo' | 'in_progress' | 'done';

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  assigneeId?: string;
  status: TaskStatus;
  dueDate?: string;
  subtasks?: { id: string; title: string; done: boolean }[];
  createdAt: string;
}

export interface Message {
  id: string;
  senderId: string;
  recipientId: string;
  projectId?: string;
  content: string;
  attachments?: string[];
  createdAt: string;
}

export type InvoiceStatus = 'paid' | 'pending' | 'overdue';

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
  projectId: string;
  uploadedBy: string;
  size: number;
  type: string;
  url: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}
