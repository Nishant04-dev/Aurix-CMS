import React, { useState } from 'react';
import { tasks, projects, users } from '@/data/mock';
import { CheckCircle2, Circle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TaskStatus } from '@/types';
import { TaskFormModal } from '@/components/FormModals';

const statusConfig: Record<TaskStatus, { icon: React.ElementType; label: string; style: string }> = {
  todo: { icon: Circle, label: 'To Do', style: 'text-muted-foreground' },
  in_progress: { icon: Clock, label: 'In Progress', style: 'text-primary' },
  done: { icon: CheckCircle2, label: 'Done', style: 'text-success' },
};

export default function Tasks() {
  const [filter, setFilter] = useState<TaskStatus | 'all'>('all');
  const filtered = filter === 'all' ? tasks : tasks.filter(t => t.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Tasks</h1>
        <TaskFormModal />
      </div>

      <div className="flex gap-2">
        {(['all', 'todo', 'in_progress', 'done'] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={cn(
              'px-3 py-1.5 text-xs rounded-md border transition-colors',
              filter === s ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-accent'
            )}
          >
            {s === 'all' ? 'All' : statusConfig[s].label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map(task => {
          const cfg = statusConfig[task.status];
          const project = projects.find(p => p.id === task.projectId);
          const assignee = users.find(u => u.id === task.assigneeId);
          return (
            <div key={task.id} className="flex items-center gap-4 rounded-lg border border-border p-4 hover:bg-muted/30 transition-colors">
              <cfg.icon className={cn('h-5 w-5 shrink-0', cfg.style)} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{task.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">{project?.title}</span>
                  {assignee && <span className="text-xs text-muted-foreground">• {assignee.name}</span>}
                  {task.dueDate && <span className="text-xs text-muted-foreground">• Due {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                </div>
                {task.subtasks && task.subtasks.length > 0 && (
                  <div className="flex items-center gap-1 mt-2">
                    <div className="h-1 w-16 rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${(task.subtasks.filter(s => s.done).length / task.subtasks.length) * 100}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {task.subtasks.filter(s => s.done).length}/{task.subtasks.length}
                    </span>
                  </div>
                )}
              </div>
              <span className={cn('text-xs rounded-md px-2 py-0.5 font-medium', cfg.style === 'text-muted-foreground' ? 'bg-muted' : cfg.style === 'text-primary' ? 'bg-primary/10' : 'bg-success/10')}>
                {cfg.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
