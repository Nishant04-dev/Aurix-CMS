import type { User, Client, Project, Task, Message, Invoice, FileItem, Notification } from '@/types';

export const users: User[] = [
  { id: 'u1', name: 'Sarah Mitchell', email: 'sarah@aurix.com', role: 'admin', createdAt: '2024-01-01' },
  { id: 'u2', name: 'James Carter', email: 'james@aurix.com', role: 'manager', createdAt: '2024-01-15' },
  { id: 'u3', name: 'Emily Chen', email: 'emily@aurix.com', role: 'developer', createdAt: '2024-02-01' },
  { id: 'u4', name: 'Michael Torres', email: 'michael@novacorp.com', role: 'client', createdAt: '2024-02-10' },
  { id: 'u5', name: 'Lisa Park', email: 'lisa@brightedge.io', role: 'client', createdAt: '2024-03-01' },
];

export const clients: Client[] = [
  { id: 'c1', name: 'Michael Torres', company: 'NovaCorp', email: 'michael@novacorp.com', phone: '+1 555-0101', userId: 'u4', createdAt: '2024-02-10' },
  { id: 'c2', name: 'Lisa Park', company: 'BrightEdge', email: 'lisa@brightedge.io', phone: '+1 555-0102', userId: 'u5', createdAt: '2024-03-01' },
  { id: 'c3', name: 'David Kim', company: 'Streamline Inc', email: 'david@streamline.co', phone: '+1 555-0103', createdAt: '2024-03-15' },
];

export const projects: Project[] = [
  { id: 'p1', title: 'NovaCorp Website Redesign', description: 'Complete overhaul of the corporate website with modern design system and CMS integration.', clientId: 'c1', status: 'in_progress', progress: 65, deadline: '2024-06-30', createdAt: '2024-03-01' },
  { id: 'p2', title: 'BrightEdge Mobile App', description: 'Native iOS and Android application for customer engagement and loyalty program.', clientId: 'c2', status: 'in_progress', progress: 40, deadline: '2024-08-15', createdAt: '2024-03-15' },
  { id: 'p3', title: 'Streamline Brand Identity', description: 'Logo, brand guidelines, and marketing collateral for company rebrand.', clientId: 'c3', status: 'pending', progress: 10, deadline: '2024-07-01', createdAt: '2024-04-01' },
  { id: 'p4', title: 'NovaCorp SEO Optimization', description: 'Technical SEO audit and implementation for improved organic search visibility.', clientId: 'c1', status: 'completed', progress: 100, deadline: '2024-04-15', createdAt: '2024-02-01' },
];

export const tasks: Task[] = [
  { id: 't1', projectId: 'p1', title: 'Design homepage mockup', assigneeId: 'u2', status: 'done', dueDate: '2024-04-01', subtasks: [{ id: 's1', title: 'Wireframe', done: true }, { id: 's2', title: 'High-fidelity design', done: true }], createdAt: '2024-03-05' },
  { id: 't2', projectId: 'p1', title: 'Develop frontend components', assigneeId: 'u3', status: 'in_progress', dueDate: '2024-05-15', subtasks: [{ id: 's3', title: 'Navigation', done: true }, { id: 's4', title: 'Hero section', done: false }], createdAt: '2024-03-10' },
  { id: 't3', projectId: 'p1', title: 'CMS integration', assigneeId: 'u2', status: 'todo', dueDate: '2024-06-01', createdAt: '2024-03-10' },
  { id: 't4', projectId: 'p2', title: 'User authentication flow', assigneeId: 'u3', status: 'in_progress', dueDate: '2024-05-01', createdAt: '2024-03-20' },
  { id: 't5', projectId: 'p2', title: 'Push notification setup', assigneeId: 'u2', status: 'todo', dueDate: '2024-06-15', createdAt: '2024-03-20' },
  { id: 't6', projectId: 'p3', title: 'Logo concepts', assigneeId: 'u2', status: 'todo', dueDate: '2024-05-01', createdAt: '2024-04-05' },
];

