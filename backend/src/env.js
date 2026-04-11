/**
 * env.js — MUST be the first import in index.js
 * Loads .env using absolute path derived from this file's location.
 * Works regardless of PM2 cwd, symlinks, or how the process is launched.
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Try candidate paths in order — first one that exists wins
// src/env.js is at: <root>/src/env.js
// .env is at:       <root>/.env  (two levels up from src/)
const candidates = [
  path.resolve(__dirname, '../../.env'),   // backend/backend/src → backend/backend/.env
  path.resolve(__dirname, '../.env'),      // fallback: one level up
  path.resolve(process.cwd(), '.env'),     // fallback: cwd
];

const envPath = candidates.find(p => fs.existsSync(p));

if (envPath) {
  dotenv.config({ path: envPath });
  console.log('[env] Loaded .env from:', envPath);
} else {
  console.error('[env] ERROR: .env not found. Tried:', candidates);
}

console.log('[env] SUPABASE_URL:',              process.env.SUPABASE_URL              ? 'loaded' : 'MISSING');
console.log('[env] SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'loaded' : 'MISSING');
console.log('[env] NODE_ENV:',                  process.env.NODE_ENV  || 'not set');
console.log('[env] PORT:',                      process.env.PORT      || 'not set');
