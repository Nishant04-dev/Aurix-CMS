import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { storePendingAccountType } from '@/lib/accountTypeSetup';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, User, Building2, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tab = 'login' | 'signup';
type SignupStep = 'credentials' | 'account-type';

export default function Login() {
  const { login } = useAuth();

  const [tab, setTab]               = useState<Tab>('login');
  const [signupStep, setSignupStep] = useState<SignupStep>('credentials');

  const [email, setEmail]                     = useState('');
  const [password, setPassword]               = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loginLoading, setLoginLoading]   = useState(false);
  const [selectingType, setSelectingType] = useState<'user' | 'business' | null>(null);
  const [error, setError]                 = useState('');
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [signupEmail, setSignupEmail]     = useState('');

  const reset = () => {
    setError('');
    setSignupSuccess(false);
    setSignupStep('credentials');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setSelectingType(null);
  };

  // ── Step 1: validate ──────────────────────────────────────────────────────
  const handleCredentialsNext = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim())                              { setError('Email is required'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Invalid email address'); return; }
    if (password.length < 6)                        { setError('Password must be at least 6 characters'); return; }
    if (password !== confirmPassword)               { setError('Passwords do not match'); return; }
    setSignupStep('account-type');
  };

  // ── Step 2: create account ────────────────────────────────────────────────
  const handleAccountTypeSelect = async (type: 'user' | 'business') => {
    if (selectingType) return;
    setSelectingType(type);
    setError('');
    console.log('Selected type:', type);

    try {
      // 1. Persist chosen type BEFORE signUp — survives any redirect
      storePendingAccountType(type);

      // 2. Create auth user
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) throw signUpError;

      console.log('Signup result:', { userId: data.user?.id, hasSession: !!data.session });

      // 3. Stop spinner immediately — AuthContext handles everything from here
      //    via onAuthStateChange → loadUser → finalizeAccountType → fetchProfile
      setSelectingType(null);

      if (!data.session) {
        // Email confirmation ON — show success screen, pending type stays in localStorage
        setSignupEmail(email);
        setSignupSuccess(true);
      }
      // If session exists: onAuthStateChange fires SIGNED_IN → AuthContext redirects
    } catch (err: any) {
      console.error('Signup error:', err);
      setError(err.message || 'Signup failed. Please try again.');
      setSignupStep('credentials');
      setSelectingType(null);
    }
  };

  // ── Login ─────────────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setError('');
    try {
      const result = await login(email, password);
      if (!result.success) {
        setError(result.error || 'Invalid email or password');
        setLoginLoading(false);
      }
      // On success: AuthContext sets user → App.tsx unmounts Login automatically
    } catch {
      setError('Something went wrong. Please try again.');
      setLoginLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">

        <div className="text-center animate-in fade-in slide-in-from-bottom-3 duration-700">
          <div className="mx-auto mb-4 h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <span className="text-xl font-bold text-primary">A</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Aurix</h1>
          <p className="text-sm text-muted-foreground mt-1">Business OS for agencies</p>
        </div>

        <div className="bg-card border border-border/50 rounded-xl shadow-sm overflow-hidden animate-in fade-in zoom-in-95 duration-500">

          {/* Tabs */}
          <div className="flex border-b border-border/50">
            {(['login', 'signup'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); reset(); }}
                className={cn(
                  'flex-1 py-3 text-sm font-medium transition-colors',
                  tab === t
                    ? 'text-primary border-b-2 border-primary bg-primary/5'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {t === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <div className="p-6">

            {/* ── Email confirm success ── */}
            {signupSuccess ? (
              <div className="text-center space-y-3 py-4">
                <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                  <span className="text-emerald-600 text-xl">✓</span>
                </div>
                <p className="font-semibold text-foreground">Check your email</p>
                <p className="text-sm text-muted-foreground">
                  We sent a confirmation link to <strong>{signupEmail}</strong>.
                  Click it to activate your account, then sign in.
                </p>
                <Button variant="outline" className="w-full mt-2" onClick={() => { setTab('login'); reset(); }}>
                  Back to Sign In
                </Button>
              </div>

            ) : tab === 'login' ? (
              /* ── Login ── */
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Email</label>
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="you@company.com" required disabled={loginLoading} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Password</label>
                  <Input type="password" value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••" required disabled={loginLoading} />
                </div>
                {error && <div className="bg-destructive/10 text-destructive text-xs p-3 rounded-md">{error}</div>}
                <Button type="submit" className="w-full" disabled={loginLoading}>
                  {loginLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in...</> : 'Sign In'}
                </Button>
              </form>

            ) : signupStep === 'credentials' ? (
              /* ── Signup step 1 ── */
              <form onSubmit={handleCredentialsNext} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Email</label>
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="you@company.com" required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Password</label>
                  <Input type="password" value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="Min. 6 characters" required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Confirm Password</label>
                  <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="••••••••" required />
                </div>
                {error && <div className="bg-destructive/10 text-destructive text-xs p-3 rounded-md">{error}</div>}
                <Button type="submit" className="w-full">Continue</Button>
              </form>

            ) : (
              /* ── Signup step 2: account type ── */
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <button
                    onClick={() => { setSignupStep('credentials'); setError(''); }}
                    disabled={!!selectingType}
                    className="p-1 rounded hover:bg-accent text-muted-foreground disabled:opacity-40"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <p className="text-sm font-semibold text-foreground">What are you here for?</p>
                </div>

                <button
                  onClick={() => handleAccountTypeSelect('user')}
                  disabled={!!selectingType}
                  className={cn(
                    'w-full flex items-start gap-4 rounded-xl border-2 border-border bg-background p-4 text-left',
                    'hover:border-primary hover:bg-primary/5 transition-all duration-150',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    {selectingType === 'user'
                      ? <Loader2 className="h-4 w-4 text-primary animate-spin" />
                      : <User className="h-4 w-4 text-primary" />
                    }
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-foreground">Personal Use</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      Access assigned projects, invoices, and messages
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => handleAccountTypeSelect('business')}
                  disabled={!!selectingType}
                  className={cn(
                    'w-full flex items-start gap-4 rounded-xl border-2 border-border bg-background p-4 text-left',
                    'hover:border-primary hover:bg-primary/5 transition-all duration-150',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    {selectingType === 'business'
                      ? <Loader2 className="h-4 w-4 text-primary animate-spin" />
                      : <Building2 className="h-4 w-4 text-primary" />
                    }
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-foreground">Build a Business</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      Create an organization, manage clients, projects, and your team
                    </p>
                  </div>
                </button>

                {error && <div className="bg-destructive/10 text-destructive text-xs p-3 rounded-md">{error}</div>}
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground px-8 leading-relaxed">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
