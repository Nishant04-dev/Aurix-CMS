/**
 * Deferred account_type write after signup.
 *
 * Strategy:
 *  1. Store chosen type in localStorage before signUp()
 *  2. On next auth event (SIGNED_IN), AuthContext calls finalizeAccountType()
 *     which retries until the backend profile is ready, then writes and clears localStorage
 */

import { API_BASE } from '@/lib/apiUrl';
import { supabase } from '@/integrations/supabase/client';

const LS_KEY = 'pending_account_type';
const MAX_RETRIES = 6;
const RETRY_DELAY_MS = 500;

export function storePendingAccountType(type: 'user' | 'business') {
  localStorage.setItem(LS_KEY, type);
}

export function getPendingAccountType(): 'user' | 'business' | null {
  const v = localStorage.getItem(LS_KEY);
  return v === 'user' || v === 'business' ? v : null;
}

export function clearPendingAccountType() {
  localStorage.removeItem(LS_KEY);
}

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

/**
 * Called by AuthContext after SIGNED_IN.
 * Retries until the backend profile is ready, writes account_type, clears localStorage.
 */
export async function finalizeAccountType(userId: string): Promise<'user' | 'business' | null> {
  const type = getPendingAccountType();
  if (!type) return null;

  console.log(`[setup] Finalizing account_type="${type}" for ${userId}`);

  for (let i = 1; i <= MAX_RETRIES; i++) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { await sleep(RETRY_DELAY_MS); continue; }

      const res = await fetch(`${API_BASE}/api/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ account_type: type }),
      });

      if (res.status === 404 || res.status === 500) {
        console.log(`[setup] Profile not ready (attempt ${i}/${MAX_RETRIES})`);
        await sleep(RETRY_DELAY_MS);
        continue;
      }

      if (res.ok) {
        console.log(`[setup] account_type="${type}" saved`);
        clearPendingAccountType();
        return type;
      }

      await sleep(RETRY_DELAY_MS);
    } catch (err) {
      console.warn(`[setup] Exception (attempt ${i}):`, err);
      await sleep(RETRY_DELAY_MS);
    }
  }

  console.error('[setup] Could not write account_type after retries');
  clearPendingAccountType();
  return null;
}
