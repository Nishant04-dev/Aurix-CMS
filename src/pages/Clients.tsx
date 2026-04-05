import React, { useState } from 'react';
import { useClients, useProjects, useUpdateClient, useDeleteClient } from '@/hooks/use-database';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, Mail, Phone, Building, Loader2, ShieldCheck, MoreVertical, LayoutGrid, List, Edit2, Trash2, AlertTriangle, Plus, UserPlus } from 'lucide-react';
import { ClientFormModal } from '@/components/FormModals';
import { usePermissions } from '@/hooks/use-permissions';
import { usePlanLimits } from '@/hooks/use-plan-limits';
import { UpgradeModal } from '@/components/UpgradeModal';
import { InviteByIdModal } from '@/components/InviteByIdModal';
import { cn } from '@/lib/utils';
import { Navigate } from 'react-router-dom';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

export default function Clients() {
  const { user } = useAuth();
  const { data: clients, isLoading: loadingClients, refetch } = useClients();
  const { data: projects, isLoading: loadingProjects } = useProjects();
  const updateClient = useUpdateClient();
  const deleteClient = useDeleteClient();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [editingClient, setEditingClient] = useState<any>(null);
  const [deletingClient, setDeletingClient] = useState<any>(null);
  const [editForm, setEditForm] = useState({ name: '', company: '', email: '', phone: '' });

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const { can } = usePermissions();
  const { canCreateClient, usage, limits } = usePlanLimits();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const canCreate = can('create_client');
  const canEdit   = can('edit_client');
  const canDel    = can('delete_client');

  if (user?.role === 'client') return <Navigate to="/" replace />;

  const filtered = clients?.filter(c =>
    (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.company || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(search.toLowerCase())
  ) || [];

  const openEdit = (client: any) => {
    setEditForm({ name: client.name || '', company: client.company || '', email: client.email || '', phone: client.phone || '' });
    setEditingClient(client);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;
    try {
      await updateClient.mutateAsync({ id: editingClient.id, ...editForm });
      toast({ title: 'Success', description: 'Client updated successfully' });
      setEditingClient(null);
      refetch();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    }
  };

  const handleDelete = async () => {
    if (!deletingClient) return;
    try {
      await deleteClient.mutateAsync(deletingClient.id);
      toast({ title: 'Success', description: 'Client removed successfully' });
      setDeletingClient(null);
      refetch();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    }
  };

  if (loadingClients || loadingProjects) {
    return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary/40" /></div>;
  }

  const ClientActions = ({ client }: { client: any }) => {
    if (!canEdit && !canDel) return null;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="h-8 w-8 rounded-lg hover:bg-accent flex items-center justify-center text-muted-foreground transition-colors">
            <MoreVertical className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          {canEdit && (
            <DropdownMenuItem onClick={() => openEdit(client)} className="flex items-center gap-2">
              <Edit2 className="h-3.5 w-3.5" /> Edit Client
            </DropdownMenuItem>
          )}
          {canDel && (
            <DropdownMenuItem onClick={() => setDeletingClient(client)} className="flex items-center gap-2 text-destructive focus:text-destructive">
              <Trash2 className="h-3.5 w-3.5" /> Delete Client
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Clients</h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">Manage client accounts and relationship data.</p>
        </div>
        {canCreate && (
          <div className="flex items-center gap-2">
            {/* Invite existing user by AURIX ID */}
            <Button size="sm" variant="outline" onClick={() => setShowInviteModal(true)}>
              <UserPlus className="h-4 w-4 mr-1.5" /> Invite by ID
            </Button>

            {/* Manually create new client account */}
            {canCreateClient
              ? <ClientFormModal onSuccess={() => refetch()} />
              : <Button size="sm" onClick={() => setShowUpgradeModal(true)} variant="outline">
                  <Plus className="h-4 w-4 mr-1" /> Add Client
                  <span className="ml-2 text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200">{usage.clients}/{limits.max_clients}</span>
                </Button>
            }
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-2 border-b border-border/10 pb-6">
        <div className="relative w-full max-w-md group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
          <Input
            placeholder="Search clients by name, company, or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 bg-card/80 border-border/50 focus:ring-primary/20"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 p-1 bg-accent/40 rounded-lg border border-border/50 mr-4">
            <button onClick={() => setView('list')} className={cn('p-1.5 rounded-md transition-all', view === 'list' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground')}><List className="h-4 w-4" /></button>
            <button onClick={() => setView('grid')} className={cn('p-1.5 rounded-md transition-all', view === 'grid' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground')}><LayoutGrid className="h-4 w-4" /></button>
          </div>
          <div className="text-xs text-muted-foreground font-bold uppercase tracking-widest hidden sm:block">Total: {filtered.length} Entities</div>
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="py-20 text-center border-2 border-dashed border-border/50 rounded-2xl opacity-40">
          <Building className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-sm font-medium italic">No clients found.</p>
        </div>
      )}

      {view === 'grid' ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(client => {
            const clientProjects = projects?.filter(p => p.clientId === client.id) || [];
            return (
              <Card key={client.id} className="group relative hover:shadow-xl transition-all duration-300 border-border/50 bg-card overflow-hidden">
                <div className="absolute top-4 right-4 z-10">
                  <ClientActions client={client} />
                </div>
                <CardContent className="p-8">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/10 flex items-center justify-center text-primary text-xl font-bold">
                      {client.name ? client.name.split(' ').map((n: string) => n[0]).join('') : '??'}
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-foreground leading-tight">{client.name}</h3>
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5 mt-0.5">
                        <Building className="h-3 w-3" /> {client.company}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3.5 border-y border-border/20 py-6 mb-6">
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <Mail className="h-4 w-4 text-primary/60" />
                      <span className="font-medium truncate">{client.email}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <Phone className="h-4 w-4 text-primary/60" />
                      <span className="font-medium">{client.phone || '—'}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600 border border-emerald-100">
                      <ShieldCheck className="h-3 w-3" /> VERIFIED
                    </div>
                    <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                      {clientProjects.length} {clientProjects.length === 1 ? 'Project' : 'Projects'}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-border/50 bg-card overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/20">
                <th className="text-left px-6 py-4 font-bold text-muted-foreground uppercase tracking-widest text-[10px]">Client</th>
                <th className="text-left px-6 py-4 font-bold text-muted-foreground uppercase tracking-widest text-[10px]">Contact</th>
                <th className="text-left px-6 py-4 font-bold text-muted-foreground uppercase tracking-widest text-[10px]">Projects</th>
                {(canEdit || canDel) && <th className="text-right px-6 py-4 font-bold text-muted-foreground uppercase tracking-widest text-[10px]">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {filtered.map(client => {
                const clientProjects = projects?.filter(p => p.clientId === client.id) || [];
                return (
                  <tr key={client.id} className="group hover:bg-accent/30 transition-all duration-200">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">{client.name.charAt(0)}</div>
                        <div>
                          <p className="font-bold text-foreground">{client.name}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1"><Building className="h-2.5 w-2.5" /> {client.company}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col text-xs space-y-0.5">
                        <span className="text-foreground font-medium">{client.email}</span>
                        <span className="text-muted-foreground">{client.phone || '—'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="secondary" className="font-bold text-[10px] tracking-widest uppercase">{clientProjects.length} Projects</Badge>
                    </td>
                    {(canEdit || canDel) && (
                      <td className="px-6 py-4 text-right">
                        <ClientActions client={client} />
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Client Modal */}
      <Dialog open={!!editingClient} onOpenChange={(open) => !open && setEditingClient(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
            <DialogDescription>Update client profile information.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label>Company</Label>
              <Input value={editForm.company} onChange={e => setEditForm(f => ({ ...f, company: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingClient(null)}>Cancel</Button>
              <Button type="submit" disabled={updateClient.isPending}>
                {updateClient.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingClient} onOpenChange={(open) => !open && setDeletingClient(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" /> Delete Client
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deletingClient?.name}</strong> and all associated data. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              <Trash2 className="h-4 w-4 mr-2" /> Delete Client
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UpgradeModal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        feature="clients"
        message={`You've reached the limit of ${limits.max_clients} clients on the free plan.`}
      />

      <InviteByIdModal
        open={showInviteModal}
        onClose={() => { setShowInviteModal(false); refetch(); }}
        type="client"
      />
    </div>
  );
}
