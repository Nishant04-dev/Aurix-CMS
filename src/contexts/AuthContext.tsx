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

// ── Minimal user from session only (used while backend loads) ─
function minimalUser(sessionUser: any): User {
  return {
    id: sessionUser.id,
    email: sessionUser.email || '',
    name: sessionUser.email?.split('@')[0] || 'User',
    role: 'loading' as UserRole,  // never show 'client' as fallback
    createdAt: sessionUser.created_at,
  } as any;
}

// ── Fetch full profile from backend API ───────────────────────
async function fetchProfileFromBackend(token: string) {
  if (!token) {
    console.warn('fetchProfileFromBackend: no token provided');
    return null;
  }
  console.log('[auth] fetching profile from', `${API_BASE}/api/profile`, '— token:', token.slice(0, 20) + '...');
  try {
    const res = await fetch(`${API_BASE}/api/profile`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    console.log('[auth] profile response status:', res.status);
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.success || !json.data) return null;
    const p = json.data;

    // Block banned/disabled accounts
    if (p.status === 'banned' || p.status === 'disabled') {
      await supabase.auth.signOut();
      return null;
    }

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

    // Platform owner: always treat org as approved even if fetch failed
    if (p.is_platform_owner && p.org_id && !orgStatus) {
      orgStatus = 'approved';
      orgPlan   = orgPlan ?? 'enterprise';
    }

    const accountType: 'user' | 'business' =
      p.account_type === 'business' || p.account_type === 'user'
        ? p.account_type
        : p.org_id ? 'business' : 'user';

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
  } catch (err) {
    console.error('fetchProfileFromBackend failed:', err);
    return null;
  }
}

// ── Provider ──────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]               = useState<User | null>(null);
  const [orgId, setOrgId]             = useState<string | null>(null);
  const [orgStatus, setOrgStatus]     = useState<string | null>(null);
  const [orgPlan, setOrgPlan]         = useState<string | null>(null);
  const [isPlatformOwner, setIsPlatformOwner] = useState(false);
  const [accountType, setAccountType] = useState<'user' | 'business'>('user');
  const [loading, setLoading]         = useState(true);

  const finalizingRef = useRef(false);

  const applyProfile = (result: NonNullable<Awaited<ReturnType<typeof fetchProfileFromBackend>>>) => {
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

    const failsafe = setTimeout(() => {
      if (mounted) { console.warn('Auth failsafe fired — backend may be unreachable'); setLoading(false); }
    }, 10000); // 10s — enough time for remote backend to respond

    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;

        if (session?.access_token) {
          setUser(minimalUser(session.user));
          // Fetch real profile — token is guaranteed present
          const result = await fetchProfileFromBackend(session.access_token);
          if (mounted && result) {
            applyProfile(result);
          } else if (mounted) {
            // Backend unreachable or returned error — clear so user sees login
            clearAuth();
          }
        } else {
          clearAuth();
        }
      } catch (err) {
        console.error('Auth init failed:', err);
        if (mounted) clearAuth();
      } finally {
        if (mounted) { clearTimeout(failsafe); setLoading(false); }
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === 'INITIAL_SESSION') return;

      if (session?.access_token) {
        setUser(minimalUser(session.user));
        // Don't set loading=false yet — wait for real profile
        fetchProfileFromBackend(session.access_token).then(result => {
          if (!mounted) return;
          if (result) applyProfile(result);
          setLoading(false);
        });

        if (!finalizingRef.current && getPendingAccountType()) {
          finalizingRef.current = true;
          finalizeAccountType(session.user.id).finally(() => {
            finalizingRef.current = false;
            fetchProfileFromBackend(session.access_token).then(result => {
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
    const result = await fetchProfileFromBackend(session.access_token);
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
