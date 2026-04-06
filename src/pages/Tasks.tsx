import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { CheckCircle2, Circle, Clock, Loader2, Calendar, User, Layout, Filter, Search, MoreHorizontal, Edit3, Trash2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TaskStatus, Task } from '@/types';
import { TaskFormModal } from '@/components/FormModals';
import { useTasks, useProjects, useTeamMembers } from '@/hooks/use-database';
import { usePermissions } from '@/hooks/use-permissions';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { api } from '@/lib/apiClient';
import { useToast } from '@/hooks/use-toast';

const statusConfig: Record<TaskStatus, { icon: React.ElementType; label: string; style: string, badge: string }> = {
  todo: { icon: Circle, label: 'To Do', style: 'text-muted-foreground', badge: 'bg-muted text-muted-foreground' },
  in_progress: { icon: Clock, label: 'In Progress', style: 'text-blue-600', badge: 'bg-blue-50 text-blue-600 border-blue-100' },
  done: { icon: CheckCircle2, label: 'Done', style: 'text-emerald-600', badge: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
};

const priorityColors: Record<string, string> = {
  low: 'bg-slate-100 text-slate-700 border-slate-200',
  medium: 'bg-blue-50 text-blue-700 border-blue-200',
  high: 'bg-amber-50 text-amber-700 border-amber-200',
  urgent: 'bg-rose-50 text-rose-700 border-rose-200',
};

export default function Tasks() {
  const [filter, setFilter] = useState<TaskStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [localTasks, setLocalTasks] = useState<Task[]>([]);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const { user } = useAuth();
  const { data: tasks, isLoading, refetch } = useTasks();
  const { data: projects } = useProjects();
  const { data: teamMembers } = useTeamMembers();
  const { toast } = useToast();
  
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isClientUser = user?.role === 'client';
  const { canDeleteTask, canManageTasks } = usePermissions();

  useEffect(() => {
    if (tasks) {
      setLocalTasks(tasks as Task[]);
    }
  }, [tasks]);

  const updateTaskStatus = async (id: string, status: TaskStatus) => {
    try {
      setLocalTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
      await api.patch(`/tasks/${id}`, { status });
      toast({ title: 'Task Updated', description: `Status changed to ${statusConfig[status].label}` });
      refetch();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
      if (tasks) setLocalTasks(tasks as Task[]);
    }
  };

  const deleteTask = async (id: string) => {
    try {
      setLocalTasks(prev => prev.filter(t => t.id !== id));
      await api.delete(`/tasks/${id}`);
      toast({ title: 'Task Deleted', description: 'Task has been removed' });
      refetch();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
      if (tasks) setLocalTasks(tasks as Task[]);
    }
  };

  const filtered = (localTasks || [])
    .filter(t => filter === 'all' || t.status === filter)
    .filter(t => (t.title || "").toLowerCase().includes(search.toLowerCase()) || (t.description || "").toLowerCase().includes(search.toLowerCase()));

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {isClientUser ? 'My Tasks' : 'Task Management'}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            {isClientUser ? 'View your assigned tasks.' : 'Coordinate deliverables and track progress across all projects.'}
          </p>
        </div>
        {!isClientUser && <TaskFormModal onSuccess={() => refetch()} />}
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-2 border-b border-border/30 pb-6">
        <div className="flex items-center gap-1.5 p-1 bg-accent/40 rounded-lg border border-border/50">
          {(['all', 'todo', 'in_progress', 'done'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={cn(
                'px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-md transition-all',
                filter === s ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {s === 'all' ? 'All' : statusConfig[s].label}
            </button>
          ))}
        </div>

        <div className="relative w-full max-w-sm group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
          <Input 
            placeholder="Search tasks..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            className="pl-9 bg-card border-border/50 focus:ring-primary/20" 
          />
        </div>
      </div>

      <div className="grid gap-3">
        {filtered.length === 0 && (
          <div className="py-20 text-center border-2 border-dashed border-border/50 rounded-2xl opacity-40">
             <Layout className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
             <p className="text-sm font-medium italic">No tasks found matching your criteria.</p>
          </div>
        )}
        {filtered.map(task => {
          const cfg = statusConfig[task.status as TaskStatus] || statusConfig.todo;
          const project = projects?.find(p => p.id === task.projectId);
          const assignee = teamMembers?.find(u => u.id === task.assignedToId);
          const subtasksCount = task.subtasks?.length || 0;
          const subtasksDone = task.subtasks?.filter(s => s.done).length || 0;
          const progress = subtasksCount > 0 ? (subtasksDone / subtasksCount) * 100 : 0;

          return (
            <div key={task.id} className="group relative flex flex-col sm:flex-row sm:items-center gap-4 rounded-xl border border-border/50 bg-card p-5 hover:shadow-md transition-all duration-300 hover:border-primary/20">
              <div className="flex items-center gap-4 flex-1">
                <button 
                  onClick={() => !isClientUser && updateTaskStatus(task.id, task.status === 'done' ? 'todo' : 'done')}
                  disabled={isClientUser}
                  className={cn(
                    'h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all shrink-0',
                    task.status === 'done' ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-muted-foreground/30 hover:border-primary',
                    isClientUser && 'cursor-default opacity-60'
                  )}
                >
                  {task.status === 'done' && <CheckCircle2 className="h-4 w-4" />}
                </button>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className={cn('text-sm font-bold transition-all', task.status === 'done' ? 'text-muted-foreground line-through' : 'text-foreground')}>
                      {task.title}
                    </p>
                    <Badge variant="outline" className="text-[9px] font-bold tracking-tighter h-4 px-1.5 bg-accent/30 border-border/50">
                      {project?.title || 'Unknown Project'}
                    </Badge>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-4 text-[11px] font-bold text-muted-foreground/70">
                    <Badge variant="outline" className={cn("text-[9px] font-bold tracking-tighter h-4 px-1.5 uppercase", priorityColors[(task as any).priority || 'medium'])}>
                      {(task as any).priority || 'medium'}
                    </Badge>
                    {((task as any).assignedToName || assignee) && (
                      <div className="flex items-center gap-1.5 text-foreground">
                        <User className="h-3 w-3" />
                        <span>{(task as any).assignedToName || assignee?.name}</span>
                      </div>
                    )}
                    {task.dueDate && (
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3 w-3" />
                        <span className={new Date(task.dueDate) < new Date() && task.status !== 'done' ? 'text-rose-500' : ''}>
                          {new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    )}
                    {subtasksCount > 0 && (
                       <div className="flex items-center gap-2 min-w-[80px]">
                          <Progress value={progress} className="h-1 w-12 bg-muted/50" />
                          <span>{subtasksDone}/{subtasksCount}</span>
                       </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 border-border/30 pt-3 sm:pt-0 mt-3 sm:mt-0">
                 <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-widest border', cfg.badge)}>
                  {cfg.label}
                </span>

                {!isClientUser && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="p-2 hover:bg-accent rounded-full transition-colors opacity-0 group-hover:opacity-100">
                      <MoreHorizontal size={16} className="text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel>Task Options</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <TaskFormModal 
                       initialData={task} 
                       onSuccess={() => refetch()} 
                       trigger={
                         <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                           <Edit3 className="h-4 w-4 mr-2" /> Edit Details
                         </DropdownMenuItem>
                       }
                    />
                    {canDeleteTask && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => deleteTask(task.id)} className="text-destructive focus:text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" /> Delete Task
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => updateTaskStatus(task.id, 'todo')} disabled={task.status === 'todo'}>
                      <Circle className="h-4 w-4 mr-2" /> Mark as To Do
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => updateTaskStatus(task.id, 'in_progress')} disabled={task.status === 'in_progress'}>
                      <Clock className="h-4 w-4 mr-2" /> Mark In Progress
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => updateTaskStatus(task.id, 'done')} disabled={task.status === 'done'}>
                      <CheckCircle2 className="h-4 w-4 mr-2" /> Mark Completed
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
