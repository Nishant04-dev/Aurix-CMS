import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { projects, clients, tasks } from '@/data/mock';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ProjectStatus } from '@/types';
import { ProjectFormModal } from '@/components/FormModals';
import { cn } from '@/lib/utils';
import type { ProjectStatus } from '@/types';

const statusStyles: Record<ProjectStatus, string> = {
  pending: 'bg-muted text-muted-foreground',
  in_progress: 'bg-primary/10 text-primary',
  completed: 'bg-success/10 text-success',
  on_hold: 'bg-warning/10 text-warning',
};

const statusLabels: Record<ProjectStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  on_hold: 'On Hold',
};

export default function Projects() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const isClient = user?.role === 'client';
  const clientRecord = isClient ? clients.find(c => c.userId === user?.id) : null;

  const filtered = projects
    .filter(p => !isClient || p.clientId === clientRecord?.id)
    .filter(p => p.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Projects</h1>
        {!isClient && <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New Project</Button>}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search projects..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Project</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Client</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Progress</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Deadline</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer">
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground">{p.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{p.description}</p>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">
                  {clients.find(c => c.id === p.clientId)?.company}
                </td>
                <td className="px-4 py-3">
                  <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium', statusStyles[p.status])}>
                    {statusLabels[p.status]}
                  </span>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-20 rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${p.progress}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground">{p.progress}%</span>
                  </div>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                  {new Date(p.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
