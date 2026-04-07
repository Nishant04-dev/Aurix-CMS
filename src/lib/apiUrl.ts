/**
 * Returns the backend API base URL.
 *
 * Resolution order:
 * 1. window.__AURIX_API_URL__ — runtime override injected by hosting (index.html meta or env script)
 * 2. VITE_API_URL — baked in at build time via .env.production
 * 3. window.location.origin — same-origin fallback (only works if backend is on same host)
 *
 * IMPORTANT: app.aurixcloud.in is HTTPS. The backend must also be HTTPS (or same origin)
 * to avoid mixed-content blocks. Use a reverse proxy (nginx) with SSL for production.
 */
export const API_BASE: string =
  (typeof window !== 'undefined' && (window as any).__AURIX_API_URL__) ||
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:25569');
