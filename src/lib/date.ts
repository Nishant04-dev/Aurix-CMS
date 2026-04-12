/**
 * Global date formatter — single source of truth.
 * Input: ISO string (YYYY-MM-DD or full ISO)
 * Output: "13 Apr 2026" (en-IN, no US format, timezone-safe)
 */
export function formatDate(date?: string | null): string {
  if (!date) return '—';
  try {
    // Strip to YYYY-MM-DD then append T00:00:00 to avoid UTC-to-local shift
    const iso = date.length > 10 ? date.slice(0, 10) : date;
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('en-IN', {
      day:   '2-digit',
      month: 'short',
      year:  'numeric',
    }).format(d);
  } catch {
    return '—';
  }
}
