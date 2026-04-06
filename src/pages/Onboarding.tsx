import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/apiClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, Building2, ArrowRight, CheckCircle2, Users, Shield, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

const COMPANY_SIZES = [
  { value: '1-5',    label: 'Just me (1–5 people)' },
  { value: '6-20',   label: 'Small team (6–20 people)' },
  { value: '21-50',  label: 'Growing team (21–50 people)' },
  { value: '51-200', label: 'Mid-size (51–200 people)' },
  { value: '200+',   label: 'Enterprise (200+ people)' },
];

const INDUSTRIES = [
  'Agency / Creative',
  'Software / Technology',
  'Marketing / Advertising',
  'Consulting',
  'Design / UX',
  'E-commerce',
  'Finance',
  'Healthcare',
  'Education',
  'Other',
];

const FEATURES = [
  { icon: Shield, text: 'Role-based access control' },
  { icon: Users, text: 'Unlimited team members' },
  { icon: Zap,   text: 'Real-time collaboration' },
];

export default function Onboarding() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();

  const [orgName, setOrgName]       = useState('');
  const [companySize, setCompanySize] = useState('');
  const [industry, setIndustry]     = useState('');
  const [loading, setLoading]       = useState(false);
  const [success, setSuccess]       = useState(false);
  const [error, setError]           = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim()) { setError('Organization name is required'); return; }
    if (!user) return;

    setLoading(true);
    setError('');

    try {
      await api.post('/onboarding/provision', { org_name: orgName.trim() });

      setSuccess(true);
      toast({ title: 'Workspace created!', description: `Welcome to ${orgName}.` });

      // Small delay so user sees the success state, then refresh
      setTimeout(async () => {
        await refreshUser();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Failed to create workspace. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-8 items-center animate-in fade-in slide-in-from-bottom-4 duration-700">

        {/* Left — branding panel */}
        <div className="hidden lg:flex flex-col gap-8 pr-8">
          <div>
            <div className="flex items-center gap-2 mb-8">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">A</span>
              </div>
              <span className="text-xl font-bold text-foreground">Aurix</span>
            </div>
            <h2 className="text-4xl font-bold tracking-tight text-foreground leading-tight">
              Your agency's<br />
              <span className="text-primary">command center</span>
            </h2>
            <p className="text-muted-foreground mt-4 text-base leading-relaxed">
              Manage projects, clients, invoices, and your team — all in one place.
            </p>
          </div>

          <div className="space-y-4">
            {FEATURES.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <span className="text-sm font-medium text-foreground">{text}</span>
              </div>
            ))}
          </div>

          <div className="p-4 rounded-xl bg-card border border-border/50 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-700">NC</div>
              <div>
                <p className="text-xs font-semibold text-foreground">Nishant Chauhan</p>
                <p className="text-[10px] text-muted-foreground">Aurix Agency</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground italic">"Aurix transformed how we manage client projects. Everything in one place."</p>
          </div>
        </div>

        {/* Right — form */}
        <div className="w-full">
          {success ? (
            <div className="bg-card border border-border/50 rounded-2xl p-8 shadow-sm text-center space-y-4 animate-in zoom-in-95 duration-300">
              <div className="mx-auto h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              </div>
              <h3 className="text-xl font-bold text-foreground">Workspace created!</h3>
              <p className="text-sm text-muted-foreground">Setting up your dashboard...</p>
              <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />
            </div>
          ) : (
            <div className="bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden">
              {/* Card header */}
              <div className="px-8 pt-8 pb-6 border-b border-border/50">
                <div className="flex items-center gap-3 mb-1 lg:hidden">
                  <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
                    <span className="text-primary-foreground font-bold text-xs">A</span>
                  </div>
                  <span className="font-bold text-foreground">Aurix</span>
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Create Your Workspace</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Set up your organization to get started
                </p>
              </div>

              <form onSubmit={handleCreate} className="px-8 py-6 space-y-5">
                {/* Org name */}
                <div className="space-y-2">
                  <Label htmlFor="orgName">
                    Organization Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="orgName"
                    value={orgName}
                    onChange={e => { setOrgName(e.target.value); setError(''); }}
                    placeholder="e.g. Acme Creative Agency"
                    disabled={loading}
                    autoFocus
                    className="h-11"
                  />
                  {error && <p className="text-xs text-destructive">{error}</p>}
                </div>

                {/* Company size */}
                <div className="space-y-2">
                  <Label>Company Size <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Select value={companySize} onValueChange={setCompanySize} disabled={loading}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="How big is your team?" />
                    </SelectTrigger>
                    <SelectContent>
                      {COMPANY_SIZES.map(s => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Industry */}
                <div className="space-y-2">
                  <Label>Industry <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Select value={industry} onValueChange={setIndustry} disabled={loading}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select your industry" />
                    </SelectTrigger>
                    <SelectContent>
                      {INDUSTRIES.map(i => (
                        <SelectItem key={i} value={i}>{i}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 text-sm font-semibold"
                  disabled={loading || !orgName.trim()}
                >
                  {loading ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Creating workspace...</>
                  ) : (
                    <><ArrowRight className="h-4 w-4 mr-2" /> Create Workspace</>
                  )}
                </Button>

                <p className="text-center text-xs text-muted-foreground">
                  Signed in as <span className="font-medium text-foreground">{user?.email}</span>
                </p>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
