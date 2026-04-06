# Aurix Backend

Production-ready Node.js backend for the Aurix SaaS platform.

## Setup

```bash
cd backend
npm install
cp .env.example .env
# Fill in your values in .env
```

## Run

```bash
# Development (API server)
npm run dev

# Production
npm start

# Workers (separate process)
npm run worker
```

## Architecture

```
Frontend → POST /api/projects/create
         → Auth middleware (verify JWT)
         → Rate limiter (Redis)
         → Permission check (plan limits)
         → Push to BullMQ queue
         → Return { jobId }

Worker   → Picks up job
         → Validates again
         → Writes to Supabase
         → Sends notification
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET  | /api/projects | List projects |
| POST | /api/projects/create | Create project (queued) |
| POST | /api/files/register | Register uploaded file |
| DELETE | /api/files/:id | Delete file (queued) |
| GET  | /api/invitations | My invitations |
| POST | /api/invitations/send | Send invite by AURIX ID |
| POST | /api/invitations/respond | Accept/reject invite |
| GET  | /api/invoices | List invoices |
| POST | /api/invoices/create | Create invoice (queued) |

## Security

- JWT verified server-side via Supabase
- Service role key never exposed to frontend
- Rate limiting: 100 req/min general, 30 req/min writes
- All org_id validated server-side
- Plan limits enforced before queue insertion
