import React, { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { logAudit } from '@/lib/auditLog';
import { useOrgSettings } from '@/hooks/use-org-settings';
import { usePermissions } from '@/hooks/use-permissions';
import { api } from '@/lib/apiClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Loader2, Building2, Globe, DollarSign, Settings2, Upload, X,
  CheckCircle2, ImageIcon, CreditCard, Palette, Percent, Trash2, Plus, Banknote,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SUPPORTED_CURRENCIES } from '@/lib/currency';
import { cn } from '@/lib/utils';
import { useTaxes } from '@/hooks/use-taxes';

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

  const { data: templates = [] } = useQuery({
    queryKey: ['templates'],
    queryFn: () => api.get<any[]>('/templates'),
    enabled: !!orgId,
  });

  const [form, setForm] = useState({
    name: '', website: '', phone: '', address: '', email: '',
    logo_url: '', gst_number: '', currency: 'INR', timezone: 'UTC',
  });
  const [branding, setBranding] = useState({ color: '#6366f1', font: 'inter', show_logo: true, show_gst: true });
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('none');
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
        email:      settings.email       || '',
        logo_url:   settings.logo_url    || '',
        gst_number: settings.gst_number  || '',
        currency:   settings.currency    || 'INR',
        timezone:   settings.timezone    || 'UTC',
      });
      setLogoPreview(settings.logo_url || null);
      setBranding({
        color:     '#6366f1',
        font:      'inter',
        show_logo: true,
        show_gst:  true,
        ...(settings.branding ?? {}),
      });
      setSelectedTemplateId(settings.template_id ?? 'none');
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
        email: form.email.trim() || null,
        logo_url: form.logo_url || null, gst_number: form.gst_number.trim() || null,
        currency: form.currency, timezone: form.timezone,
        branding, template_id: selectedTemplateId === 'none' ? null : (selectedTemplateId || null),
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
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="billing@yourcompany.com" disabled={disabled} />
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

      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Palette className="h-4 w-4 text-primary" /> Document Template & Branding
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Default Invoice / Quotation Template</Label>
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId} disabled={disabled}>
              <SelectTrigger className="h-10"><SelectValue placeholder="Select template" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No default (Basic)</SelectItem>
                {(templates as any[]).map((t: any) => (
                  <SelectItem key={t.id} value={t.id} disabled={t.locked}>
                    {t.name} {t.locked ? `(${t.plan_required} plan)` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Applied automatically when creating invoices and quotations.</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Brand Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={branding.color}
                  onChange={e => setBranding(b => ({ ...b, color: e.target.value }))}
                  disabled={disabled}
                  className="h-10 w-16 rounded border border-border cursor-pointer disabled:opacity-50"
                />
                <Input
                  value={branding.color}
                  onChange={e => setBranding(b => ({ ...b, color: e.target.value }))}
                  disabled={disabled}
                  className="font-mono text-sm"
                  maxLength={7}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Font Style</Label>
              <Select value={branding.font} onValueChange={v => setBranding(b => ({ ...b, font: v }))} disabled={disabled}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="inter">Inter (Modern)</SelectItem>
                  <SelectItem value="serif">Serif (Classic)</SelectItem>
                  <SelectItem value="mono">Monospace (Technical)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={branding.show_logo} onChange={e => setBranding(b => ({ ...b, show_logo: e.target.checked }))} disabled={disabled} className="rounded" />
              <span className="text-sm">Show logo on documents</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={branding.show_gst} onChange={e => setBranding(b => ({ ...b, show_gst: e.target.checked }))} disabled={disabled} className="rounded" />
              <span className="text-sm">Show GST number</span>
            </label>
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

// ── Taxes section ─────────────────────────────────────────────
function TaxesSection() {
  const { taxes, isLoading, createTax, deleteTax } = useTaxes();
  const { isAdmin } = usePermissions();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [percentage, setPercentage] = useState('');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !percentage) return;
    try {
      await createTax.mutateAsync({ name: name.trim(), percentage: Number(percentage) });
      setName('');
      setPercentage('');
      toast({ title: 'Tax added' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    }
  };

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Percent className="h-4 w-4 text-primary" /> Taxes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary/40" /></div>
        ) : (
          <div className="space-y-2">
            {taxes.length === 0 && (
              <p className="text-sm text-muted-foreground">No taxes configured yet.</p>
            )}
            {taxes.map(t => (
              <div key={t.id} className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2">
                <span className="text-sm font-medium">{t.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono text-muted-foreground">{t.percentage}%</span>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => deleteTax.mutate(t.id)}
                      disabled={deleteTax.isPending}
                      className="text-destructive hover:text-destructive/80 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {isAdmin && (
          <form onSubmit={handleAdd} className="flex gap-2 pt-2">
            <Input
              placeholder="Tax name (e.g. GST)"
              value={name}
              onChange={e => setName(e.target.value)}
              className="flex-1"
            />
            <Input
              type="number"
              placeholder="%"
              value={percentage}
              onChange={e => setPercentage(e.target.value)}
              className="w-20"
              min="0"
              max="100"
              step="0.01"
            />
            <Button type="submit" size="sm" disabled={createTax.isPending || !name || !percentage}>
              {createTax.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
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
        <div className="flex-1 min-w-0 space-y-6">
          <OrgSettingsForm />
          <TaxesSection />
        </div>
      </div>
    </div>
  );
}
