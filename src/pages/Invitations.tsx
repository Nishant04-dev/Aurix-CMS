import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { logAudit } from '@/lib/auditLog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Loader2, Mail, CheckCircle2, XCircle, Building2, Clock,
  UserCheck, Send, Ban, RefreshCw, Users, Shield
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { InviteByIdModal } from '@/components/InviteByIdModal';
import { usePermissions } from '@/hooks/use-permissions';

const db = supabase as any;

// ── Role badge colours ────────────────────────────────────────────────────────
const ROLE_STYLES: Record<string, string> = {
  super_admin: 'bg-purple-100 text-purple-700 border-purple-200',
  admin:       'bg-indigo-100 text-indigo-700 border-indigo-200',
  manager:     'bg-orange-100 text-orange-700 border-orange-200',
  developer:   'bg-emerald-100 text-emerald-700 border-emerald-200',
  support:     'bg-sky-100 text-sky-700 border-sky-200',
  client:      'bg-slate-100 text-slate-600 border-slate-200',
};

const STATUS_STYLES: Record<string, string> = {
  pending:   'bg-amber-50 text-amber-600 border-amber-200',
  accepted:  'bg-emerald-50 text-emerald-600 border-emerald-200',
  rejected:  'bg-rose-50 text-rose-600 border-rose-200',
  cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
  expired:   'bg-slate-100 text-slate-500 border-slate-200',
};

// ── Org logo with fallback ────────────────────────────────────────────────────
function OrgLogo({ name, logoUrl, size = 'md' }: { name: string; logoUrl?: string | null; size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'h-9 w-9 text-sm' : 'h-12 w-12 text-base';
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={name}
        className={cn(dim, 'rounded-xl object-cover border border-border/20 shrink-0')}
        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
    );
  }
  return (
    <div className={cn(dim, 'rounded-xl bg-primary/10 flex items-center justify-center font-bold text-primary shrink-0')}>
      {(name || 'O').charAt(0).toUpperCase()}
    </div>
  );
}

