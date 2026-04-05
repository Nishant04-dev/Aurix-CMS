import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRoles, useCreateRole, useUpdateRole, useDeleteRole, type Role } from '@/hooks/use-database';
import { usePermissions } from '@/hooks/use-permissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  Plus, Edit2, Trash2, Shield, Lock, Loader2, AlertTriangle, ShieldCheck,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const ALL_PERMISSIONS: { key: string; label: string; description: string }[] = [
  { key: 'manage_projects',     label: 'Manage Projects',   description: 'Create, edit, delete projects' },
  { key: 'view_projects',       label: 'View Projects',     description: 'Read-only access to projects' },
  { key: 'view_own_projects',   label: 'View Own Projects', description: 'See only assigned/owned projects' },
  { key: 'manage_team',         label: 'Manage Team',       description: 'Add, edit, remove team members' },
  { key: 'view_team',           label: 'View Team',         description: 'Read-only access to team list' },
  { key: 'manage_clients',      label: 'Manage Clients',    description: 'Create, edit, delete clients' },
  { key: 'view_clients',        label: 'View Clients',      description: 'Read-only access to clients' },
  { key: 'manage_invoices',     label: 'Manage Invoices',   description: 'Create, edit, delete invoices' },
  { key: 'manage_files',        label: 'Manage Files',      description: 'Upload, rename, delete files' },
  { key: 'view_files',          label: 'View Files',        description: 'Download and preview files' },
  { key: 'view_own_files',      label: 'View Own Files',    description: 'See only files from own projects' },
  { key: 'manage_roles',        label: 'Manage Roles',      description: 'Create and edit roles' },
];

const POWER_COLORS: Record<number, string> = {
  100: 'bg-purple-100 text-purple-700 border-purple-200',
  90:  'bg-indigo-100 text-indigo-700 border-indigo-200',
  70:  'bg-orange-100 text-orange-700 border-orange-200',
  50:  'bg-emerald-100 text-emerald-700 border-emerald-200',
  30:  'bg-sky-100 text-sky-700 border-sky-200',
  10:  'bg-slate-100 text-slate-600 border-slate-200',
};

function getPowerColor(power: number) {
  const levels = [100, 90, 70, 50, 30, 10];
  const closest = levels.find(l => power >= l) ?? 10;
  return POWER_COLORS[closest] ?? POWER_COLORS[10];
}

const emptyForm = { name: '', powerLevel: 50, permissions: {} as Record<string, boolean> };

