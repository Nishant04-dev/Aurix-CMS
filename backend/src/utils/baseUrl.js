/**
 * Returns the base URL of the current request.
 * Falls back to APP_URL env var, then localhost.
 * Used for invite links, email redirects, etc.
 */
export function getBaseUrl(req) {
  if (req) {
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const host  = req.headers['x-forwarded-host']  || req.get('host') || 'localhost:25569';
    return `${proto}://${host}`;
  }
  return process.env.APP_URL || 'http://localhost:8080';
}
