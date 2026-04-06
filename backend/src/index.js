import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { logger } from './utils/logger.js';
import { serverError } from './utils/response.js';
import routes from './routes/index.js';

const app  = express();
const PORT = parseInt(process.env.PORT  || '25569');
const HOST = process.env.HOST || '0.0.0.0';

// ── Security headers ──────────────────────────────────────────
app.use(helmet());

// ── CORS ──────────────────────────────────────────────────────
const rawDomains = (process.env.ALLOWED_DOMAINS || 'localhost:8080').split(',').map(d => d.trim().toLowerCase());

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (curl, Postman, server-to-server, mobile)
    if (!origin) return cb(null, true);
    try {
      const url      = new URL(origin);
      const hostname = url.hostname.toLowerCase();
      const port     = url.port;
      const hostWithPort = port ? `${hostname}:${port}` : hostname;

      const allowed = rawDomains.some(d =>
        d === hostname || d === hostWithPort
      );
      if (allowed) return cb(null, true);
      logger.warn(`CORS blocked: ${origin}`);
      cb(new Error(`CORS: origin ${origin} not allowed`));
    } catch {
      cb(new Error(`CORS: invalid origin ${origin}`));
    }
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

// ── Diagnostic — confirms this code version is running ────────
app.get('/api/ping', (_req, res) => {
  res.json({
    success: true,
    message: 'Aurix backend is running',
    version: '2.0.0',
    routes: [
      'GET /api/profile',
      'GET /api/organizations',
      'GET /api/organizations/mine',
      'GET /api/projects',
      'GET /api/invoices',
    ],
    env: process.env.NODE_ENV || 'production',
    timestamp: new Date().toISOString(),
  });
});

// ── API routes ────────────────────────────────────────────────
app.use('/api', routes);

// ── 404 handler ───────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Route ${req.method} ${req.path} not found` });
});

// ── Global error handler ──────────────────────────────────────
app.use((err, _req, res, _next) => {
  logger.error('Unhandled error', { message: err.message });
  serverError(res, process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message);
});

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, HOST, () => {
  logger.info(`Aurix backend running on ${HOST}:${PORT} [${process.env.NODE_ENV || 'production'}]`);
});

export default app;
