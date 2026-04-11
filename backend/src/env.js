/**
 * env.js — must be the FIRST import in index.js
 * Loads .env relative to this file's location so it works
 * regardless of PM2 cwd or how the process is launched.
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// src/env.js → ../../.env resolves to backend/.env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

console.log('ENV CHECK:', {
  SUPABASE_URL:              process.env.SUPABASE_URL              ? 'loaded' : 'MISSING',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'loaded' : 'MISSING',
  NODE_ENV:                  process.env.NODE_ENV  || 'not set',
  PORT:                      process.env.PORT      || 'not set',
});
