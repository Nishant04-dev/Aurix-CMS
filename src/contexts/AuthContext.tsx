import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { User, UserRole } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { finalizeAccountType, getPendingAccountType } from '@/lib/accountTypeSetup';
import { API_BASE } from '@/lib/apiUrl';

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

// ── Fetch full profile — always sends token, never falls back to 'client' ──
async function fetchProfile(token: string) {
  if (!token) {
    console.warn('[auth] fetchProfile called with no token');
    return null;
  }

  console.log('[auth] GET /api/profile →', API_BASE, '| token:', token.slice(0, 15) + '...');

  try {
    const res = await fetch(`${API_BASE}/api/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    console.log('[auth] /api/profile status:', res.status);

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('[auth] /api/profile error body:', text);
      return null;
    }

    const json = await res.json();
    if (!json.success || !json.data) {
      console.error('[auth] /api/profile bad response:', json);
      return null;
    }

    const p = json.data;
    console.log('[auth] profile loaded:', { role: p.role, org_id: p.org_id, is_platform_owner: p.is_platform_owner });

    if (p.status === 'banned' || p.status === 'disabled') {
      await supabase.auth.signOut();
      return null;
    }

    // Fetch org details
    let orgStatus: string | null = null;
    let orgPlan: string | null = null;

    if (p.org_id) {
      try {
        const orgRes = await fetch(`${API_BASE}/api/organizations`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (orgRes.ok) {
          const orgJson = await orgRes.json();
          if (orgJson.success && orgJson.data) {
            orgStatus = orgJson.data.status ?? null;
            orgPlan   = orgJson.data.plan   ?? 'free';
          }
        }
      } catch { /* non-fatal */ }
    }

    // Platform owner always gets approved status
    if (p.is_platform_owner) {
      orgStatus = orgStatus ?? 'approved';
      orgPlan   = orgPlan   ?? 'enterprise';
    }

    const accountType: 'user' | 'business' =
      p.account_type === 'business' ? 'business' :
      p.account_type === 'user'     ? 'user' :
      p.org_id                      ? 'business' : 'user';

    return {
      user: {
        id:        p.id,
        email:     p.email || '',
        name:      p.name  || p.email?.split('@')[0] || 'User',
        role:      (p.role || 'client') as UserRole,
        avatar:    p.avatar_url,
        createdAt: p.created_at,
        ...(p.display_id ? { display_id: p.display_id } : {}),
      } as any as User,
      orgId:          p.org_id ?? null,
      orgStatus,
      orgPlan,
      accountType,
      isPlatformOwner: p.is_platform_owner === true,
    };
  } catch (err: any) {
    console.error('[auth] fetchProfile exception:', err.message);
    return null;
  }
}

// ── Provider ──────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,            setUser]            = useState<User | null>(null);
  const [orgId,           setOrgId]           = useState<string | null>(null);
  const [orgStatus,       setOrgStatus]       = useState<string | null>(null);
  const [orgPlan,         setOrgPlan]         = useState<string | null>(null);
  const [isPlatformOwner, setIsPlatformOwner] = useState(false);
  const [accountType,     setAccountType]     = useState<'user' | 'business'>('user');
  const [loading,         setLoading]         = useState(true);

  const finalizingRef = useRef(false);

  const applyProfile = (r: NonNullable<Awaited<ReturnType<typeof fetchProfile>>>) => {
    setUser(r.user);
    setOrgId(r.orgId);
    setOrgStatus(r.orgStatus);
    setOrgPlan(r.orgPlan);
    setAccountType(r.accountType);
    setIsPlatformOwner(r.isPlatformOwner);
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

    // ── Single entry point: wait for Supabase to give us a session ──
    // onAuthStateChange fires INITIAL_SESSION synchronously with the
    // persisted session — we use that as our single source of truth.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        console.log('[auth] event:', event, '| has token:', !!session?.access_token);

        if (session?.access_token) {
          // Fetch real profile with the token we have right now
          const result = await fetchProfile(session.access_token);

          if (!mounted) return;

          if (result) {
            applyProfile(result);
          } else {
            // Backend unreachable — show minimal user but DO NOT set role
            // This prevents "Client" flash. User will see their email only.
            setUser({
              id:        session.user.id,
              email:     session.user.email || '',
              name:      session.user.email?.split('@')[0] || 'User',
              role:      'unknown' as UserRole,
              createdAt: session.user.created_at,
            } as any);
          }

          // Finalize account type after signup if needed
          if (!finalizingRef.current && getPendingAccountType()) {
            finalizingRef.current = true;
            finalizeAccountType(session.user.id).finally(async () => {
              finalizingRef.current = false;
              const r2 = await fetchProfile(session.access_token);
              if (mounted && r2) applyProfile(r2);
            });
          }
        } else {
          clearAuth();
        }

        // Always stop loading after first event
        if (mounted) setLoading(false);
      }
    );

    // Failsafe: if onAuthStateChange never fires (shouldn't happen)
    const failsafe = setTimeout(() => {
      if (mounted && loading) {
        console.warn('[auth] failsafe — no auth event received');
        setLoading(false);
      }
    }, 8000);

    return () => {
      mounted = false;
      clearTimeout(failsafe);
      subscription.unsubscribe();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
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
    if (!session?.access_token) return;
    const result = await fetchProfile(session.access_token);
    if (result) applyProfile(result);
  };

  const upgradeToBusinessAccount = async () => {
    if (!user) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        await fetch(`${API_BASE}/api/profile`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ account_type: 'business' }),
        });
      }
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