export const messages: Message[] = [
  { id: 'm1', senderId: 'u1', recipientId: 'u4', projectId: 'p1', content: 'Hi Michael, the homepage design is ready for your review. Let me know your thoughts.', createdAt: '2024-04-10T10:30:00' },
  { id: 'm2', senderId: 'u4', recipientId: 'u1', projectId: 'p1', content: 'Looks great! Can we tweak the color scheme slightly? I will send some references.', createdAt: '2024-04-10T11:15:00' },
  { id: 'm3', senderId: 'u1', recipientId: 'u5', projectId: 'p2', content: 'Lisa, the app prototype is ready. When would you like to schedule a walkthrough?', createdAt: '2024-04-11T09:00:00' },
  { id: 'm4', senderId: 'u5', recipientId: 'u1', projectId: 'p2', content: 'How about Thursday at 2pm? I will have my team join as well.', createdAt: '2024-04-11T09:45:00' },
];

export const invoices: Invoice[] = [
  { id: 'i1', clientId: 'c1', projectId: 'p1', amount: 15000, status: 'pending', dueDate: '2024-05-15', items: [{ description: 'Website Design Phase', amount: 8000 }, { description: 'Frontend Development (50%)', amount: 7000 }], createdAt: '2024-04-01' },
  { id: 'i2', clientId: 'c2', projectId: 'p2', amount: 25000, status: 'pending', dueDate: '2024-05-30', items: [{ description: 'Mobile App Design', amount: 12000 }, { description: 'Development Sprint 1', amount: 13000 }], createdAt: '2024-04-05' },
  { id: 'i3', clientId: 'c1', projectId: 'p4', amount: 5000, status: 'paid', dueDate: '2024-04-01', items: [{ description: 'SEO Audit', amount: 2000 }, { description: 'Implementation', amount: 3000 }], createdAt: '2024-03-01' },
  { id: 'i4', clientId: 'c3', projectId: 'p3', amount: 8000, status: 'overdue', dueDate: '2024-04-10', items: [{ description: 'Brand Strategy', amount: 3000 }, { description: 'Logo Design (Deposit)', amount: 5000 }], createdAt: '2024-03-20' },
];

export const files: FileItem[] = [
  { id: 'f1', name: 'homepage-mockup-v2.fig', projectId: 'p1', uploadedBy: 'u2', size: 4200000, type: 'design', url: '#', createdAt: '2024-04-05' },
  { id: 'f2', name: 'brand-guidelines.pdf', projectId: 'p1', uploadedBy: 'u1', size: 1500000, type: 'document', url: '#', createdAt: '2024-03-20' },
  { id: 'f3', name: 'app-wireframes.pdf', projectId: 'p2', uploadedBy: 'u3', size: 3800000, type: 'document', url: '#', createdAt: '2024-04-01' },
  { id: 'f4', name: 'logo-concepts.ai', projectId: 'p3', uploadedBy: 'u2', size: 8500000, type: 'design', url: '#', createdAt: '2024-04-08' },
  { id: 'f5', name: 'seo-report-final.pdf', projectId: 'p4', uploadedBy: 'u1', size: 920000, type: 'document', url: '#', createdAt: '2024-04-12' },
];

export const notifications: Notification[] = [
  { id: 'n1', userId: 'u1', title: 'New message', message: 'Michael Torres replied to your message', read: false, createdAt: '2024-04-10T11:15:00' },
  { id: 'n2', userId: 'u1', title: 'Invoice overdue', message: 'Invoice #INV-004 for Streamline Inc is overdue', read: false, createdAt: '2024-04-11T08:00:00' },
  { id: 'n3', userId: 'u1', title: 'Task completed', message: 'James Carter completed "Design homepage mockup"', read: true, createdAt: '2024-04-09T16:30:00' },
  { id: 'n4', userId: 'u4', title: 'Project update', message: 'Website Redesign progress updated to 65%', read: false, createdAt: '2024-04-10T14:00:00' },
];