export default function Roles() {
  const { user } = useAuth();
  const { power: myPower, isAdmin, can } = usePermissions();
  const { data: roles, isLoading } = useRoles();
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();
  const deleteRole = useDeleteRole();
  const { toast } = useToast();

  const [showCreate, setShowCreate] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [deletingRole, setDeletingRole] = useState<Role | null>(null);
  const [form, setForm] = useState(emptyForm);

  // Only users with manage_roles permission can access this page
  if (!can('manage_roles')) return <Navigate to="/" replace />;

  const canEditRole = (role: Role) => {
    if (role.isSystem) return false;          // system roles are immutable
    if (role.powerLevel >= myPower) return false; // can't edit equal/higher
    return true;
  };

  const canDeleteRole = (role: Role) => {
    if (role.isSystem) return false;
    if (role.powerLevel >= myPower) return false;
    return true;
  };

  const openCreate = () => {
    setForm(emptyForm);
    setShowCreate(true);
  };

  const openEdit = async (role: Role) => {
    // Load current role_permissions from DB
    const { data } = await supabase
      .from('role_permissions')
      .select('permission_key')
      .eq('role_id', role.id);
    const dbPerms = Object.fromEntries((data || []).map((r: any) => [r.permission_key, true]));
    // Merge with JSONB permissions
    const merged = { ...role.permissions, ...dbPerms };
    setForm({ name: role.name, powerLevel: role.powerLevel, permissions: merged });
    setEditingRole(role);
  };

  const togglePermission = (key: string) => {
    setForm(f => ({ ...f, permissions: { ...f.permissions, [key]: !f.permissions[key] } }));
  };

  const syncRolePermissions = async (roleId: string, permissions: Record<string, boolean>) => {
    // Delete existing
    await supabase.from('role_permissions').delete().eq('role_id', roleId);
    // Insert new ones
    const keys = Object.entries(permissions).filter(([, v]) => v).map(([k]) => k);
    if (keys.length > 0) {
      await supabase.from('role_permissions').insert(
        keys.map(key => ({ role_id: roleId, permission_key: key }))
      );
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    if (form.powerLevel >= myPower) {
      toast({ variant: 'destructive', title: 'Not Allowed', description: 'Power level must be below your own.' });
      return;
    }
    try {
      await createRole.mutateAsync(form);
      // Get the newly created role to sync permissions
      const { data: newRole } = await supabase
        .from('roles')
        .select('id')
        .eq('name', form.name)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (newRole) await syncRolePermissions(newRole.id, form.permissions);
      toast({ title: 'Role Created', description: `"${form.name}" has been created.` });
      setShowCreate(false);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRole) return;
    if (form.powerLevel >= myPower) {
      toast({ variant: 'destructive', title: 'Not Allowed', description: 'Power level must be below your own.' });
      return;
    }
    try {
      await updateRole.mutateAsync({ id: editingRole.id, ...form });
      await syncRolePermissions(editingRole.id, form.permissions);
      toast({ title: 'Role Updated', description: `"${form.name}" has been updated.` });
      setEditingRole(null);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    }
  };

  const handleDelete = async () => {
    if (!deletingRole) return;
    try {
      await deleteRole.mutateAsync(deletingRole.id);
      toast({ title: 'Role Deleted', description: `"${deletingRole.name}" has been removed.` });
      setDeletingRole(null);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    }
  };

  const RoleForm = ({ onSubmit, saving }: { onSubmit: (e: React.FormEvent) => void; saving: boolean }) => (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label>Role Name</Label>
        <Input
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          placeholder="e.g. Content Editor"
          required
          disabled={saving}
        />
      </div>
      <div className="space-y-2">
        <Label>Power Level <span className="text-muted-foreground text-xs">(1–{myPower - 1})</span></Label>
        <div className="flex items-center gap-3">
          <Input
            type="number"
            min={1}
            max={myPower - 1}
            value={form.powerLevel}
            onChange={e => setForm(f => ({ ...f, powerLevel: Number(e.target.value) }))}
            className="w-24"
            disabled={saving}
          />
          <div className={cn('px-2 py-0.5 rounded-full text-xs font-bold border', getPowerColor(form.powerLevel))}>
            Level {form.powerLevel}
          </div>
        </div>
      </div>
      <div className="space-y-3">
        <Label>Permissions</Label>
        <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto pr-1">
          {ALL_PERMISSIONS.map(p => (
            <div
              key={p.key}
              className="flex items-start gap-3 p-2.5 rounded-lg border border-border/40 hover:bg-accent/30 cursor-pointer transition-colors"
              onClick={() => togglePermission(p.key)}
            >
              <Checkbox
                checked={!!form.permissions[p.key]}
                onCheckedChange={() => togglePermission(p.key)}
                className="mt-0.5"
              />
              <div>
                <p className="text-sm font-medium leading-none">{p.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => { setShowCreate(false); setEditingRole(null); }}>Cancel</Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Save Role
        </Button>
      </DialogFooter>
    </form>
  );

  if (isLoading) {
    return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary/40" /></div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Roles & Permissions</h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">Define access levels and capabilities for each role.</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1.5" /> Create Role
        </Button>
      </div>

      <div className="rounded-xl border border-border/50 bg-card overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 bg-muted/20">
              <th className="text-left px-6 py-4 font-bold text-muted-foreground uppercase tracking-widest text-[10px]">Role</th>
              <th className="text-left px-6 py-4 font-bold text-muted-foreground uppercase tracking-widest text-[10px]">Power</th>
              <th className="text-left px-6 py-4 font-bold text-muted-foreground uppercase tracking-widest text-[10px]">Permissions</th>
              <th className="text-left px-6 py-4 font-bold text-muted-foreground uppercase tracking-widest text-[10px]">Type</th>
              <th className="text-right px-6 py-4 font-bold text-muted-foreground uppercase tracking-widest text-[10px]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {roles?.map(role => {
              const permKeys = role.permissions.all ? ['All Permissions'] : Object.keys(role.permissions).filter(k => role.permissions[k]);
              return (
                <tr key={role.id} className="group hover:bg-accent/30 transition-all duration-200">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-primary/60" />
                      <span className="font-bold text-foreground">{role.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold border', getPowerColor(role.powerLevel))}>
                      {role.powerLevel}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {permKeys.slice(0, 3).map(k => (
                        <span key={k} className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-accent border border-border/50 text-muted-foreground">
                          {k.replace(/_/g, ' ')}
                        </span>
                      ))}
                      {permKeys.length > 3 && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-accent border border-border/50 text-muted-foreground">
                          +{permKeys.length - 3} more
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {role.isSystem ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                        <Lock className="h-2.5 w-2.5" /> System
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                        <ShieldCheck className="h-2.5 w-2.5" /> Custom
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {canEditRole(role) ? (
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(role)}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-30 cursor-not-allowed" disabled>
                          <Lock className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {canDeleteRole(role) ? (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => setDeletingRole(role)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-30 cursor-not-allowed" disabled>
                          <Lock className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Create Role Modal */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Role</DialogTitle>
            <DialogDescription>Define a new role with custom permissions and power level.</DialogDescription>
          </DialogHeader>
          <RoleForm onSubmit={handleCreate} saving={createRole.isPending} />
        </DialogContent>
      </Dialog>

      {/* Edit Role Modal */}
      <Dialog open={!!editingRole} onOpenChange={(open) => !open && setEditingRole(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Role</DialogTitle>
            <DialogDescription>Update permissions and power level for "{editingRole?.name}".</DialogDescription>
          </DialogHeader>
          <RoleForm onSubmit={handleUpdate} saving={updateRole.isPending} />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingRole} onOpenChange={(open) => !open && setDeletingRole(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" /> Delete Role
            </AlertDialogTitle>
            <AlertDialogDescription>
              Delete <strong>{deletingRole?.name}</strong>? Users assigned this role will lose it. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              <Trash2 className="h-4 w-4 mr-2" /> Delete Role
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
