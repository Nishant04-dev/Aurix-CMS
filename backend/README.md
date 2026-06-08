# Aurix Backend

Production-ready Node.js + Express backend for the Aurix SaaS platform. Handles API serving, authentication, file processing, email delivery, and background job queues.

## Stack

- **Runtime**: Node.js 18+, ESM modules
- **Framework**: Express 4
- **Database**: Supabase (PostgreSQL + Auth)
- **Queue**: BullMQ (Redis) with in-memory fallback
- **Email**: Nodemailer (SMTP)
- **Validation**: Zod
- **Process Mgmt**: PM2

## Quick Start

```bash
cd backend
npm install
cp .env.example .env
# Fill in your Supabase credentials in .env
npm run dev
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start with file watching (development) |
| `npm start` | Start production server |
| `npm run worker` | Start BullMQ worker (Redis required) |

## Queue Architecture

The backend uses a dual-queue strategy:

- **BullMQ** (when `REDIS_ENABLED=true`) — persistent queues with retries
- **InMemoryQueue** (fallback) — fire-and-forget, no Redis required

Queues handle: projects, files, invitations, invoices, and notifications.

## Auth Middleware Stack

```
Request → authenticate (JWT) → rateLimiter → requireOrg → requirePermission → Controller
```

1. **authenticate** — Verifies JWT via Supabase, loads profile + membership
2. **rateLimiter** — 100 req/min general, 30 req/min writes
3. **requireOrg** — Ensures user belongs to an active organization
4. **requirePermission** — RBAC check against `role_permissions` table
5. **requireRole** — Quick role check (admin/super_admin)

## Project Structure

```
src/
├── config/           # Supabase client, Redis, access control matrix
├── controllers/      # Route handlers (thin — delegates to services)
├── middlewares/      # Auth, rate limiter, validation
├── queue/            # Queue definitions + worker process
├── routes/           # Express router (all endpoints)
├── services/         # Business logic (mail, permissions, plan limits)
├── utils/            # Logger, response helpers, audit logger
├── env.js            # Environment loader (must be first import)
├── index.js          # App entry point
└── server.js         # Server bootstrap
```

## Deployment

```
Nginx → Node (port 25569) → Supabase
```

For production, use `ecosystem.config.cjs` with PM2 and the provided `nginx.conf` for SSL termination.
