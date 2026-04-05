/**
 * Returns the backend API base URL.
 *
 * Priority:
 * 1. VITE_API_URL env var (set at build time for production)
 * 2. window.location.origin — works on any domain automatically
 *
 * For production where the backend is on a separate server (port 25569),
 * set VITE_API_URL=https://api.aurixdevelopment.in in your .env.production
 */
export const API_BASE =
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8080');
