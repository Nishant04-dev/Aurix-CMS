import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { User, UserRole } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { finalizeAccountType, getPendingAccountType } from '@/lib/accountTypeSetup';

interface AuthContextType {
  user: User | null;
  orgId: string | null;
  orgStatus: string | null;
  orgPlan: string | null;
  isPlatformOwner: boolean;
  accountType: 'user' | 'business';
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (email: string, password: string, accountType?: 'user' | 'business') => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  upgradeToBusinessAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// ── Minimal user from session only — no DB needed ────────────────────────────
function minimalUser(sessionUser: any): User {
  return {
    id: sessionUser.id,
    email: sessionUser.email || '',
    name: sessionUser.email?.split('@')[0] || 'User',
    role: 'client' as UserRole,
    createdAt: sessionUser.created_at,
  } as any;
}

// ── Full profile fetch — never throws ────────────────────────────────────────
async function fetchProfile(sessionUser: any) {
  try {
    const { data: p } = await supabase
      .from('profiles')
      .select('id, name, email, role, org_id, account_type, is_platform_owner, display_id, avatar_url, status')
      .eq('id', sessionUser.id)
      .maybeSingle();

    // Block banned/disabled accounts
    if ((p as any)?.status === 'banned' || (p as any)?.status === 'disabled') {
      await supabase.auth.signOut();
      return null;
    }

    let resolvedOrgId: string | null = (p as any)?.org_id || null;

    // Auto-initialize: if org_id is null but user owns orgs, set to first owned org
    if (!resolvedOrgId) {
      try {
        const { data: ownedOrg } = await (supabase as any)
          .from('organizations')
          .select('id')
          .eq('owner_id', sessionUser.id)
          .limit(1)
          .maybeSingle();
        if (ownedOrg?.id) {
          resolvedOrgId = ownedOrg.id;
          // Persist so next load is instant
          await (supabase as any)
            .from('profiles')
            .update({ org_id: ownedOrg.id, role: 'super_admin', account_type: 'business', power_level: 100 })
            .eq('id', sessionUser.id);
        }
      } catch { /* ignore */ }
    }
    const rawType = (p as any)?.account_type;
    const accountType: 'user' | 'business' =
      rawType === 'business' || rawType === 'user'
        ? rawType
        : resolvedOrgId ? 'business' : 'user';

    // Fetch org status separately — non-blocking, non-throwing
    let orgStatus: string | null = null;
    let orgPlan: string | null = null;
    if (resolvedOrgId) {
      try {
        const { data: orgData } = await (supabase as any)
          .from('organizations')
          .select('status, plan')
          .eq('id', resolvedOrgId)
          .maybeSingle();
        orgStatus = orgData?.status ?? null;
        orgPlan   = orgData?.plan   ?? 'free';

        // If current org is rejected/suspended, auto-switch to another approved org
        if (orgStatus === 'rejected' || orgStatus === 'suspended') {
          const { data: nextOrg } = await (supabase as any)
            .from('organizations')
            .select('id, status, plan')
            .eq('owner_id', sessionUser.id)
            .eq('status', 'approved')
            .neq('id', resolvedOrgId)
            .limit(1)
            .maybeSingle();

          if (nextOrg?.id) {
            resolvedOrgId = nextOrg.id;
            orgStatus = nextOrg.status;
            orgPlan = nextOrg.plan ?? 'free';
            await (supabase as any)
              .from('profiles')
              .update({ org_id: nextOrg.id })
              .eq('id', sessionUser.id);
          } else {
            // No approved org — clear org context
            resolvedOrgId = null;
            orgStatus = null;
            orgPlan = null;
          }
        }
      } catch { /* ignore */ }
    }

    return {
      user: {
        id: sessionUser.id,
        email: sessionUser.email || '',
        name: (p as any)?.name || sessionUser.email?.split('@')[0] || 'User',
        role: ((p as any)?.role || 'client') as UserRole,
        avatar: (p as any)?.avatar_url,
        createdAt: sessionUser.created_at,
        ...((p as any)?.display_id ? { display_id: (p as any).display_id } : {}),
      } as any as User,
      orgId: resolvedOrgId,
      orgStatus,
      orgPlan,
      accountType,
      isPlatformOwner: (p as any)?.is_platform_owner === true,
    };
  } catch (err) {
    console.error('fetchProfile failed:', err);
    return null;
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]               = useState<User | null>(null);
  const [orgId, setOrgId]             = useState<string | null>(null);
  const [orgStatus, setOrgStatus]     = useState<string | null>(null);
  const [orgPlan, setOrgPlan]         = useState<string | null>(null);
  const [isPlatformOwner, setIsPlatformOwner] = useState(false);
  const [accountType, setAccountType] = useState<'user' | 'business'>('user');
  const [loading, setLoading]         = useState(true);

  const finalizingRef = useRef(false);

  const applyProfile = (result: NonNullable<Awaited<ReturnType<typeof fetchProfile>>>) => {
    setUser(result.user);
    setOrgId(result.orgId);
    setOrgStatus(result.orgStatus);
    setOrgPlan(result.orgPlan);
    setAccountType(result.accountType);
    setIsPlatformOwner(result.isPlatformOwner);
  };

  const clearAuth = () => {
    setUser(null);
    setOrgId(null);
    setOrgStatus(null);
    setOrgPlan(null);
    setAccountType('user');
    setIsPlatformOwner(false);
  };

  useEffect(() => {
    let mounted = true;

    // Absolute failsafe — 4s max
    const failsafe = setTimeout(() => {
      if (mounted) {
        console.warn('Auth failsafe fired');
        setLoading(false);
      }
    }, 4000);

    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;

        if (session?.user) {
          // Set minimal user immediately so loading=false doesn't show login screen
          setUser(minimalUser(session.user));
          // Enrich in background — don't block loading
          fetchProfile(session.user).then(result => {
            if (mounted && result) applyProfile(result);
          });
        } else {
          clearAuth();
        }
      } catch (err) {
        console.error('Auth init failed:', err);
        if (mounted) clearAuth();
      } finally {
        if (mounted) {
          clearTimeout(failsafe);
          setLoading(false);
        }
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === 'INITIAL_SESSION') return;

      if (session?.user) {
        // Set minimal user immediately — unblocks the UI right away
        setUser(minimalUser(session.user));
        setLoading(false);

        // Enrich profile in background
        fetchProfile(session.user).then(result => {
          if (mounted && result) applyProfile(result);
        });

        // Finalize pending account_type in background (signup flow)
        if (!finalizingRef.current && getPendingAccountType()) {
          finalizingRef.current = true;
          finalizeAccountType(session.user.id).finally(() => {
            finalizingRef.current = false;
            // Re-fetch profile after finalization so account_type is correct
            fetchProfile(session.user).then(result => {
              if (mounted && result) applyProfile(result);
            });
          });
        }
      } else {
        clearAuth();
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      clearTimeout(failsafe);
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    console.log('Login:', { userId: data?.user?.id, error: error?.message });
    if (error) return { success: false, error: error.message };
    return { success: true };
  };

  const signup = async (email: string, password: string, _type: 'user' | 'business' = 'user') => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) return { success: false, error: error.message };
    return { success: true };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    clearAuth();
    finalizingRef.current = false;
  };

  const refreshUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    const result = await fetchProfile(session.user);
    if (result) applyProfile(result);
  };

  const upgradeToBusinessAccount = async () => {
    if (!user) return;
    try {
      await (supabase as any)
        .from('profiles')
        .update({ account_type: 'business' })
        .eq('id', user.id);
    } catch (err) {
      console.error('upgradeToBusinessAccount failed:', err);
    }
    setAccountType('business');
  };

  return (
    <AuthContext.Provider value={{
      user, orgId, orgStatus, orgPlan, isPlatformOwner, accountType, loading,
      login, signup, logout, refreshUser, upgradeToBusinessAccount,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
