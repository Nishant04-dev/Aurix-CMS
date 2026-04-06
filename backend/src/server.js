import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { logger } from './utils/logger.js';
import { serverError } from './utils/response.js';
import routes from './routes/index.js';

const app  = express();
const PORT = parseInt(process.env.PORT || '25569');
const HOST = process.env.HOST || '0.0.0.0';

// ── Security headers ──────────────────────────────────────────
app.use(helmet());

// ── CORS ──────────────────────────────────────────────────────
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:8080').split(',').map(o => o.trim());
app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Body parsing ──────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── HTTP logging ──────────────────────────────────────────────
app.use(morgan('combined', {
  stream: { write: (msg) => logger.http(msg.trim()) },
}));

// ── Health check ──────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// ── Test route ────────────────────────────────────────────────
app.get('/api/test', (_req, res) => {
  res.json({ success: true, message: 'Aurix backend is running', env: process.env.NODE_ENV });
});

// ── API routes ────────────────────────────────────────────────
app.use('/api', routes);

// ── 404 handler ───────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Route ${req.method} ${req.path} not found` });
});

// ── Global error handler ──────────────────────────────────────
app.use((err, req, res, _next) => {
  logger.error('Unhandled error', { err: err.message, stack: err.stack });
  serverError(res, process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message);
});

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, HOST, () => {
  logger.info(`Aurix backend running on ${HOST}:${PORT} [${process.env.NODE_ENV || 'development'}]`);
});

export default app;
