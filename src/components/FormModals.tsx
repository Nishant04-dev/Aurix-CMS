import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { clients, projects, users } from '@/data/mock';
import type { ProjectStatus, TaskStatus, InvoiceStatus } from '@/types';

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

// Client Form
export function ClientFormModal({ onSave }: { onSave?: (data: any) => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', company: '', email: '', phone: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.company.trim()) e.company = 'Company is required';
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    onSave?.(form);
    setForm({ name: '', company: '', email: '', phone: '' });
    setOpen(false);
  };

  return (
    <FormModal
      open={open}
      onOpenChange={setOpen}
      trigger={<Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Client</Button>}
      title="Add Client"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Name" error={errors.name}>
          <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" />
        </FormField>
        <FormField label="Company" error={errors.company}>
          <Input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} placeholder="Company name" />
        </FormField>
        <FormField label="Email" error={errors.email}>
          <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@company.com" />
        </FormField>
        <FormField label="Phone">
          <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+1 555-0100" />
        </FormField>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="submit" size="sm">Save Client</Button>
        </div>
      </form>
    </FormModal>
  );
}

// Project Form
export function ProjectFormModal({ onSave }: { onSave?: (data: any) => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', clientId: '', status: 'pending' as ProjectStatus, deadline: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = 'Title is required';
    if (!form.clientId) e.clientId = 'Client is required';
    if (!form.deadline) e.deadline = 'Deadline is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    onSave?.(form);
    setForm({ title: '', description: '', clientId: '', status: 'pending', deadline: '' });
    setOpen(false);
  };

  return (
    <FormModal
      open={open}
      onOpenChange={setOpen}
      trigger={<Button size="sm"><Plus className="h-4 w-4 mr-1" /> New Project</Button>}
      title="New Project"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Title" error={errors.title}>
          <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Project title" />
        </FormField>
        <FormField label="Description">
          <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description" rows={3} />
        </FormField>
        <FormField label="Client" error={errors.clientId}>
          <Select value={form.clientId} onValueChange={v => setForm(f => ({ ...f, clientId: v }))}>
            <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
            <SelectContent>
              {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name} - {c.company}</SelectItem>)}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Status">
          <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as ProjectStatus }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="on_hold">On Hold</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Deadline" error={errors.deadline}>
          <Input type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />
        </FormField>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="submit" size="sm">Create Project</Button>
        </div>
      </form>
    </FormModal>
  );
}

// Task Form
export function TaskFormModal({ onSave }: { onSave?: (data: any) => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', projectId: '', assigneeId: '', status: 'todo' as TaskStatus, dueDate: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = 'Title is required';
    if (!form.projectId) e.projectId = 'Project is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    onSave?.(form);
    setForm({ title: '', projectId: '', assigneeId: '', status: 'todo', dueDate: '' });
    setOpen(false);
  };

  const teamMembers = users.filter(u => u.role !== 'client');

  return (
    <FormModal
      open={open}
      onOpenChange={setOpen}
      trigger={<Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Task</Button>}
      title="Add Task"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Title" error={errors.title}>
          <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Task title" />
        </FormField>
        <FormField label="Project" error={errors.projectId}>
          <Select value={form.projectId} onValueChange={v => setForm(f => ({ ...f, projectId: v }))}>
            <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
            <SelectContent>
              {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Assignee">
          <Select value={form.assigneeId} onValueChange={v => setForm(f => ({ ...f, assigneeId: v }))}>
            <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
            <SelectContent>
              {teamMembers.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Due Date">
          <Input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
        </FormField>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="submit" size="sm">Add Task</Button>
        </div>
      </form>
    </FormModal>
  );
}

// Invoice Form
export function InvoiceFormModal({ onSave }: { onSave?: (data: any) => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ clientId: '', projectId: '', amount: '', dueDate: '', description: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.clientId) e.clientId = 'Client is required';
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0) e.amount = 'Valid amount is required';
    if (!form.dueDate) e.dueDate = 'Due date is required';
    if (!form.description.trim()) e.description = 'Description is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    onSave?.({ ...form, amount: Number(form.amount) });
    setForm({ clientId: '', projectId: '', amount: '', dueDate: '', description: '' });
    setOpen(false);
  };

  const selectedClientProjects = form.clientId ? projects.filter(p => p.clientId === form.clientId) : [];

  return (
    <FormModal
      open={open}
      onOpenChange={setOpen}
      trigger={<Button size="sm"><Plus className="h-4 w-4 mr-1" /> Create Invoice</Button>}
      title="Create Invoice"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Client" error={errors.clientId}>
          <Select value={form.clientId} onValueChange={v => setForm(f => ({ ...f, clientId: v, projectId: '' }))}>
            <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
            <SelectContent>
              {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name} - {c.company}</SelectItem>)}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Project (optional)">
          <Select value={form.projectId} onValueChange={v => setForm(f => ({ ...f, projectId: v }))}>
            <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
            <SelectContent>
              {selectedClientProjects.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Description" error={errors.description}>
          <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Invoice line item" />
        </FormField>
        <FormField label="Amount ($)" error={errors.amount}>
          <Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" min="0" step="0.01" />
        </FormField>
        <FormField label="Due Date" error={errors.dueDate}>
          <Input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
        </FormField>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="submit" size="sm">Create Invoice</Button>
        </div>
      </form>
    </FormModal>
  );
}
