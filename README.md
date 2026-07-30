
# ReachInbox — Full-stack Email Job Scheduler

A production-shaped email scheduler + dashboard built for the ReachInbox
hiring assignment: schedule cold emails via API, send them at the right time
using **BullMQ delayed jobs** (no cron), survive restarts, and enforce
per-sender rate limits under load.

## Monorepo layout

```
reachinbox/
  backend/    Express + TypeScript API, BullMQ worker, Prisma/Postgres
  frontend/   React + TypeScript + Tailwind dashboard
  docker-compose.yml   Redis + Postgres for local dev
```

---

## 1. Prerequisites

- Node.js 18+
- Docker (recommended, for Redis + Postgres) — or your own local instances
- A Google Cloud OAuth 2.0 Client ID (for login)
- One or two Ethereal test accounts (fake SMTP) — create free at
  https://ethereal.email/create

## 2. Running it

### Start infra

```bash
cd reachinbox
docker compose up -d
```

This starts Postgres on `5432` and Redis on `6379` (Redis runs with
`--appendonly yes`, so queued jobs survive a container restart too).

### Backend

```bash
cd backend
cp .env.example .env
# fill in GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / ETHEREAL_* values
npm install
npm run prisma:migrate     # creates tables
npm run dev                # starts the API on :4000
```

In a **second terminal**, start the worker (a separate process from the API,
by design — see architecture below):

```bash
npm run worker
```

### Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev                # starts on :5173
```

Once a sender is registered (see below), open http://localhost:5173, log in
with Google, and use **Compose New Email**.

### Registering a sender (Ethereal account)

Scheduling requires at least one `Sender` row (an Ethereal SMTP identity).
After logging in once (so a `User` row exists), register a sender:

```bash
curl -X POST http://localhost:4000/api/senders \
  -H "Content-Type: application/json" \
  -b "token=<cookie from browser devtools after login>" \
  -d '{"label":"Primary","smtpUser":"<ethereal user>","smtpPass":"<ethereal pass>","maxPerHour":200}'
