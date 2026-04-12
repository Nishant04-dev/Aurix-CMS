/**
 * Global date formatter — single source of truth.
 * Input: ISO string (YYYY-MM-DD or full ISO)
 * Output: "13 Apr 2026" (en-IN, no US format)
 */
export function formatDate(date?: string | null): string {
  if (!date) return '—';
  try {
    // Parse YYYY-MM-DD safely without timezone shift
    const d = date.includes('T') ? new Date(date) : new Date(`${date}T00:00:00`);
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
