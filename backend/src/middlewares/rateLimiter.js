import rateLimit from 'express-rate-limit';
import { tooManyRequests } from '../utils/response.js';

const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000');
const max      = parseInt(process.env.RATE_LIMIT_MAX || '100');

// Memory store only — no Redis dependency at startup
// Redis-backed store can be added later once Redis is confirmed available

export const rateLimiter = rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  handler: (_req, res) => tooManyRequests(res, `Rate limit: ${max} requests per ${windowMs / 1000}s`),
});

// Stricter limiter for write operations
export const writeLimiter = rateLimit({
  windowMs: 60000,
  max: 30,
  keyGenerator: (req) => `write:${req.user?.id || req.ip}`,
  handler: (_req, res) => tooManyRequests(res, 'Write rate limit exceeded. Max 30 writes/minute.'),
});