```

(In a real product this would be a "Connect sender" UI flow; kept as a
one-time API call here to stay within scope — see Assumptions.)

### Setting up Ethereal Email

1. Go to https://ethereal.email/create and generate a free test SMTP
   account (no signup needed).
2. Copy the generated `user` / `pass` into `ETHEREAL_USER_1` /
   `ETHEREAL_PASS_1` in `backend/.env`, and/or register them as a `Sender`
   via the API above.
3. Every send returns an Ethereal **preview URL** (logged server-side and
   returned from `sendEmail()`) — open it to see the rendered email, since
   Ethereal never actually delivers mail.

---

## 3. Architecture overview

### How scheduling works (no cron)

- `POST /api/schedule` accepts subject/body/CSV of leads + timing config.
- For each recipient, a `ScheduledEmail` row is created in Postgres, and a
  **BullMQ delayed job** is added to a single Redis-backed queue
  (`email-send-queue`) with `delay = scheduledFor - now` and a **deterministic
  `jobId` equal to the DB row's id**.
- BullMQ's own delayed-job mechanism (a Redis sorted set scored by ready
  time) is what "wakes up" the job at the right time — there is no
  `setInterval`/cron polling anywhere in this codebase.
- The deterministic `jobId` is the idempotency guarantee: adding the same
  job twice (e.g. a retried request, or the reconciliation pass below) is a
  no-op in BullMQ, so an email can never be double-queued.

### How persistence on restart is handled

- Redis is the source of truth for *when* a job fires, and Redis is a
  separate long-lived process/container from the Node API and worker.
  Restarting the Express server or the worker process does **not** touch
  the jobs sitting in Redis — they fire exactly on schedule regardless.
- Redis itself is started with `--appendonly yes` (AOF persistence), so even
  a Redis container restart replays the log and the jobs are still there.
- As a belt-and-suspenders safety net for the edge case where Redis data
  *is* lost (e.g. a fresh Redis with no AOF), the API server runs
  `reconcilePendingJobs()` on boot: it scans for `ScheduledEmail` rows still
  marked `SCHEDULED` with no live BullMQ job behind them, and re-enqueues
  them with the same deterministic `jobId` — so this can run any number of
  times without ever creating a duplicate job.
- The worker also checks the DB row's status before sending
  (`row.status === SENT` → skip), a second idempotency layer in case a job
  ever got re-queued while already in flight.

### How rate limiting & concurrency are implemented

Three independent knobs, all configurable via env/request, none of them a
cron job:

1. **Worker concurrency** — `Worker(..., { concurrency: WORKER_CONCURRENCY })`
   bounds how many jobs this worker processes in parallel.
2. **Minimum delay between sends** — implemented via BullMQ's built-in
   `limiter: { max: 1, duration: DEFAULT_MIN_DELAY_MS }` on the worker. This
   throttles how fast the worker *pulls new jobs off the queue*, which
   naturally spaces out sends without any `sleep()`/`setTimeout` calls in
   the job body. (The per-batch "delay between emails" field from the
   compose form is additionally baked into each email's initial
   `scheduledFor` time, spacing them out sender-by-sender at schedule time.)
3. **Emails per hour, per sender** — enforced with a **Redis counter**
   (`services/rateLimiter.ts`), keyed by `rate:{senderId}:{hourWindowStartEpoch}`.
   `INCR` is atomic in Redis, so this is safe even with multiple worker
   processes/instances reading the *same* Redis — it is not an in-memory
   count, and horizontal scaling of workers doesn't break the limit. When a
   job would exceed the sender's `maxPerHour`, the reservation is released
   (`DECR`) and the job is **rescheduled** into the next hour boundary
   (`status = RESCHEDULED`, new delayed job added) rather than dropped or
   permanently failed — this is what the "Behavior Under Load" requirement
   asks for.

### Behavior under load (1000+ emails at once)

- All 1000+ `ScheduledEmail` rows + BullMQ jobs are created up front
  (batched, sequential DB inserts — could be parallelized/bulk-inserted for
  even higher throughput, see Trade-offs).
- Recipients are distributed round-robin across the user's configured
  senders, and each sender's own send-time lane is spaced out by `delayMs`,
  so BullMQ naturally staggers delivery instead of firing 1000 jobs at
  once.
- Even if many jobs *do* become ready simultaneously, `concurrency` bounds
  how many run in parallel, the `limiter` bounds how fast new ones start,
  and the per-sender Redis counter catches anything that would still blow
  through the hourly cap — pushing the excess to the next hour window
  automatically.

---

## 4. Features implemented

**Backend**
- [x] Email scheduling API (`POST /api/schedule`, CSV/TXT upload or JSON list)
- [x] BullMQ delayed jobs (no cron) backed by Redis
- [x] Postgres persistence via Prisma (`User`, `Sender`, `EmailBatch`, `ScheduledEmail`)
- [x] Multi-sender support via Ethereal SMTP
- [x] Restart-safe: jobs live in Redis independent of app process; startup reconciliation pass for extra safety
- [x] Idempotent job IDs (`jobId = ScheduledEmail.id`) + DB status guard in the worker
- [x] Configurable worker concurrency (`WORKER_CONCURRENCY`)
- [x] Configurable minimum delay between sends (BullMQ limiter)
- [x] Configurable, Redis-backed, per-sender hourly rate limiting with reschedule-not-drop behavior
- [x] Google OAuth login (Passport + JWT cookie session)

**Frontend**
- [x] Google login → redirect to dashboard
- [x] Header with name / email / avatar / logout
- [x] Scheduled Emails & Sent Emails tabs
- [x] Compose modal: subject, body, CSV upload with live "N emails detected" count, start time, delay, hourly limit
- [x] Tables with loading skeletons and empty states
- [x] TypeScript types for all API responses/props, reusable components (Header, Tabs, tables, modal, status badge, empty/loading states)
- [x] Polling every 10s so dashboard reflects worker progress live

---

## 5. Assumptions, shortcuts & trade-offs

- **Sender registration** is a raw API call rather than a full "Connect
  Ethereal account" UI screen — the Figma wasn't accessible in this
  environment, so the compose flow and dashboard were built from the
  written spec instead of the linked mockup; sender management was kept
  minimal to stay in scope.
- **Bulk inserts**: `scheduleBatch()` creates rows and jobs in a loop for
  clarity/readability. For very large batches (10k+) this should switch to
  `createMany` + `Queue.addBulk` to cut round-trips.
- **Single Redis instance**: rate-limit counters and the BullMQ queue share
  one Redis. At very large scale you'd likely separate these concerns, but
  correctness (atomic `INCR`) holds either way.
- **JWT-in-cookie** auth instead of server-side sessions, for simplicity —
  no session store required, works fine for this scope.
- **CSV parsing** accepts email addresses from any column/line position
  (not a strict fixed-schema CSV), to be forgiving of real lead-list
  formats.
- Email `body` is treated as raw HTML — no template/merge-tag engine
  (e.g. `{{firstName}}`) was built, since it wasn't in the required spec.
#
