import { useState } from 'react';
import { api } from '@/lib/apiClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Loader2, UserPlus, Search, RefreshCw, Ban, AlertCircle } from 'lucide-react';
import { useRoles } from '@/hooks/use-database';

interface Props {
  open: boolean;
  onClose: () => void;
  type?: 'team' | 'client';
}

export function InviteByIdModal({ open, onClose, type = 'team' }: Props) {
  const [displayId, setDisplayId]   = useState('');
  const [roleName, setRoleName]     = useState('developer');
  const [loading, setLoading]       = useState(false);
  const [preview, setPreview]       = useState<{ name: string; email: string } | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [existingInvite, setExistingInvite] = useState<{ id: string; role_name: string; created_at: string } | null>(null);
  const { toast } = useToast();
  const { data: roles } = useRoles();

  const reset = () => {
    setDisplayId('');
    setRoleName('developer');
    setPreview(null);
    setExistingInvite(null);
  };

  const handleClose = () => { reset(); onClose(); };

  const lookupUser = async () => {
    if (!displayId.trim()) return;
    setLookupLoading(true);
    setPreview(null);
    setExistingInvite(null);
    try {
      const data = await api.get<any>('/invitations/lookup', { display_id: displayId.trim().toUpperCase() });
      if (data) setPreview(data);
      else toast({ variant: 'destructive', title: 'Not found', description: 'No user with that ID.' });
    } catch {
      toast({ variant: 'destructive', title: 'Not found', description: 'No user with that ID.' });
    } finally {
      setLookupLoading(false);
    }
  };

  const handleSend = async () => {
    if (!displayId.trim() || !roleName) return;
    setLoading(true);
    try {
      const data = await api.post<any>('/invitations/send', {
        display_id: displayId.trim().toUpperCase(),
        role_name:  roleName,
        type,
      });
      toast({ title: 'Invitation sent!', description: data?.message });
      reset();
      onClose();
    } catch (err: any) {
      const msg: string = err.message || '';
      if (msg.includes('pending invitation already exists')) {
        toast({ title: 'Pending invite exists', description: 'You can cancel or resend the existing invitation.' });
      } else {
        toast({ variant: 'destructive', title: 'Error', description: msg });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancelExisting = async () => {
    if (!existingInvite) return;
    setLoading(true);
    try {
      await api.post('/invitations/respond', { invitation_id: existingInvite.id, action: 'cancel' });
      toast({ title: 'Invite cancelled', description: 'You can now send a new invitation.' });
      setExistingInvite(null);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleResendExisting = async () => {
    if (!existingInvite) return;
    setLoading(true);
    try {
      await api.post('/invitations/respond', { invitation_id: existingInvite.id, action: 'cancel' });
      const data = await api.post<any>('/invitations/send', {
        display_id: displayId.trim().toUpperCase(),
        role_name:  roleName,
        type,
      });
      toast({ title: 'Invitation resent!', description: data?.message });
      reset();
      onClose();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const assignableRoles = roles?.filter(r => r.powerLevel < 90) || [];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" /> Invite by User ID
          </DialogTitle>
          <DialogDescription>
            Enter the user's unique AURIX ID to send them an invitation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>User ID</Label>
            <div className="flex gap-2">
              <Input
                value={displayId}
                onChange={e => { setDisplayId(e.target.value.toUpperCase()); setPreview(null); setExistingInvite(null); }}
                placeholder="AURIX-12345"
                className="font-mono"
                onKeyDown={e => e.key === 'Enter' && lookupUser()}
              />
              <Button type="button" variant="outline" size="icon" onClick={lookupUser}
                disabled={lookupLoading || !displayId.trim()}>
                {lookupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {preview && !existingInvite && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
              <div className="h-9 w-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm">
                {(preview.name || preview.email || '?').charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{preview.name || 'Unknown'}</p>
                <p className="text-xs text-muted-foreground">{preview.email}</p>
              </div>
            </div>
          )}

          {existingInvite && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Pending invite already exists</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Role: <span className="font-semibold capitalize">{existingInvite.role_name}</span>
                    {' · '}Sent {new Date(existingInvite.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1 gap-1 border-amber-300 text-amber-700 hover:bg-amber-100"
                  disabled={loading} onClick={handleResendExisting}>
                  {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <><RefreshCw className="h-3 w-3" />Resend</>}
                </Button>
                <Button size="sm" variant="outline" className="flex-1 gap-1 border-rose-300 text-rose-600 hover:bg-rose-50"
                  disabled={loading} onClick={handleCancelExisting}>
                  {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Ban className="h-3 w-3" />Cancel Invite</>}
                </Button>
              </div>
            </div>
          )}

          {!existingInvite && (
            <div className="space-y-2">
              <Label>Assign Role</Label>
              <Select value={roleName} onValueChange={setRoleName}>
                <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                <SelectContent>
                  {assignableRoles.length > 0
                    ? assignableRoles.map(r => (
                        <SelectItem key={r.id} value={r.name.toLowerCase()}>{r.name}</SelectItem>
                      ))
                    : (
                      <>
                        <SelectItem value="developer">Developer</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="support">Support</SelectItem>
                        <SelectItem value="client">Client</SelectItem>
                      </>
                    )
                  }
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          {!existingInvite && (
            <Button onClick={handleSend} disabled={loading || !displayId.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
              Send Invitation
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
