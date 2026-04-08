import rateLimit from 'express-rate-limit';
import { tooManyRequests } from '../utils/response.js';

const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000');
const max      = parseInt(process.env.RATE_LIMIT_MAX || '100');

/**
 * Standard rate limiter — uses default IP-based key.
 * No custom keyGenerator to avoid IPv6 issues with express-rate-limit v7.
 */
export const rateLimiter = rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders:   false,
  handler: (_req, res) =>
    tooManyRequests(res, `Rate limit: ${max} requests per ${windowMs / 1000}s`),
});

/**
 * Stricter limiter for write operations (POST/PATCH/DELETE).
 */
export const writeLimiter = rateLimit({
  windowMs: 60_000,
  max:      30,
  standardHeaders: true,
  legacyHeaders:   false,
  handler: (_req, res) =>
    tooManyRequests(res, 'Write rate limit exceeded. Max 30 writes/minute.'),
});
