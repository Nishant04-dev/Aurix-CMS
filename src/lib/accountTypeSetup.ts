/**
 * Deferred account_type write after signup.
 *
 * The DB trigger that creates the profiles row is async — we can't update
 * it immediately after signUp(). Strategy:
 *  1. Store chosen type in localStorage before signUp()
 *  2. On next auth event (SIGNED_IN), AuthContext calls finalizeAccountType()
 *     which retries until the row exists, then writes and clears localStorage
 */

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
 * Retries until the profile row exists, writes account_type, clears localStorage.
 * Never throws — always resolves (may return null on failure).
 */
export async function finalizeAccountType(userId: string): Promise<'user' | 'business' | null> {
  const type = getPendingAccountType();
  if (!type) return null;

  console.log(`[setup] Finalizing account_type="${type}" for ${userId}`);

  for (let i = 1; i <= MAX_RETRIES; i++) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single();

      if (error || !data) {
        console.log(`[setup] Profile not ready (attempt ${i}/${MAX_RETRIES})`);
        await sleep(RETRY_DELAY_MS);
        continue;
      }

      const { error: updateErr } = await (supabase as any)
        .from('profiles')
        .update({ account_type: type })
        .eq('id', userId);

      if (updateErr) {
        console.warn(`[setup] Update failed (attempt ${i}):`, updateErr.message);
        await sleep(RETRY_DELAY_MS);
        continue;
      }

      console.log(`[setup] account_type="${type}" saved`);
      clearPendingAccountType();
      return type;
    } catch (err) {
      console.warn(`[setup] Exception (attempt ${i}):`, err);
      await sleep(RETRY_DELAY_MS);
    }
  }

  // Give up — don't leave stale localStorage
  console.error('[setup] Could not write account_type after retries');
  clearPendingAccountType();
  return null;
}
