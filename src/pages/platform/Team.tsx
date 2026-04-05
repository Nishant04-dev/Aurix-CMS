import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Loader2, UserCog, Plus, Trash2, Key } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { usePlatformPermissions } from '@/hooks/use-platform-permissions';
import { cn } from '@/lib/utils';

export default function PlatformTeam() {
  const { power, isOwner } = usePlatformPermissions();
  const [members, setMembers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [removing, setRemoving] = useState<any>(null);
  const [displayId, setDisplayId] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const { toast } = useToast();

  const load = async () => {
    const [membersRes, rolesRes] = await Promise.all([
      supabase.from('platform_user_roles').select('*, platform_roles(id,name,power_level), profiles(id,name,email)'),
      supabase.from('platform_roles').select('*').order('power_level', { ascending: false }),
    ]);
    setMembers(membersRes.data || []);
    setRoles(rolesRes.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const addMember = async () => {
    if (!displayId.trim() || !selectedRole) return;
    // Find user by AURIX display_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, name, email')
      .eq('display_id', displayId.trim().toUpperCase())
      .maybeSingle();
    if (!profile) { toast({ variant: 'destructive', title: 'User not found', description: 'No user with that AURIX ID.' }); return; }

    // Check for existing platform role
    const { data: existing } = await supabase
      .from('platform_user_roles')
      .select('id')
      .eq('user_id', profile.id)
      .maybeSingle();
    if (existing) { toast({ variant: 'destructive', title: 'Already a member', description: 'This user already has a platform role.' }); return; }

    const { error } = await supabase.from('platform_user_roles').insert({ user_id: profile.id, role_id: selectedRole });
    if (error) toast({ variant: 'destructive', title: 'Error', description: error.message });
    else { toast({ title: 'Member added', description: `${profile.name || profile.email} added to platform team.` }); setShowAdd(false); setDisplayId(''); setSelectedRole(''); await load(); }
  };

  const removeMember = async () => {
    if (!removing) return;
    const { error } = await supabase.from('platform_user_roles').delete().eq('id', removing.id);
    if (error) toast({ variant: 'destructive', title: 'Error', description: error.message });
    else { toast({ title: 'Member removed' }); setRemoving(null); await load(); }
  };

  const assignableRoles = roles.filter(r => r.power_level < power);

  if (loading) return <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary/40" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {isOwner() && (
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Add Platform Member
          </Button>
        )}
      </div>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <UserCog className="h-4 w-4 text-primary" /> Platform Team ({members.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/20">
                {['Member','Email','Platform Role','Power','Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {members.map(m => {
                const profile = m.profiles as any;
                const role = m.platform_roles as any;
                const canManage = power > (role?.power_level ?? 0);
                return (
                  <tr key={m.id} className="hover:bg-accent/20 transition-colors">
                    <td className="px-4 py-3 font-medium">{profile?.name || '—'}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{profile?.email}</td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">{role?.name}</span>
                    </td>
                    <td className="px-4 py-3 text-sm font-mono">{role?.power_level}</td>
                    <td className="px-4 py-3">
                      {canManage && (
                        <Button size="sm" variant="ghost" className="h-7 w-7 text-destructive hover:bg-destructive/10"
                          onClick={() => setRemoving(m)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Add Member Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add Platform Member</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>AURIX User ID</Label>
              <Input
                value={displayId}
                onChange={e => setDisplayId(e.target.value.toUpperCase())}
                placeholder="AURIX-12345"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">Format: AURIX-XXXXX</p>
            </div>
            <div className="space-y-2">
              <Label>Platform Role</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                <SelectContent>
                  {assignableRoles.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.name} (Power: {r.power_level})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={addMember} disabled={!displayId || !selectedRole}>Add Member</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Confirmation */}
      <AlertDialog open={!!removing} onOpenChange={open => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Platform Member</AlertDialogTitle>
            <AlertDialogDescription>Remove {(removing?.profiles as any)?.name} from the platform team?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={removeMember}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
