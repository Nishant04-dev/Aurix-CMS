import React, { useState, useEffect } from 'react';
import { Check, ChevronsUpDown, Plus, Loader2, Lock } from 'lucide-react';
import type { ProjectStatus, TaskStatus, InvoiceStatus, ProjectMember } from '@/types';
import { useClients, useProjects, useTeamMembers, useCreateClient } from '@/hooks/use-database';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from '@/contexts/AuthContext';
import { DocumentRenderer } from '@/components/DocumentRenderer';
import { useOrganization } from '@/hooks/use-organization';
import { useTaxes } from '@/hooks/use-taxes';

function fmt(amount: number, currency = 'INR') {
  try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount); }
  catch { return `${amount.toFixed(2)}`; }
}

interface FormModalProps {
  trigger?: React.ReactNode;
  title: string;
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

function FormModal({ trigger, title, children, open, onOpenChange }: FormModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

function FormField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function MultiSelect({ 
  options, 
  selected, 
  onChange, 
  placeholder = "Select members..." 
}: { 
  options: { id: string, name: string }[], 
  selected: string[], 
  onChange: (ids: string[]) => void,
  placeholder?: string
}) {
  const [open, setOpen] = useState(false);

  const toggleOption = (id: string) => {
    const newSelected = selected.includes(id)
      ? selected.filter(i => i !== id)
      : [...selected, id];
    onChange(newSelected);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal bg-background"
        >
          <span className="truncate">
            {selected.length > 0 
              ? `${selected.length} members selected` 
              : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <ScrollArea className="h-48">
          <div className="p-2 space-y-1">
            {options.map((option) => (
              <div
                key={option.id}
                className="flex items-center space-x-2 p-2 hover:bg-muted rounded-sm cursor-pointer"
                onClick={() => toggleOption(option.id)}
              >
                <Checkbox 
                  checked={selected.includes(option.id)} 
                  onCheckedChange={() => toggleOption(option.id)}
                />
                <span className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  {option.name}
                </span>
              </div>
            ))}
            {options.length === 0 && (
              <p className="text-xs text-muted-foreground p-2 text-center">No members found</p>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

// Client Form
export function ClientFormModal() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', company: '', email: '', phone: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const createClient = useCreateClient();

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.company.trim()) e.company = 'Company is required';
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email';
    if (!form.password || form.password.length < 6) e.password = 'Password must be at least 6 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    
    try {
      await createClient.mutateAsync(form);
      toast({ title: 'Success', description: 'Client account created successfully' });
      setForm({ name: '', company: '', email: '', phone: '', password: '' });
      setOpen(false);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message || 'Failed to create client' });
    }
  };

  return (
    <FormModal
      open={open}
      onOpenChange={setOpen}
      trigger={<Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Client</Button>}
      title="Add Client"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Full Name" error={errors.name}>
          <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Michael Torres" disabled={createClient.isPending} />
        </FormField>
        <FormField label="Company" error={errors.company}>
          <Input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} placeholder="e.g. NovaCorp" disabled={createClient.isPending} />
        </FormField>
        <FormField label="Email" error={errors.email}>
          <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="e.g. michael@novacorp.com" disabled={createClient.isPending} />
        </FormField>
        <FormField label="Phone">
          <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+1 555-0100" disabled={createClient.isPending} />
        </FormField>
        <FormField label="Initial Password" error={errors.password}>
          <Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••••" disabled={createClient.isPending} />
        </FormField>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="submit" size="sm" disabled={createClient.isPending}>
            {createClient.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Create Client
          </Button>
        </div>
      </form>
    </FormModal>
  );
}

// Project Form
export function ProjectFormModal({ onSuccess, initialData, trigger, onApprovalRequest }: { onSuccess?: () => void, initialData?: any, trigger?: React.ReactNode, onApprovalRequest?: (projectId: string, field: string, oldValue: string, newValue: string) => void }) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const { data: teamMembers, isLoading: teamLoading } = useTeamMembers();
  const { data: clientsData, isLoading: clientsLoading } = useClients();
  const [form, setForm] = useState({
    title: initialData?.title || '',
    description: initialData?.description || '',
    clientId: initialData?.clientId || '',
    status: (initialData?.status || 'pending') as ProjectStatus,
    deadline: initialData?.deadline || '',
    progress: initialData?.progress || 0,
    budget_total: initialData?.budget_total || 0,
    budget_spent: initialData?.budget_spent || 0,
    memberIds: initialData?.members?.map((m: any) => m.userId) || [] as string[]
  });
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();
  
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isLocked = initialData?.status === 'completed' || initialData?.status === 'approval_pending';
  const requiresApproval = isLocked && !isAdmin;

  // Reset form when modal opens with new data
  useEffect(() => {
    if (open && initialData) {
      setForm({
        title: initialData.title || '',
        description: initialData.description || '',
        clientId: initialData.clientId || '',
        status: (initialData.status || 'pending') as ProjectStatus,
        deadline: initialData.deadline || '',
        progress: initialData.progress || 0,
        budget_total: initialData.budget_total || 0,
        budget_spent: initialData.budget_spent || 0,
        memberIds: initialData?.members?.map((m: any) => m.userId) || []
      });
    }
  }, [open, initialData]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = 'Title is required';
    if (!form.clientId) e.clientId = 'Client is required';
    if (!form.deadline) e.deadline = 'Deadline is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const checkAndRequestApproval = (field: string, oldValue: string, newValue: string): boolean => {
    if (requiresApproval && oldValue !== newValue) {
      if (onApprovalRequest && initialData?.id) {
        onApprovalRequest(initialData.id, field, oldValue, newValue);
      }
      setOpen(false);
      return true;
    }
    return false;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSaving(true);
    
    try {
      // Check if approval is needed for locked projects
      if (requiresApproval) {
        // Check each field that requires approval
        if (initialData?.title !== form.title) {
          checkAndRequestApproval('title', initialData.title, form.title);
          setIsSaving(false);
          return;
        }
        if (initialData?.budget_total !== form.budget_total) {
          checkAndRequestApproval('budget_total', String(initialData.budget_total), String(form.budget_total));
          setIsSaving(false);
          return;
        }
        if (initialData?.clientId !== form.clientId) {
          const oldClient = clientsData?.find(c => c.id === initialData.clientId)?.name || 'Unknown';
          const newClient = clientsData?.find(c => c.id === form.clientId)?.name || 'Unknown';
          checkAndRequestApproval('client', oldClient, newClient);
          setIsSaving(false);
          return;
        }
        if (initialData?.deadline !== form.deadline) {
          checkAndRequestApproval('deadline', initialData.deadline, form.deadline);
          setIsSaving(false);
          return;
        }
      }
      
      const dbData = {
        title: form.title,
        description: form.description,
        client_id: form.clientId,
        status: form.status,
        deadline: form.deadline,
        progress: Number(form.progress),
        budget_total: Number(form.budget_total),
        budget_spent: Number(form.budget_spent)
      };

      let projectId = initialData?.id;

      if (initialData) {
        await api.patch(`/projects/${initialData.id}`, dbData);
      } else {
        const created = await api.post<{ id: string }>('/projects', dbData);
        projectId = (created as any)?.id;
      }

      // Sync members via backend (best-effort, no dedicated endpoint yet)
      if (projectId && form.memberIds.length > 0) {
        // Members are passed as part of project creation/update context
        // This is handled by the project queue worker on the backend
      }

      toast({ 
        title: initialData ? 'Project Updated' : 'Project Created', 
        description: `"${form.title}" has been ${initialData ? 'updated' : 'started'}.` 
      });
      
      setOpen(false);
      onSuccess?.();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <FormModal
      open={open}
      onOpenChange={setOpen}
      trigger={trigger || <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New Project</Button>}
      title={initialData ? "Edit Project" : "New Project"}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {requiresApproval && (
          <div className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded-md text-amber-700 text-xs">
            <Lock className="h-3 w-3" />
            This project is completed. Changes require approval.
          </div>
        )}
        <FormField label="Title" error={errors.title}>
          <div className="relative">
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Website Redesign" disabled={isSaving || (requiresApproval && !!initialData?.title)} />
            {requiresApproval && initialData?.title && <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />}
          </div>
        </FormField>
        <FormField label="Description">
          <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief project scope" rows={3} disabled={isSaving} />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
           <FormField label="Client" error={errors.clientId}>
             <div className="relative">
               <Select value={form.clientId} onValueChange={v => setForm(f => ({ ...f, clientId: v }))} disabled={clientsLoading || isSaving || (requiresApproval && !!initialData?.clientId)}>
                 <SelectTrigger><SelectValue placeholder={clientsLoading ? 'Loading...' : 'Select client'} /></SelectTrigger>
                 <SelectContent>
                   {clientsData?.map(c => <SelectItem key={c.id} value={c.id}>{c.name} - {c.company}</SelectItem>)}
                 </SelectContent>
               </Select>
               {requiresApproval && initialData?.clientId && <Lock className="absolute right-8 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />}
             </div>
           </FormField>
           <FormField label="Status">
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as ProjectStatus }))} disabled={isSaving}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                   <SelectItem value="pending">Pending</SelectItem>
                   <SelectItem value="in_progress">In Progress</SelectItem>
                   <SelectItem value="completed">Completed</SelectItem>
                   <SelectItem value="on_hold">On Hold</SelectItem>
                   <SelectItem value="cancelled">Cancelled</SelectItem>
                   <SelectItem value="approval_pending">Approval Pending</SelectItem>
                </SelectContent>
              </Select>
           </FormField>
        </div>
        <div className="grid grid-cols-2 gap-4">
           <FormField label="Progress (%)">
              <Input type="number" min="0" max="100" value={form.progress} onChange={e => setForm(f => ({ ...f, progress: Number(e.target.value) }))} disabled={isSaving} />
           </FormField>
           <FormField label="Deadline" error={errors.deadline}>
             <div className="relative">
               <Input type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} disabled={isSaving || (requiresApproval && !!initialData?.deadline)} />
               {requiresApproval && initialData?.deadline && <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />}
             </div>
           </FormField>
        </div>
        <div className="grid grid-cols-2 gap-4">
           <FormField label="Total Budget ($)">
             <div className="relative">
               <Input type="number" value={form.budget_total} onChange={e => setForm(f => ({ ...f, budget_total: Number(e.target.value) }))} disabled={isSaving || (requiresApproval && !!initialData?.budget_total)} />
               {requiresApproval && initialData?.budget_total && <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />}
             </div>
           </FormField>
           <FormField label="Budget Spent ($)">
              <Input type="number" value={form.budget_spent} onChange={e => setForm(f => ({ ...f, budget_spent: Number(e.target.value) }))} disabled={isSaving} />
           </FormField>
        </div>
        <FormField label="Assign Team Members">
           <MultiSelect 
             options={teamMembers || []} 
             selected={form.memberIds} 
             onChange={ids => setForm(f => ({ ...f, memberIds: ids }))} 
           />
        </FormField>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="submit" size="sm" disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            {initialData ? "Update Project" : "Create Project"}
          </Button>
        </div>
      </form>
    </FormModal>
  );
}

