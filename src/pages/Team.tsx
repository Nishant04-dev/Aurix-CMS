import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTeamMembers, useUpdateTeamMember } from '@/hooks/use-database';
import { usePermissions, ASSIGNABLE_ROLES } from '@/hooks/use-permissions';
import {
  useRemoveMember, useBanMember, useUnbanMember,
  useLeaveOrganization, useBannedMembers,
} from '@/hooks/use-membership';
import { useOrgMembersRealtime } from '@/hooks/use-org-members-realtime';
import { canActOn } from '@/lib/powerLevel';
import { Button } from '@/components/ui/button';
import {
  Plus, MoreHorizontal, Loader2, ShieldCheck, UserCog, Mail,
  Trash2, Edit2, Key, Check, AlertTriangle, Shield, UserPlus,
  UserX, Ban, UserCheck, LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/apiClient';
import { InviteByIdModal } from '@/components/InviteByIdModal';

const roleStyles: Record<string, { bg: string; text: string; icon: any }> = {
  super_admin: { bg: 'bg-purple-50 text-purple-700 border-purple-200', text: 'Super Admin', icon: Shield },
  admin:       { bg: 'bg-indigo-50 text-indigo-600 border-indigo-100', text: 'Administrator', icon: ShieldCheck },
  manager:     { bg: 'bg-orange-50 text-orange-600 border-orange-100', text: 'Manager', icon: UserCog },
  developer:   { bg: 'bg-emerald-50 text-emerald-600 border-emerald-100', text: 'Developer', icon: UserCog },
  support:     { bg: 'bg-sky-50 text-sky-600 border-sky-100', text: 'Support', icon: UserCog },
  client:      { bg: 'bg-slate-50 text-slate-600 border-slate-100', text: 'Client', icon: Mail },
};

export default function Team() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { canManageTeam, canChangeRole, canEditUser, canDeleteUser, canAssignRole, validateRoleChange, can } = usePermissions();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const canManage = can('invite_user') || can('edit_user');

  const { data: teamMembers, isLoading, refetch } = useTeamMembers();
  // Belt-and-suspenders: filter clients even if backend returns them
  const internalMembers = (teamMembers ?? []).filter((m: any) => m.role !== 'client');
  const { data: bannedMembers = [] } = useBannedMembers();
  const updateMember = useUpdateTeamMember();
  const removeMember = useRemoveMember();
  const banMember = useBanMember();
  const unbanMember = useUnbanMember();
  const leaveOrg = useLeaveOrganization();

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isChangingRole, setIsChangingRole] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<any>(null);
  const [confirmBan, setConfirmBan] = useState<any>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [editData, setEditData] = useState({ name: '', email: '' });
  const [roleData, setRoleData] = useState('');
  const { toast } = useToast();

  // Real-time: refresh list when membership changes; redirect if self removed
  useOrgMembersRealtime(
    (user as any)?.orgId,
    user?.id,
    () => {
      toast({ title: 'Access revoked', description: 'You have been removed from this organization.' });
      logout();
    }
  );

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;
    try {
      await updateMember.mutateAsync({ userId: selectedMember.id, name: editData.name.trim(), email: editData.email.trim() });
      toast({ title: 'Updated', description: 'Team member updated.' });
      setIsEditing(false);
      refetch();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    }
  };

  const handleChangeRole = async () => {
    if (!selectedMember || !roleData) return;
    const err = validateRoleChange(selectedMember.id, selectedMember.role, roleData);
    if (err) { toast({ variant: 'destructive', title: 'Not Allowed', description: err }); return; }
    try {
      const data = await api.post<any>(`/users/${selectedMember.id}/role`, { role: roleData });
      if (data?.error) throw new Error(data.error);
      toast({ title: 'Role changed', description: `Role updated to ${roleData}` });
      setIsChangingRole(false);
      refetch();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    }
  };

  const handleRemove = async () => {
    if (!confirmRemove) return;
    try {
      await removeMember.mutateAsync({ targetUserId: confirmRemove.id });
      toast({ title: 'Member removed' });
      setConfirmRemove(null);
      refetch();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    }
  };

  const handleBan = async () => {
    if (!confirmBan) return;
    try {
      await banMember.mutateAsync({ targetUserId: confirmBan.id });
      toast({ title: 'Member banned' });
      setConfirmBan(null);
      refetch();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    }
  };

  const handleUnban = async (userId: string) => {
    try {
      await unbanMember.mutateAsync(userId);
      toast({ title: 'User unbanned' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    }
  };

  const handleLeave = async () => {
    try {
      await leaveOrg.mutateAsync();
      toast({ title: 'You left the organization' });
      setConfirmLeave(false);
      logout();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
      setConfirmLeave(false);
    }
  };

  if (isLoading) {
    return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary/40" /></div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Team Management</h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">Control administrative access and staff roles.</p>
        </div>
        {can('invite_user') && (
          <>
            <Button size="sm" className="shadow-lg shadow-primary/20" onClick={() => setShowInviteModal(true)}>
              <UserPlus className="h-4 w-4 mr-1.5" /> Invite Member
            </Button>
            <InviteByIdModal open={showInviteModal} onClose={() => { setShowInviteModal(false); refetch(); }} type="team" />
          </>
        )}
      </div>

      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members">Members ({internalMembers.length})</TabsTrigger>
          {isAdmin && <TabsTrigger value="banned">Banned ({bannedMembers.length})</TabsTrigger>}
        </TabsList>

        {/* ── Members tab ── */}
        <TabsContent value="members" className="mt-4">
          <div className="rounded-xl border border-border/50 bg-card overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/20">
                    <th className="text-left px-6 py-4 font-bold text-muted-foreground uppercase tracking-widest text-[10px]">Member</th>
                    <th className="text-left px-6 py-4 font-bold text-muted-foreground uppercase tracking-widest text-[10px]">Email</th>
                    <th className="text-left px-6 py-4 font-bold text-muted-foreground uppercase tracking-widest text-[10px]">Role</th>
                    <th className="text-right px-6 py-4 font-bold text-muted-foreground uppercase tracking-widest text-[10px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {(!internalMembers || internalMembers.length === 0) && (
                    <tr><td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">No team members found.</td></tr>
                  )}
                  {internalMembers.map(member => {
                    const roleCfg = roleStyles[member.role] || roleStyles.developer;
                    const RoleIcon = roleCfg.icon;
                    const isCurrentUser = member.id === user?.id;
                    const canAct = isAdmin && canActOn(user?.role ?? '', member.role) && !isCurrentUser;

                    return (
                      <tr key={member.id} className="group hover:bg-accent/30 transition-all duration-200">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                              {(member.name || member.email || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-foreground">{member.name || 'Staff'}</p>
                              {isCurrentUser && <span className="text-[10px] text-primary font-bold">You</span>}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">{member.email}</td>
                        <td className="px-6 py-4">
                          <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold border', roleCfg.bg)}>
                            <RoleIcon className="h-3 w-3" /> {roleCfg.text}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {canManage ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                {can('edit_user') && canEditUser(member.id, member.role) && (
                                  <DropdownMenuItem onClick={() => { setSelectedMember(member); setEditData({ name: member.name || '', email: member.email || '' }); setIsEditing(true); }}>
                                    <Edit2 className="h-3.5 w-3.5 mr-2" /> Edit Profile
                                  </DropdownMenuItem>
                                )}
                                {isAdmin && canChangeRole(member.id, member.role) && (
                                  <DropdownMenuItem onClick={() => { setSelectedMember(member); setRoleData(member.role); setIsChangingRole(true); }}>
                                    <Key className="h-3.5 w-3.5 mr-2" /> Change Role
                                  </DropdownMenuItem>
                                )}
                                {canAct && <DropdownMenuSeparator />}
                                {canAct && (
                                  <DropdownMenuItem onClick={() => setConfirmRemove(member)} className="text-destructive focus:text-destructive">
                                    <UserX className="h-3.5 w-3.5 mr-2" /> Remove
                                  </DropdownMenuItem>
                                )}
                                {canAct && (
                                  <DropdownMenuItem onClick={() => setConfirmBan(member)} className="text-destructive focus:text-destructive">
                                    <Ban className="h-3.5 w-3.5 mr-2" /> Ban
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : (
                            <span className="text-xs text-muted-foreground">View Only</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* ── Banned tab ── */}
        {isAdmin && (
          <TabsContent value="banned" className="mt-4">
            <div className="rounded-xl border border-border/50 bg-card overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50 bg-muted/20">
                      <th className="text-left px-6 py-4 font-bold text-muted-foreground uppercase tracking-widest text-[10px]">User</th>
                      <th className="text-left px-6 py-4 font-bold text-muted-foreground uppercase tracking-widest text-[10px]">Banned</th>
                      <th className="text-right px-6 py-4 font-bold text-muted-foreground uppercase tracking-widest text-[10px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {bannedMembers.length === 0 && (
                      <tr><td colSpan={3} className="px-6 py-12 text-center text-muted-foreground">No banned members.</td></tr>
                    )}
                    {bannedMembers.map(b => (
                      <tr key={b.id} className="hover:bg-accent/30">
                        <td className="px-6 py-4">
                          <p className="font-semibold text-foreground">{b.name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">{b.email}</p>
                        </td>
                        <td className="px-6 py-4 text-xs text-muted-foreground">
                          {new Date(b.createdAt).toLocaleDateString()}
                          {b.reason && <span className="ml-2 italic">"{b.reason}"</span>}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button size="sm" variant="outline" className="h-8 gap-1"
                            disabled={unbanMember.isPending}
                            onClick={() => handleUnban(b.userId)}>
                            {unbanMember.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <><UserCheck className="h-3 w-3" />Unban</>}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* ── Danger Zone ── */}
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 space-y-3">
        <h3 className="text-sm font-bold text-destructive uppercase tracking-widest flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" /> Danger Zone
        </h3>
        <p className="text-sm text-muted-foreground">Leaving the organization will immediately revoke your access.</p>
        <Button variant="outline" size="sm" className="border-destructive/40 text-destructive hover:bg-destructive/10 gap-2"
          onClick={() => setConfirmLeave(true)}>
          <LogOut className="h-4 w-4" /> Leave Organization
        </Button>
      </div>

      {/* ── Edit Member Dialog ── */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Team Member</DialogTitle>
            <DialogDescription>Update the team member's profile information.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={editData.email} onChange={e => setEditData({ ...editData, email: e.target.value })} required />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
              <Button type="submit" disabled={updateMember.isPending}>
                {updateMember.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Change Role Dialog ── */}
      <Dialog open={isChangingRole} onOpenChange={setIsChangingRole}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Change Role</DialogTitle>
            <DialogDescription>Change the access level for {selectedMember?.name || selectedMember?.email}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Select value={roleData} onValueChange={setRoleData}>
              <SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger>
              <SelectContent>
                {ASSIGNABLE_ROLES.filter(r => canAssignRole(r)).map(r => (
                  <SelectItem key={r} value={r}>{roleStyles[r]?.text || r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsChangingRole(false)}>Cancel</Button>
              <Button onClick={handleChangeRole} disabled={!roleData}><Check className="h-4 w-4 mr-2" />Update Role</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Remove Confirmation ── */}
      <AlertDialog open={!!confirmRemove} onOpenChange={() => setConfirmRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <UserX className="h-5 w-5 text-destructive" /> Remove Member
            </AlertDialogTitle>
            <AlertDialogDescription>
              Remove <strong>{confirmRemove?.name || confirmRemove?.email}</strong> from the organization? This will revoke their access immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleRemove} disabled={removeMember.isPending}>
              {removeMember.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Ban Confirmation ── */}
      <AlertDialog open={!!confirmBan} onOpenChange={() => setConfirmBan(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5 text-destructive" /> Ban Member
            </AlertDialogTitle>
            <AlertDialogDescription>
              Ban <strong>{confirmBan?.name || confirmBan?.email}</strong>? They will be removed and blocked from rejoining this organization.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleBan} disabled={banMember.isPending}>
              {banMember.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Ban Member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Leave Confirmation ── */}
      <AlertDialog open={confirmLeave} onOpenChange={setConfirmLeave}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <LogOut className="h-5 w-5 text-destructive" /> Leave Organization
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to leave this organization? This action cannot be undone and you will lose access immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleLeave} disabled={leaveOrg.isPending}>
              {leaveOrg.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Leave Organization
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
