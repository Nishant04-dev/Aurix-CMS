import React, { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { logAudit } from '@/lib/auditLog';
import { useOrgSettings } from '@/hooks/use-org-settings';
import { usePermissions } from '@/hooks/use-permissions';
import { api } from '@/lib/apiClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Loader2, Building2, Globe, DollarSign, Settings2, Upload, X,
  CheckCircle2, ImageIcon, CreditCard,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SUPPORTED_CURRENCIES } from '@/lib/currency';
import { cn } from '@/lib/utils';

const TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Kolkata', 'Asia/Dubai',
  'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney', 'Pacific/Auckland',
];

// ── Settings sub-nav ──────────────────────────────────────────
const SETTINGS_NAV = [
  { label: 'Organization', path: '/settings',         icon: Building2 },
  { label: 'Billing',      path: '/settings/billing', icon: CreditCard, ownerOnly: true },
];

function SettingsNav() {
  const { user } = useAuth();
  const location = useLocation();
  const isOwner = user?.role === 'admin' || user?.role === 'super_admin';
  return (
    <nav className="flex flex-col gap-1">
      {SETTINGS_NAV.filter(item => !item.ownerOnly || isOwner).map(item => {
        const active = item.path === '/settings'
          ? location.pathname === '/settings'
          : location.pathname.startsWith(item.path);
        return (
          <NavLink
            key={item.path}
            to={item.path}
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              active
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.label}
          </NavLink>
        );
      })}
    </nav>
  );
}

// ── Organization settings form ────────────────────────────────
function OrgSettingsForm() {
  const { user, orgId } = useAuth();
  const { settings, isLoading, updateSettings } = useOrgSettings();
  const { isAdmin } = usePermissions();
  const { toast } = useToast();
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: '', website: '', phone: '', address: '',
    logo_url: '', gst_number: '', currency: 'INR', timezone: 'UTC',
  });
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setForm({
        name:       settings.name        || '',
        website:    settings.website     || '',
        phone:      settings.phone       || '',
        address:    settings.address     || '',
        logo_url:   settings.logo_url    || '',
        gst_number: settings.gst_number  || '',
        currency:   settings.currency    || 'INR',
        timezone:   settings.timezone    || 'UTC',
      });
      setLogoPreview(settings.logo_url || null);
    }
  }, [settings]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !orgId) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'File too large', description: 'Logo must be under 2MB.' });
      return;
    }
    setUploadingLogo(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${orgId}/logo.${ext}`;
      const formData = new FormData();
      formData.append('file', file);
      formData.append('bucket', 'org-logos');
      formData.append('path', path);
      await api.upload('/storage/upload', formData);
      const { publicUrl } = await api.get<{ publicUrl: string }>('/storage/public-url', { bucket: 'org-logos', path });
      setForm(f => ({ ...f, logo_url: publicUrl }));
      setLogoPreview(publicUrl);
      toast({ title: 'Logo uploaded', description: 'Save settings to apply.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Upload failed', description: err.message });
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const removeLogo = () => { setForm(f => ({ ...f, logo_url: '' })); setLogoPreview(null); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId || !isAdmin) return;
    if (!form.name.trim()) {
      toast({ variant: 'destructive', title: 'Validation', description: 'Organization name is required.' });
      return;
    }
    setSaving(true);
    try {
      await updateSettings.mutateAsync({
        name: form.name.trim(), website: form.website.trim() || null,
        phone: form.phone.trim() || null, address: form.address.trim() || null,
        logo_url: form.logo_url || null, gst_number: form.gst_number.trim() || null,
        currency: form.currency, timezone: form.timezone,
      } as any);
      console.log('AUDIT LOG TRIGGERED: ORG_SETTINGS_UPDATED');
      logAudit({ orgId, userId: user?.id, action: 'ORG_SETTINGS_UPDATED', entity: 'organization', entityId: orgId || undefined, metadata: { name: form.name, currency: form.currency } });
      toast({ title: 'Settings saved', description: 'Organization settings updated successfully.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary/40" /></div>;

  const disabled = !isAdmin || saving;
  const orgInitials = (form.name || 'O').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Organization Settings</h2>
        <p className="text-muted-foreground text-sm mt-1">Manage your workspace configuration and branding.</p>
      </div>

      {!isAdmin && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
          You have read-only access. Only admins can modify organization settings.
        </div>
      )}

      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" /> General Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Organization Name <span className="text-destructive">*</span></Label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Acme Agency" disabled={disabled} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Website</Label>
              <Input value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} placeholder="https://example.com" disabled={disabled} />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+1 555-0100" disabled={disabled} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Address</Label>
            <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="123 Main St, City, Country" disabled={disabled} />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-primary" /> Branding
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Label>Organization Logo</Label>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-xl border-2 border-dashed border-border/50 flex items-center justify-center bg-muted/20 overflow-hidden shrink-0">
              {logoPreview ? <img src={logoPreview} alt="Logo" className="h-full w-full object-contain" /> : <span className="text-lg font-bold text-muted-foreground">{orgInitials}</span>}
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex gap-2">
                <input type="file" accept="image/*" className="hidden" ref={logoInputRef} onChange={handleLogoUpload} />
                <Button type="button" variant="outline" size="sm" disabled={disabled || uploadingLogo} onClick={() => logoInputRef.current?.click()}>
                  {uploadingLogo ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />} Upload Logo
                </Button>
                {logoPreview && (
                  <Button type="button" variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" disabled={disabled} onClick={removeLogo}>
                    <X className="h-4 w-4 mr-1" /> Remove
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">PNG, JPG or SVG. Max 2MB.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" /> Financial Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v }))} disabled={disabled}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SUPPORTED_CURRENCIES.map(c => (
                    <SelectItem key={c.code} value={c.code}><span className="font-mono mr-2">{c.symbol}</span>{c.name} ({c.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>GST / Tax Number</Label>
              <Input value={form.gst_number} onChange={e => setForm(f => ({ ...f, gst_number: e.target.value }))} placeholder="e.g. 22AAAAA0000A1Z5" disabled={disabled} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-primary" /> Preferences
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Timezone</Label>
            <Select value={form.timezone} onValueChange={v => setForm(f => ({ ...f, timezone: v }))} disabled={disabled}>
              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIMEZONES.map(tz => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Used for scheduling and date display across the platform.</p>
          </div>
        </CardContent>
      </Card>

      {isAdmin && (
        <div className="flex justify-end">
          <Button type="submit" disabled={saving} className="min-w-[140px]">
            {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</> : <><CheckCircle2 className="h-4 w-4 mr-2" />Save Settings</>}
          </Button>
        </div>
      )}
    </form>
  );
}

// ── Main Settings layout ──────────────────────────────────────
export default function Settings() {
  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your organization and account preferences.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-6 items-start">
        {/* Left nav */}
        <div className="w-full md:w-52 shrink-0">
          <div className="rounded-xl border border-border/50 bg-card p-2 shadow-sm">
            <SettingsNav />
          </div>
        </div>

        {/* Right content */}
        <div className="flex-1 min-w-0">
          <OrgSettingsForm />
        </div>
      </div>
    </div>
  );
}