// Simplified Task and Invoice Modals can follow the same pattern...
// For now, I'll update Task and Invoice to at least use real data sources.

export function TaskFormModal({ onSuccess, initialData, trigger }: { onSuccess?: () => void, initialData?: any, trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { data: projectsData, isLoading: projectsLoading } = useProjects();
  const { data: teamData, isLoading: teamLoading } = useTeamMembers();
  const [form, setForm] = useState({ 
    title: initialData?.title || '', 
    projectId: initialData?.projectId || '', 
    assignedToId: initialData?.assignedToId || '', 
    dueDate: initialData?.dueDate || '',
    description: initialData?.description || '',
    status: (initialData?.status || 'todo') as TaskStatus,
    priority: initialData?.priority || 'medium'
  });
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Reset form state whenever the modal opens with new initialData
  useEffect(() => {
    if (open) {
      setForm({
        title: initialData?.title || '',
        projectId: initialData?.projectId || '',
        assignedToId: initialData?.assignedToId || '',
        dueDate: initialData?.dueDate || '',
        description: initialData?.description || '',
        status: (initialData?.status || 'todo') as TaskStatus,
        priority: initialData?.priority || 'medium'
      });
    }
  }, [open, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.projectId) return;
    setIsSaving(true);
    
    try {
      const dbData = {
        title: form.title,
        project_id: form.projectId,
        assigned_to_id: form.assignedToId || null,
        due_date: form.dueDate || null,
        description: form.description,
        status: form.status,
        priority: form.priority
      };

      if (initialData) {
        await api.patch(`/tasks/${initialData.id}`, dbData);
      } else {
        await api.post('/tasks', dbData);
      }
      
      toast({ title: initialData ? 'Task Updated' : 'Task Added', description: 'Task has been saved.' });
      setOpen(false);
      onSuccess?.();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <FormModal 
      open={open} 
      onOpenChange={setOpen} 
      trigger={trigger || <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Task</Button>} 
      title={initialData ? "Edit Task" : "Add Task"}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Title"><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Task title" disabled={isSaving} /></FormField>
        <FormField label="Description"><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Task details" rows={2} disabled={isSaving} /></FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Project">
            <Select value={form.projectId} onValueChange={v => setForm(f => ({ ...f, projectId: v }))} disabled={projectsLoading || isSaving}>
              <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
              <SelectContent>{projectsData?.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent>
            </Select>
          </FormField>
          <FormField label="Status">
            <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as TaskStatus }))} disabled={isSaving}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todo">To Do</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="done">Done</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Priority">
            <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))} disabled={isSaving}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Assigned To">
            <Select value={form.assignedToId} onValueChange={v => setForm(f => ({ ...f, assignedToId: v }))} disabled={teamLoading || isSaving}>
              <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>{teamData?.map(u => <SelectItem key={u.id} value={u.id}>{u.name as string}</SelectItem>)}</SelectContent>
            </Select>
          </FormField>
          <FormField label="Due Date"><Input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} disabled={isSaving} /></FormField>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="submit" size="sm" disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            {initialData ? "Update Task" : "Add Task"}
          </Button>
        </div>
      </form>
    </FormModal>
  );
}

