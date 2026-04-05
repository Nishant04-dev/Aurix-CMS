import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useProjects, useClients, useApprovalRequests, useCreateApprovalRequest, useUpdateApprovalRequest } from '@/hooks/use-database';
import { usePermissions } from '@/hooks/use-permissions';
import { Input } from '@/components/ui/input';
import { Search, Loader2, Calendar, LayoutGrid, List as ListIcon, MoreHorizontal, ArrowRight, Edit3, Pause, Play, CheckCircle2, XCircle, Clock, FileCheck, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ProjectStatus } from '@/types';
import { ProjectFormModal } from '@/components/FormModals';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type ProjectFilter = 'all' | 'active' | 'pending' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled' | 'approval_pending';

const statusStyles: Record<ProjectStatus, string> = {
  pending: 'bg-slate-100 text-slate-600 border-slate-200',
  in_progress: 'bg-blue-50 text-blue-600 border-blue-100',
  completed: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  on_hold: 'bg-amber-50 text-amber-600 border-amber-100',
  cancelled: 'bg-rose-50 text-rose-600 border-rose-100',
  approval_pending: 'bg-purple-50 text-purple-600 border-purple-100',
};

const statusLabels: Record<ProjectStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  on_hold: 'On Hold',
  cancelled: 'Cancelled',
  approval_pending: 'Awaiting Approval',
};

const filterTabs: { value: ProjectFilter; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'approval_pending', label: 'Approval' },
];

