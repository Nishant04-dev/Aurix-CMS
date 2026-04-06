import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/apiClient';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLeaveOrganization } from '@/hooks/use-membership';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, User, Lock, Shield, Mail, Phone, BadgeCheck, Building2, ArrowRight, AlertTriangle, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';

// Role labels — "client" replaced with "User" for individual accounts
const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  super_admin: { label: 'Super Admin',   color: 'bg-purple-100 text-purple-700 border-purple-200' },
  admin:       { label: 'Business Owner', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  manager:     { label: 'Manager',        color: 'bg-orange-100 text-orange-700 border-orange-200' },
  developer:   { label: 'Developer',      color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  support:     { label: 'Support',        color: 'bg-sky-100 text-sky-700 border-sky-200' },
  client:      { label: 'Team Member',    color: 'bg-slate-100 text-slate-600 border-slate-200' },
};

export default function Profile() {
  const { user, accountType, upgradeToBusinessAccount, logout, orgId, refreshUser } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [upgradingBusiness, setUpgradingBusiness] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const leaveOrg = useLeaveOrganization();

  // Profile form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileDirty, setProfileDirty] = useState(false);

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});

  // Load current profile data
  useEffect(() => {
    if (!user) return;
    const loadProfile = async () => {
      try {
        const data = await api.get<any>('/profile');
        setName(data?.name || '');
        setPhone(data?.phone || '');
      } catch { /* use auth context values as fallback */ }
    };
    loadProfile();
  }, [user]);

  // Track if profile form has changes
  useEffect(() => {
    if (!user) return;
    const originalName = user.name || '';
    setProfileDirty(name !== originalName || phone !== '');
  }, [name, phone, user]);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!name.trim()) {
      toast({ variant: 'destructive', title: 'Validation Error', description: 'Full name is required.' });
      return;
    }

    setProfileLoading(true);
    try {
      await api.patch('/profile', { name: name.trim(), phone: phone.trim() || null });
      toast({ title: 'Profile Updated', description: 'Your profile has been saved successfully.' });
      setProfileDirty(false);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setProfileLoading(false);
    }
  };

  const validatePassword = () => {
    const errors: Record<string, string> = {};
    if (!currentPassword) errors.currentPassword = 'Current password is required';
    if (!newPassword) errors.newPassword = 'New password is required';
    else if (newPassword.length < 6) errors.newPassword = 'Password must be at least 6 characters';
    if (!confirmPassword) errors.confirmPassword = 'Please confirm your new password';
    else if (newPassword !== confirmPassword) errors.confirmPassword = 'Passwords do not match';
    setPasswordErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePassword()) return;

    setPasswordLoading(true);
    try {
      // Re-authenticate with current password first
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || '',
        password: currentPassword,
      });
      if (signInError) {
        setPasswordErrors({ currentPassword: 'Current password is incorrect' });
        return;
      }

      // Update to new password
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      toast({ title: 'Password Changed', description: 'Your password has been updated successfully.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordErrors({});
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setPasswordLoading(false);
    }
  };

  if (!user) return null;

  // For individual users, show "User" instead of any role label
  const isIndividual = accountType === 'user';
  const roleCfg = isIndividual
    ? { label: 'User', color: 'bg-slate-100 text-slate-600 border-slate-200' }
    : (ROLE_LABELS[user.role] ?? ROLE_LABELS.client);
  const initials = (user.name || user.email || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const handleUpgradeToBusiness = async () => {
    setUpgradingBusiness(true);
    try {
      await upgradeToBusinessAccount();
      navigate('/onboarding');
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setUpgradingBusiness(false);
    }
  };

  return (
    <div className="space-y-8 max-w-2xl mx-auto animate-in fade-in duration-700">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">My Profile</h1>
        <p className="text-muted-foreground mt-1 text-sm font-medium">Manage your personal information and account security.</p>
      </div>

      {/* Avatar + identity strip */}
      <div className="flex items-center gap-5 p-6 rounded-xl border border-border/50 bg-card shadow-sm">
        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10 flex items-center justify-center text-2xl font-bold text-primary select-none">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-lg font-bold text-foreground truncate">{user.name || 'No name set'}</p>
          <p className="text-sm text-muted-foreground truncate">{user.email}</p>
          <div className="mt-2 flex items-center gap-2">
            <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold border', roleCfg.color)}>
              <Shield className="h-3 w-3" /> {roleCfg.label}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold border bg-emerald-50 text-emerald-600 border-emerald-100">
              <BadgeCheck className="h-3 w-3" /> Verified
            </span>
          </div>
        </div>
      </div>

      {/* Basic Information */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <User className="h-4 w-4 text-primary" /> Basic Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleProfileSave} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={name}
                onChange={e => { setName(e.target.value); setProfileDirty(true); }}
                placeholder="Your full name"
                disabled={profileLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-1.5">
                Email Address
                <span className="text-[10px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded uppercase tracking-wider">Read-only</span>
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  value={user.email}
                  readOnly
                  disabled
                  className="pl-9 bg-muted/40 cursor-not-allowed"
                />
              </div>
              <p className="text-xs text-muted-foreground">Email cannot be changed for security reasons.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  value={phone}
                  onChange={e => { setPhone(e.target.value); setProfileDirty(true); }}
                  placeholder="+1 555-0100"
                  className="pl-9"
                  disabled={profileLoading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                Role
                <span className="text-[10px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded uppercase tracking-wider">Read-only</span>
              </Label>
              <div className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold border', roleCfg.color)}>
                <Shield className="h-3.5 w-3.5" /> {roleCfg.label}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={profileLoading || !profileDirty}>
                {profileLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Save Changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" /> Change Password
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                disabled={passwordLoading}
              />
              {passwordErrors.currentPassword && (
                <p className="text-xs text-destructive">{passwordErrors.currentPassword}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Min. 6 characters"
                disabled={passwordLoading}
              />
              {passwordErrors.newPassword && (
                <p className="text-xs text-destructive">{passwordErrors.newPassword}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                disabled={passwordLoading}
              />
              {passwordErrors.confirmPassword && (
                <p className="text-xs text-destructive">{passwordErrors.confirmPassword}</p>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={passwordLoading || (!currentPassword && !newPassword && !confirmPassword)}>
                {passwordLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Update Password
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Upgrade to Business — only for individual users */}
      {isIndividual && (
        <Card className="border-primary/20 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" /> Upgrade to Business
            </CardTitle>
            <CardDescription>
              Create an organization to manage clients, projects, invoices, and your team.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleUpgradeToBusiness}
              disabled={upgradingBusiness}
              variant="outline"
              className="border-primary/30 text-primary hover:bg-primary/5 gap-2"
            >
              {upgradingBusiness
                ? <><Loader2 className="h-4 w-4 animate-spin" />Upgrading...</>
                : <><Building2 className="h-4 w-4" />Get Started <ArrowRight className="h-4 w-4" /></>
              }
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Danger Zone — Leave Organization (for any user who belongs to an org) */}
      {orgId && (
        <>
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 space-y-3">
            <h3 className="text-sm font-bold text-destructive uppercase tracking-widest flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Danger Zone
            </h3>
            <p className="text-sm text-muted-foreground">
              Leaving the organization will immediately revoke your access to all projects, clients, and data.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="border-destructive/40 text-destructive hover:bg-destructive/10 gap-2"
              onClick={() => setConfirmLeave(true)}
            >
              <LogOut className="h-4 w-4" /> Leave Organization
            </Button>
          </div>

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
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={async () => {
                    try {
                      const result = await leaveOrg.mutateAsync();
                      toast({ title: 'You left the organization' });
                      setConfirmLeave(false);
                      // Refresh auth context — if another org was found, stay in app
                      // If no org left, account_type is now 'user' → App.tsx handles routing
                      await refreshUser();
                      navigate('/');
                    } catch (err: any) {
                      toast({ variant: 'destructive', title: 'Error', description: err.message });
                      setConfirmLeave(false);
                    }
                  }}
                  disabled={leaveOrg.isPending}
                >
                  {leaveOrg.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Leave Organization
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}