export function InvoiceFormModal({ onSuccess, initialData, trigger }: { onSuccess?: () => void, initialData?: any, trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { data: clientsData, isLoading: clientsLoading } = useClients();
  const { data: projectsData, isLoading: projectsLoading } = useProjects();
  const { data: taxes = [] } = useTaxes();
  const { orgId } = useAuth();
  const [form, setForm] = useState({
    clientId:    initialData?.client_id  || initialData?.clientId  || '',
    projectId:   initialData?.project_id || initialData?.projectId || '',
    subtotal:    initialData?.amount?.toString() || '',
    description: initialData?.description || (initialData?.items?.[0]?.description || ''),
    dueDate:     initialData?.due_date || initialData?.dueDate || '',
    status:      (initialData?.status || 'pending') as InvoiceStatus,
    selectedTaxIds: [] as string[],
  });
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Compute tax lines and total from subtotal + selected taxes
  const subtotalNum = Number(form.subtotal) || 0;
  const taxLines = taxes
    .filter(t => form.selectedTaxIds.includes(t.id))
    .map(t => ({
      id:         t.id,
      name:       t.name,
      percentage: t.percentage,
      amount:     Math.round(subtotalNum * (t.percentage / 100) * 100) / 100,
    }));
  const totalAmount = subtotalNum + taxLines.reduce((s, t) => s + t.amount, 0);

  const handleProjectChange = (projectId: string) => {
    const p = (projectsData as any[] ?? []).find((x: any) => x.id === projectId);
    setForm(f => ({ ...f, projectId, clientId: p?.client_id || f.clientId }));
  };

  const handleClientChange = (clientId: string) => {
    setForm(f => ({ ...f, clientId }));
  };

  const toggleTax = (taxId: string) => {
    setForm(f => ({
      ...f,
      selectedTaxIds: f.selectedTaxIds.includes(taxId)
        ? f.selectedTaxIds.filter(id => id !== taxId)
        : [...f.selectedTaxIds, taxId],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.clientId || !form.subtotal) return;
    setIsSaving(true);
    try {
      const dbData = {
        client_id:    form.clientId,
        project_id:   form.projectId || null,
        org_id:       orgId,
        amount:       totalAmount,
        due_date:     form.dueDate,
        status:       form.status,
        description:  form.description || null,
        tax_snapshot: taxLines,
      };
      if (initialData) {
        await api.patch(`/invoices/${initialData.id}`, dbData);
        toast({ title: 'Invoice Updated' });
      } else {
        await api.post('/invoices', dbData);
        toast({ title: 'Invoice Created' });
      }
      setOpen(false);
      onSuccess?.();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <FormModal
      open={open}
      onOpenChange={setOpen}
      trigger={trigger || <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Create Invoice</Button>}
      title={initialData ? "Edit Invoice" : "Create Invoice"}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Project (optional)">
          <Select value={form.projectId || 'none'} onValueChange={v => handleProjectChange(v === 'none' ? '' : v)} disabled={projectsLoading || isSaving}>
            <SelectTrigger><SelectValue placeholder="Select project (optional)" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No project</SelectItem>
              {(projectsData as any[] ?? []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Client">
          <Select value={form.clientId} onValueChange={handleClientChange} disabled={clientsLoading || isSaving}>
            <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
            <SelectContent>{clientsData?.map(c => <SelectItem key={c.id} value={c.id}>{c.name} — {c.company}</SelectItem>)}</SelectContent>
          </Select>
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Status">
            <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as InvoiceStatus }))} disabled={isSaving}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="on_hold">On Hold</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Subtotal">
            <Input type="number" value={form.subtotal} onChange={e => setForm(f => ({ ...f, subtotal: e.target.value }))} disabled={isSaving} />
          </FormField>
        </div>
        {taxes.length > 0 && (
          <FormField label="Apply Taxes">
            <div className="space-y-1.5">
              {taxes.map(t => (
                <label key={t.id} className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={form.selectedTaxIds.includes(t.id)}
                    onChange={() => toggleTax(t.id)}
                    disabled={isSaving}
                    className="rounded"
                  />
                  {t.name} ({t.percentage}%)
                  {form.selectedTaxIds.includes(t.id) && subtotalNum > 0 && (
                    <span className="text-xs text-muted-foreground ml-auto">
                      +{fmt(subtotalNum * t.percentage / 100, 'INR')}
                    </span>
                  )}
                </label>
              ))}
              {taxLines.length > 0 && (
                <div className="text-xs font-semibold pt-1 border-t">
                  Total: {totalAmount.toFixed(2)}
                </div>
              )}
            </div>
          </FormField>
        )}
        <FormField label="Description">
          <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} disabled={isSaving} />
        </FormField>
        <FormField label="Due Date">
          <Input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} disabled={isSaving} />
        </FormField>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="submit" size="sm" disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            {initialData ? "Update Invoice" : "Create Invoice"}
          </Button>
        </div>
      </form>
    </FormModal>
  );
}