export default function Projects() {
  const { user } = useAuth();
  const { data: projects, isLoading, refetch } = useProjects();
  const { data: clients } = useClients();
  const { data: approvals } = useApprovalRequests();
  const createApproval = useCreateApprovalRequest();
  const updateApproval = useUpdateApprovalRequest();
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('list');
  const [filter, setFilter] = useState<ProjectFilter>('active');
  const { toast } = useToast();
  const [confirmAction, setConfirmAction] = useState<{ id: string, status: ProjectStatus } | null>(null);
  const [approvalRequest, setApprovalRequest] = useState<{ projectId: string, field: string, oldValue: string, newValue: string } | null>(null);

  const isClient = user?.role === 'client';
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const canManage = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'super_admin';
  const isLocked = (projectStatus: string) => projectStatus === 'completed' || projectStatus === 'approval_pending';
  const { canEditProject, canDeleteProject, canCancelProject, canAssignMembers, can } = usePermissions();

  // Permission-based guards using dynamic can()
  const canCreate  = can('create_project');
  const canEdit    = can('edit_project');
  const canDelete  = can('delete_project');
  const canCancel  = can('cancel_project');

  const pendingApprovalsCount = approvals?.filter(a => a.status === 'pending').length || 0;

  const updateStatus = async (id: string, status: ProjectStatus) => {
    // Guard: cancel requires cancel_project permission
    if (status === 'cancelled' && !canCancel) {
      toast({ variant: 'destructive', title: 'Permission Denied', description: 'You do not have permission to cancel projects.' });
      return;
    }
    // Guard: other status changes require edit_project
    if (status !== 'cancelled' && !canEdit) {
      toast({ variant: 'destructive', title: 'Permission Denied', description: 'You do not have permission to edit projects.' });
      return;
    }
    try {
      const { error } = await supabase.from('projects').update({ status }).eq('id', id);
      if (error) throw error;
      toast({ title: 'Status Updated', description: `Project is now ${statusLabels[status]}.` });
      refetch();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    }
  };

  const handleApprovalRequest = async () => {
    if (!approvalRequest) return;
    
    try {
      await createApproval.mutateAsync({
        projectId: approvalRequest.projectId,
        changeType: approvalRequest.field,
        oldValue: approvalRequest.oldValue,
        newValue: approvalRequest.newValue
      });
      
      // Update project status to approval_pending
      await supabase.from('projects').update({ status: 'approval_pending' as ProjectStatus }).eq('id', approvalRequest.projectId);
      
      toast({ title: 'Approval Requested', description: 'Your change request has been submitted for approval.' });
      setApprovalRequest(null);
      refetch();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    }
  };

  const handleApproveRequest = async (requestId: string, projectId: string, field: string, newValue: string) => {
    try {
      await updateApproval.mutateAsync({
        requestId,
        action: 'approved',
        projectId,
        field,
        newValue
      });
      toast({ title: 'Approved', description: 'Change has been applied to the project.' });
      refetch();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      await updateApproval.mutateAsync({
        requestId,
        action: 'rejected'
      });
      toast({ title: 'Rejected', description: 'Change request has been rejected.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    }
  };

  console.log("📂 PROJECTS_PAGE: Raw Hook Data", { projectsCount: projects?.length, loading: isLoading });
  
  const filtered = projects?.filter(p => {
    // Search filter
    if (search && !(p.title || "").toLowerCase().includes(search.toLowerCase()) && 
        !(p.description || "").toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    
    // Status filter
    if (filter === 'active') {
      return p.status === 'pending' || p.status === 'in_progress';
    }
    if (filter === 'all') return true;
    if (filter === 'approval_pending') return p.status === 'approval_pending';
    return p.status === filter;
  }) || [];

  console.log("🔍 PROJECTS_PAGE: Filtered Result", { filteredCount: filtered.length, filter, searchString: search });

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
      </div>
    );
  }

  const ProjectActions = ({ project }: { project: any }) => {
    if (!canEdit) return null;
    const isCancelled = project.status === 'cancelled';

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="p-2 hover:bg-accent rounded-full transition-colors">
            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          {!isCancelled && canEdit && (
            <ProjectFormModal
              initialData={project}
              onSuccess={() => refetch()}
              onApprovalRequest={(projectId, field, oldValue, newValue) => {
                setApprovalRequest({ projectId, field, oldValue, newValue });
              }}
              trigger={
                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="cursor-pointer">
                  <Edit3 className="h-4 w-4 mr-2" /> Edit Project
                </DropdownMenuItem>
              }
            />
          )}
          {!isCancelled && canEdit && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => updateStatus(project.id, 'in_progress')} disabled={project.status === 'in_progress'}>
                <Play className="h-4 w-4 mr-2" /> Mark In Progress
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => updateStatus(project.id, 'completed')} disabled={project.status === 'completed'}>
                <CheckCircle2 className="h-4 w-4 mr-2" /> Mark Completed
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => updateStatus(project.id, 'on_hold')} disabled={project.status === 'on_hold' || project.status === 'completed'}>
                <Pause className="h-4 w-4 mr-2" /> Put On Hold
              </DropdownMenuItem>
            </>
          )}
          {canCancel && !isCancelled && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setConfirmAction({ id: project.id, status: 'cancelled' })}
              >
                <XCircle className="h-4 w-4 mr-2" /> Cancel Project
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">{isClient ? 'My Projects' : 'Projects'}</h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium">Manage and track your project progression.</p>
          </div>
          {pendingApprovalsCount > 0 && canManage && (
            <Badge variant="secondary" className="bg-purple-100 text-purple-700 border-purple-200">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {pendingApprovalsCount} Pending Approval{pendingApprovalsCount > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        {canCreate && !isClient && <ProjectFormModal onSuccess={() => refetch()} />}
      </div>

      {/* Status Filter Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 py-2 border-b border-border/30 pb-4">
        <div className="flex items-center gap-1.5 p-1 bg-accent/40 rounded-lg border border-border/50 overflow-x-auto">
          {filterTabs.map(tab => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={cn(
                'px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-md transition-all whitespace-nowrap',
                filter === tab.value ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        
        <div className="relative w-full max-w-sm group ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
          <Input 
            placeholder="Search projects..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            className="pl-9 bg-card border-border/50 focus:ring-primary/20" 
          />
        </div>
        
        <div className="flex items-center gap-1.5 p-1 bg-accent/40 rounded-lg border border-border/50">
          <button 
            onClick={() => setView('list')}
            className={cn('p-1.5 rounded-md transition-all', view === 'list' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground')}
          >
            <ListIcon className="h-4 w-4" />
          </button>
          <button 
             onClick={() => setView('grid')}
             className={cn('p-1.5 rounded-md transition-all', view === 'grid' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground')}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>
      </div>

      {view === 'list' ? (
        <div className="rounded-xl border border-border/50 bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/20">
                  <th className="text-left px-6 py-4 font-bold text-muted-foreground uppercase tracking-widest text-[10px]">Project Details</th>
                  {!isClient && <th className="text-left px-6 py-4 font-bold text-muted-foreground uppercase tracking-widest text-[10px]">Client</th>}
                  <th className="text-left px-6 py-4 font-bold text-muted-foreground uppercase tracking-widest text-[10px]">Status</th>
                  <th className="text-left px-6 py-4 font-bold text-muted-foreground uppercase tracking-widest text-[10px]">Team</th>
                  <th className="text-left px-6 py-4 font-bold text-muted-foreground uppercase tracking-widest text-[10px] min-w-[120px]">Progress</th>
                  <th className="text-left px-6 py-4 font-bold text-muted-foreground uppercase tracking-widest text-[10px]">Budget</th>
                  <th className="text-right px-6 py-4 font-bold text-muted-foreground uppercase tracking-widest text-[10px] min-w-[100px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={isClient ? 5 : 6} className="px-6 py-12 text-center text-muted-foreground">
                      No projects found matching your criteria.
                    </td>
                  </tr>
                )}
                {filtered.map(p => {
                  const budgetRemaining = (p.budget_total || 0) - (p.budget_spent || 0);
                  const budgetPercent = p.budget_total > 0 ? (p.budget_spent / p.budget_total) * 100 : 0;
                  
                  return (
                    <tr key={p.id} className="group hover:bg-accent/30 transition-all duration-200">
                      <td className="px-6 py-4 cursor-pointer">
                        <p className="font-bold text-foreground group-hover:text-primary transition-colors">{p.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{p.description}</p>
                      </td>
                      {!isClient && (
                        <td className="px-6 py-4">
                          <Badge variant="outline" className="font-medium bg-background/50 border-border/50">
                            {clients?.find(c => c.id === p.clientId)?.company || 'Internal Project'}
                          </Badge>
                        </td>
                      )}
                      <td className="px-6 py-4 text-center">
                         <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold border', statusStyles[p.status])}>
                          <div className={cn('h-1 w-1 rounded-full mr-1.5', p.status === 'in_progress' ? 'bg-blue-600 animate-pulse' : 'bg-current')} />
                          {statusLabels[p.status]}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex -space-x-2">
                          <TooltipProvider>
                            {p.members?.slice(0, 3).map((m: any, i: number) => (
                              <Tooltip key={i}>
                                <TooltipTrigger asChild>
                                  <Avatar className="h-7 w-7 border-2 border-background ring-2 ring-transparent group-hover:ring-primary/20 transition-all">
                                    <AvatarFallback className="text-[10px] font-bold bg-muted text-muted-foreground">
                                      {m.profiles?.name?.substring(0, 2).toUpperCase() || '??'}
                                    </AvatarFallback>
                                  </Avatar>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs font-bold">{m.profiles?.name || 'Unknown'}</p>
                                  <p className="text-[10px] text-muted-foreground">{m.profiles?.role}</p>
                                </TooltipContent>
                              </Tooltip>
                            ))}
                            {(p.members?.length || 0) > 3 && (
                              <div className="h-7 w-7 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                                +{p.members.length - 3}
                              </div>
                            )}
                            {(!p.members || p.members.length === 0) && (
                              <span className="text-[10px] text-muted-foreground font-medium italic">Unassigned</span>
                            )}
                          </TooltipProvider>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Progress value={p.progress} className="h-1.5 w-full bg-muted/50" />
                          <span className="text-[11px] font-bold text-foreground min-w-[30px] font-mono">{p.progress}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1 min-w-[120px]">
                          <div className="flex justify-between text-[10px] font-bold">
                            <span className="text-muted-foreground">Spent</span>
                            <span className={cn(budgetRemaining < 0 ? 'text-destructive' : 'text-foreground')}>${p.budget_spent?.toLocaleString()}</span>
                          </div>
                          <Progress value={budgetPercent} className="h-1 w-full bg-muted/50" />
                          <div className="flex justify-between text-[10px] font-bold">
                            <span className="text-muted-foreground">Total</span>
                            <span className="text-foreground">${p.budget_total?.toLocaleString()}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                           <div className="flex flex-col items-end mr-3">
                              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">Deadline</span>
                              <span className="text-xs font-semibold">{p.deadline ? new Date(p.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'No Date'}</span>
                           </div>
                           <ProjectActions project={p} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(p => {
            const budgetRemaining = (p.budget_total || 0) - (p.budget_spent || 0);
            const budgetPercent = p.budget_total > 0 ? (p.budget_spent / p.budget_total) * 100 : 0;

            return (
              <Card key={p.id} className="group flex flex-col hover:shadow-lg transition-all duration-300 border-border/50 overflow-hidden bg-card relative">
                <div className={cn('h-2 w-full', (statusStyles[p.status] || statusStyles.pending).split(' ')[0])} />
                <div className="absolute top-4 right-4 z-10">
                   <ProjectActions project={p} />
                </div>
                <CardContent className="p-6 flex-1 flex flex-col">
                  <div className="flex items-start justify-between mb-4">
                    <div className="space-y-1">
                      <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest border', statusStyles[p.status])}>
                        {statusLabels[p.status]}
                      </span>
                      <h3 className="font-bold text-lg leading-tight group-hover:text-primary transition-colors pr-8">{p.title}</h3>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-6 flex-1">{p.description}</p>
                  
                  <div className="space-y-4 mt-auto">
                    {/* Budget Section */}
                    <div className="p-3 rounded-lg bg-accent/30 border border-border/50 space-y-2">
                       <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        <span>Project Budget</span>
                        <span className={cn(budgetRemaining < 0 ? 'text-destructive' : 'text-foreground')}>
                          ${budgetRemaining.toLocaleString()} Left
                        </span>
                      </div>
                      <Progress value={budgetPercent} className="h-1 bg-muted/50" />
                      <div className="flex justify-between text-[11px] font-bold">
                        <span className="text-muted-foreground/60">${p.budget_spent?.toLocaleString()} spent</span>
                        <span className="text-foreground">${p.budget_total?.toLocaleString()}</span>
                      </div>
                    </div>

                     <div className="space-y-2">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-muted-foreground uppercase tracking-widest text-[9px]">Completion</span>
                        <span className="text-foreground font-mono">{p.progress}%</span>
                      </div>
                      <Progress value={p.progress} className="h-1.5 bg-muted/50" />
                    </div>

                      <div className="flex -space-x-2">
                         <TooltipProvider>
                            {p.members?.slice(0, 3).map((m: any, i: number) => (
                              <Tooltip key={i}>
                                <TooltipTrigger asChild>
                                  <Avatar className="h-8 w-8 border-2 border-card ring-2 ring-transparent group-hover:ring-primary/20 transition-all">
                                    <AvatarFallback className="text-[10px] font-bold bg-muted text-muted-foreground">
                                      {m.profiles?.name?.substring(0, 2).toUpperCase() || '??'}
                                    </AvatarFallback>
                                  </Avatar>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs font-bold">{m.profiles?.name || 'Unknown'}</p>
                                  <p className="text-[10px] text-muted-foreground">{m.profiles?.role}</p>
                                </TooltipContent>
                              </Tooltip>
                            ))}
                            {(p.members?.length || 0) > 3 && (
                              <div className="h-8 w-8 rounded-full bg-muted border-2 border-card flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                                +{p.members.length - 3}
                              </div>
                            )}
                         </TooltipProvider>
                      </div>
                      <div className="flex items-center justify-between pt-2">
                        <p className="text-[11px] font-bold text-muted-foreground flex items-center gap-1.5">
                          <Calendar className="h-3 w-3" />
                          {p.deadline ? new Date(p.deadline).toLocaleDateString() : 'No Deadline'}
                        </p>
                        {!isClient && (
                          <p className="text-[11px] font-bold text-primary truncate max-w-[120px]">
                            {clients?.find(c => c.id === p.clientId)?.company}
                          </p>
                        )}
                      </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the project as cancelled. This action can be reversed by manually changing the status later, but will stop active tracking for now.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go Back</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (confirmAction) {
                  updateStatus(confirmAction.id, confirmAction.status);
                  setConfirmAction(null);
                }
              }}
            >
              Confirm Cancellation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Approval Request Dialog */}
      <AlertDialog open={!!approvalRequest} onOpenChange={(open) => !open && setApprovalRequest(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Request Approval for Change</AlertDialogTitle>
            <AlertDialogDescription>
              This project is locked (Completed). Your change request will be sent to an admin for approval.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4 space-y-2">
            <p className="text-sm"><span className="font-semibold">Field:</span> {approvalRequest?.field}</p>
            <p className="text-sm"><span className="font-semibold">Current:</span> {approvalRequest?.oldValue}</p>
            <p className="text-sm"><span className="font-semibold">New:</span> {approvalRequest?.newValue}</p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleApprovalRequest}>
              Submit Request
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