export default function Invitations() {
  const { user, refreshUser } = useAuth();
  const { can } = usePermissions();
  const canInvite = can('invite_user');

  const [received, setReceived]     = useState<any[]>([]);
  const [sent, setSent]             = useState<any[]>([]);
  const [loadingR, setLoadingR]     = useState(true);
  const [loadingS, setLoadingS]     = useState(true);
  const [actionId, setActionId]     = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const { toast } = useToast();

  // ── Load received ─────────────────────────────────────────────────────────
  const loadReceived = async () => {
    if (!user) return;
    setLoadingR(true);
    try {
      const { data, error } = await db
        .from('invitations')
        .select('id, org_id, invited_by, target_user_id, role_name, type, status, created_at, expires_at')
        .eq('target_user_id', user.id)
        .order('created_at', { ascending: false });

      console.log('Received:', { userId: user.id, count: data?.length, error: error?.message });

      const rows: any[] = data || [];
      if (!rows.length) { setReceived([]); return; }

      // Fetch orgs (name + logo)
      const orgIds = [...new Set(rows.map((r: any) => r.org_id).filter(Boolean))] as string[];
      let orgMap: Record<string, { name: string; logo_url: string | null }> = {};
      if (orgIds.length) {
        const { data: orgs } = await db.from('organizations').select('id, name, logo_url').in('id', orgIds);
        orgMap = Object.fromEntries((orgs || []).map((o: any) => [o.id, o]));
      }

      // Fetch inviter profiles
      const inviterIds = [...new Set(rows.map((r: any) => r.invited_by).filter(Boolean))] as string[];
      let inviterMap: Record<string, { name: string; email: string }> = {};
      if (inviterIds.length) {
        const { data: profiles } = await supabase
          .from('profiles').select('id, name, email').in('id', inviterIds);
        inviterMap = Object.fromEntries((profiles || []).map((p: any) => [p.id, p]));
      }

      setReceived(rows.map((r: any) => ({
        ...r,
        org:            orgMap[r.org_id] || { name: 'Unknown Organization', logo_url: null },
        inviterProfile: inviterMap[r.invited_by] || null,
      })));
    } finally {
      setLoadingR(false);
    }
  };

  // ── Load sent ─────────────────────────────────────────────────────────────
  const loadSent = async () => {
    if (!user) return;
    setLoadingS(true);
    try {
      const { data, error } = await db
        .from('invitations')
        .select('id, org_id, invited_by, target_user_id, role_name, type, status, created_at, expires_at')
        .eq('invited_by', user.id)
        .order('created_at', { ascending: false });

      console.log('Sent:', { userId: user.id, count: data?.length, error: error?.message });

      const rows: any[] = data || [];
      if (!rows.length) { setSent([]); return; }

      const targetIds = [...new Set(rows.map((r: any) => r.target_user_id).filter(Boolean))] as string[];
      let targetMap: Record<string, { name: string; email: string; display_id: string }> = {};
      if (targetIds.length) {
        const { data: profiles } = await supabase
          .from('profiles').select('id, name, email, display_id').in('id', targetIds);
        targetMap = Object.fromEntries((profiles || []).map((p: any) => [p.id, p]));
      }

      setSent(rows.map((r: any) => ({
        ...r,
        targetProfile: targetMap[r.target_user_id] || null,
      })));
    } finally {
      setLoadingS(false);
    }
  };

  useEffect(() => { loadReceived(); loadSent(); }, [user]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleAccept = async (id: string) => {
    setActionId(id + 'accept');
    const { data, error } = await db.rpc('accept_invitation', { p_invitation_id: id });
    if (error || data?.error) {
      toast({ variant: 'destructive', title: 'Error', description: data?.error || error?.message });
    } else {
      toast({ title: '🎉 Welcome!', description: data?.message || 'You joined the organization.' });
      logAudit({ orgId: null, userId: user?.id, action: 'INVITE_ACCEPTED', entity: 'invitation', entityId: id });
      await refreshUser();
      await loadReceived();
    }
    setActionId(null);
  };

  const handleReject = async (id: string) => {
    setActionId(id + 'reject');
    const { data, error } = await db.rpc('reject_invitation', { p_invitation_id: id });
    if (error || data?.error) {
      toast({ variant: 'destructive', title: 'Error', description: data?.error || error?.message });
    } else {
      toast({ title: 'Invitation declined' });
      logAudit({ orgId: null, userId: user?.id, action: 'INVITE_REJECTED', entity: 'invitation', entityId: id });
      await loadReceived();
    }
    setActionId(null);
  };

  const handleCancel = async (id: string) => {
    setActionId(id + 'cancel');
    const { data, error } = await db.rpc('cancel_invitation', { p_invitation_id: id });
    if (error || data?.error) {
      toast({ variant: 'destructive', title: 'Error', description: data?.error || error?.message });
    } else {
      toast({ title: 'Invitation cancelled' });
      await loadSent();
    }
    setActionId(null);
  };

  const handleResend = async (inv: any) => {
    setActionId(inv.id + 'resend');
    const { data: cancelData } = await db.rpc('cancel_invitation', { p_invitation_id: inv.id });
    if (cancelData?.error) {
      toast({ variant: 'destructive', title: 'Error', description: cancelData.error });
      setActionId(null);
      return;
    }
    if (!inv.targetProfile?.display_id) {
      toast({ variant: 'destructive', title: 'Error', description: 'Cannot resend — user ID not found' });
      setActionId(null);
      return;
    }
    const { data, error } = await db.rpc('send_invitation', {
      p_display_id: inv.targetProfile.display_id,
      p_role_name:  inv.role_name,
      p_type:       inv.type || 'team',
    });
    if (error || data?.error) {
      toast({ variant: 'destructive', title: 'Error', description: data?.error || error?.message });
    } else {
      toast({ title: 'Invitation resent!', description: data?.message });
      await loadSent();
    }
    setActionId(null);
  };

  const pendingReceived = received.filter(i => i.status === 'pending');
  const pastReceived    = received.filter(i => i.status !== 'pending');
  const pendingSent     = sent.filter(i => i.status === 'pending');
  const pastSent        = sent.filter(i => i.status !== 'pending');

  return (
    <div className="space-y-6 max-w-3xl mx-auto animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Invitations</h1>
          <p className="text-muted-foreground mt-1 text-sm">Manage organization invitations.</p>
        </div>
        {canInvite && (
          <>
            <Button size="sm" onClick={() => setShowInvite(true)}>
              <Send className="h-4 w-4 mr-1.5" /> Send Invite
            </Button>
            <InviteByIdModal open={showInvite} onClose={() => { setShowInvite(false); loadSent(); }} type="team" />
          </>
        )}
      </div>

      {/* Your ID */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4 flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <UserCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Your Unique ID</p>
            <p className="text-lg font-bold font-mono text-primary tracking-wider">
              {(user as any)?.display_id || '—'}
            </p>
            <p className="text-xs text-muted-foreground">Share this ID so others can invite you.</p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="received">
        <TabsList className="w-full">
          <TabsTrigger value="received" className="flex-1 gap-2">
            <Mail className="h-4 w-4" /> Received
            {pendingReceived.length > 0 && (
              <span className="ml-1 h-5 w-5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
                {pendingReceived.length}
              </span>
            )}
          </TabsTrigger>
          {canInvite && (
            <TabsTrigger value="sent" className="flex-1 gap-2">
              <Send className="h-4 w-4" /> Sent
              {pendingSent.length > 0 && (
                <span className="ml-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                  {pendingSent.length}
                </span>
              )}
            </TabsTrigger>
          )}
        </TabsList>

        {/* ── RECEIVED ── */}
        <TabsContent value="received" className="mt-4 space-y-4">
          {loadingR ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary/40" />
            </div>
          ) : (
            <>
              {pendingReceived.map(inv => (
                <Card key={inv.id} className="border-amber-200/60 shadow-sm overflow-hidden">
                  <CardContent className="p-0">
                    {/* Top accent bar */}
                    <div className="h-1 bg-gradient-to-r from-amber-400 to-orange-400" />
                    <div className="p-5 space-y-4">
                      {/* Org info */}
                      <div className="flex items-center gap-3">
                        <OrgLogo name={inv.org.name} logoUrl={inv.org.logo_url} />
                        <div>
                          <p className="font-bold text-foreground text-base">{inv.org.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Invited by{' '}
                            <span className="font-medium text-foreground">
                              {inv.inviterProfile?.name || inv.inviterProfile?.email || 'Admin'}
                            </span>
                            {' · '}{new Date(inv.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        </div>
                      </div>

                      {/* Role badge */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">You'll join as</span>
                        <span className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold border capitalize',
                          ROLE_STYLES[inv.role_name?.toLowerCase()] || ROLE_STYLES.client
                        )}>
                          <Shield className="h-3 w-3" />
                          {inv.role_name}
                        </span>
                      </div>

                      {/* Expiry warning */}
                      {inv.expires_at && new Date(inv.expires_at) > new Date() && (
                        <p className="text-xs text-amber-600 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Expires {new Date(inv.expires_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </p>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 pt-1">
                        <Button
                          size="sm"
                          className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm"
                          disabled={!!actionId}
                          onClick={() => handleAccept(inv.id)}
                        >
                          {actionId === inv.id + 'accept'
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <><CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />Accept & Join</>}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive border-destructive/30 hover:bg-destructive/5"
                          disabled={!!actionId}
                          onClick={() => handleReject(inv.id)}
                        >
                          {actionId === inv.id + 'reject'
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <><XCircle className="h-3.5 w-3.5 mr-1.5" />Decline</>}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* Past received */}
              {pastReceived.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">History</p>
                  {pastReceived.map(inv => (
                    <div key={inv.id} className="flex items-center justify-between p-3.5 rounded-xl border border-border/40 bg-card/50 opacity-70">
                      <div className="flex items-center gap-3">
                        <OrgLogo name={inv.org.name} logoUrl={inv.org.logo_url} size="sm" />
                        <div>
                          <p className="text-sm font-semibold text-foreground">{inv.org.name}</p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {inv.role_name} · {new Date(inv.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase', STATUS_STYLES[inv.status] || STATUS_STYLES.expired)}>
                        {inv.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {received.length === 0 && (
                <div className="py-16 text-center border-2 border-dashed border-border/50 rounded-2xl">
                  <Mail className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-30" />
                  <p className="text-sm font-medium text-muted-foreground">No invitations received yet.</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Share your Unique ID to receive invitations.</p>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* ── SENT ── */}
        {canInvite && (
          <TabsContent value="sent" className="mt-4 space-y-4">
            {loadingS ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary/40" />
              </div>
            ) : (
              <>
                {pendingSent.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-amber-500" /> Pending ({pendingSent.length})
                    </p>
                    {pendingSent.map(inv => (
                      <Card key={inv.id} className="border-border/50 shadow-sm">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                                {(inv.targetProfile?.name || inv.targetProfile?.email || '?').charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-foreground">
                                  {inv.targetProfile?.name || inv.targetProfile?.email || 'Unknown User'}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-xs text-muted-foreground font-mono">{inv.targetProfile?.display_id || '—'}</span>
                                  <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full border capitalize', ROLE_STYLES[inv.role_name?.toLowerCase()] || ROLE_STYLES.client)}>
                                    {inv.role_name}
                                  </span>
                                  <span className="text-xs text-muted-foreground">{new Date(inv.created_at).toLocaleDateString()}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2 shrink-0">
                              <Button size="sm" variant="outline" className="h-8 gap-1"
                                disabled={!!actionId} onClick={() => handleResend(inv)}>
                                {actionId === inv.id + 'resend' ? <Loader2 className="h-3 w-3 animate-spin" /> : <><RefreshCw className="h-3 w-3" />Resend</>}
                              </Button>
                              <Button size="sm" variant="outline" className="h-8 gap-1 text-destructive border-destructive/30"
                                disabled={!!actionId} onClick={() => handleCancel(inv.id)}>
                                {actionId === inv.id + 'cancel' ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Ban className="h-3 w-3" />Cancel</>}
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {pastSent.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">History</p>
                    {pastSent.map(inv => (
                      <div key={inv.id} className="flex items-center justify-between p-3.5 rounded-xl border border-border/40 bg-card/50 opacity-70">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-bold text-xs shrink-0">
                            {(inv.targetProfile?.name || '?').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {inv.targetProfile?.name || inv.targetProfile?.email || 'Unknown'}
                            </p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {inv.role_name} · {new Date(inv.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {inv.status === 'rejected' && (
                            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1"
                              disabled={!!actionId} onClick={() => handleResend(inv)}>
                              <RefreshCw className="h-3 w-3" /> Resend
                            </Button>
                          )}
                          <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase', STATUS_STYLES[inv.status] || STATUS_STYLES.expired)}>
                            {inv.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {sent.length === 0 && (
                  <div className="py-16 text-center border-2 border-dashed border-border/50 rounded-2xl">
                    <Send className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-30" />
                    <p className="text-sm font-medium text-muted-foreground">No invitations sent yet.</p>
                    <Button size="sm" variant="outline" className="mt-3" onClick={() => setShowInvite(true)}>
                      Send your first invite
                    </Button>
                  </div>
                )}
              </>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