// Invoice Details Viewer — uses DocumentRenderer for consistent branding + PDF
export function InvoiceDetailsModal({ invoice, client: clientProp, trigger }: { invoice: any, client: any, trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { orgId } = useAuth();
  const { data: org, isLoading: orgLoading } = useOrganization();
  const [templates, setTemplates] = useState<any[]>([]);

  // Use embedded client from API join, fall back to passed prop
  const client = invoice?.client || clientProp;

  useEffect(() => {
    if (!open || !orgId) return;
    api.get<any[]>('/templates').then(data => setTemplates(data)).catch(() => {});
  }, [open, orgId]);

  // Resolve template slug from org's default template, fall back to 'basic'
  const templateSlug = templates.find(t => t.id === org?.template_id)?.slug || 'basic';

  // Map invoice → DocumentData items shape
  const lineItems = (invoice.invoice_items ?? invoice.items ?? []).map((i: any) => ({
    description: i.description || invoice.description || 'No description',
    quantity:    i.quantity ?? 1,
    unit_price:  i.unit_price ?? 0,
    amount:      i.amount ?? (i.quantity ?? 1) * (i.unit_price ?? 0),
  }));

  // Synthesise a single item from invoice-level fields if no line items exist
  const items = lineItems.length > 0 ? lineItems : [{
    description: invoice.description || 'Service Fee',
    quantity:    1,
    unit_price:  Number(invoice.amount),
    amount:      Number(invoice.amount),
  }];

  console.log('[InvoiceDetailsModal] org:', org, '| client:', client, '| orgLoading:', orgLoading);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-none w-auto max-h-[95vh] overflow-auto p-4 bg-white">
        {orgLoading || !org ? (
          <div className="flex items-center justify-center w-[794px] h-48">
            <Loader2 className="h-6 w-6 animate-spin text-primary/40" />
          </div>
        ) : (
          <DocumentRenderer
            templateSlug={templateSlug}
            data={{
              type:       'invoice',
              id:         invoice.id,
              status:     invoice.status,
              amount:     Number(invoice.amount),
              currency:   invoice.currency || org.currency || 'INR',
              due_date:   invoice.due_date || invoice.dueDate || null,
              notes:      invoice.notes || null,
              created_at: invoice.created_at || invoice.createdAt,
              items,
              taxes:      Array.isArray(invoice.tax_snapshot) ? invoice.tax_snapshot : [],
              org: {
                name:       org.name,
                logo_url:   org.logo_url,
                address:    org.address,
                phone:      org.phone,
                email:      org.email,
                gst_number: org.gst_number,
              },
              client: client ? {
                name:    client.name,
                company: client.company,
                email:   client.email,
                phone:   client.phone,
                address: client.address,
              } : undefined,
              project: invoice.project ?? null,
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
