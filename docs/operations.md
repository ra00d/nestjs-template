# Operations

Runbook for local development and first deploys. User-facing setup stays in
`README.md`; this is the operator's sheet.

## Prerequisites

- Node 24, Corepack (`corepack enable` — installs the pinned pnpm from
  `packageManager` in `package.json`).
- Docker + Compose plugin for the infrastructured path.

## Path A: everything in Docker (recommended first run)

```bash
cp .env.example .env   # then set JWT/SESSION secrets (32+ chars)
docker compose up --build
```

This starts Postgres 17, Redis 7, Mailpit (SMTP `:1025`, UI `:8025`) and
the API on `:3000`. Compose overrides `DATABASE_URL`/`REDIS_URL` to the
service names; everything else comes from `.env`.

## Path B: infrastructure in Docker, API on the host

```bash
docker compose up db redis mail   # Postgres :5432, Redis :6379, Mailpit :8025
pnpm install
pnpm db:generate && pnpm db:migrate   # create tables (incl. audit_logs)
pnpm db:seed                          # no-op unless ADMIN_EMAIL/ADMIN_PASSWORD are set
pnpm start:dev
```

With Mailpit running, point the API at it to receive real mail locally:

```bash
SMTP_URL=smtp://localhost:1025
```

Open http://localhost:8025 for the inbox, http://localhost:3000/docs for
the API reference.

## Environment

All variables are validated at boot (`src/config/env.ts`) — a missing or
malformed value stops the app before the first request. Start from
`.env.example`; secrets need 32+ random characters:

```bash
pnpm dlx --yes openssl rand -base64 32
```

Key behavior flags:

| Variable | Default | Effect |
| --- | --- | --- |
| `DB_MIGRATE_ON_BOOT` | `false` | Run Drizzle migrations inside the app. Prefer `pnpm db:migrate` in production. |
| `API_PREFIX` | `api` | Routes live at `/api/v1/…`; `/`, `/health`, `/docs` stay outside. |
| `LOG_LEVEL` | `info` | `fatal,error,warn,info,debug,trace,silent`. |
| `STORAGE_DRIVER` | `local` | `local` (`STORAGE_DIR`) or `s3` (needs `S3_BUCKET`). |
| `UPLOAD_MAX_AGE_DAYS` | `7` | Nightly task deletes older staged uploads. |

## Probes and logs

- `GET /` — liveness, version-neutral, no auth, raw `Hello World!`.
- `GET /health` — readiness (heap + `SELECT 1` + Redis round-trip);
  `200` healthy, `503` degraded. Excluded from request logging.
- Every response carries `x-request-id` (echoed when sent); logs are JSON
  in production, pretty in development.

## Seeding and migrations

```bash
pnpm db:generate   # Drizzle diff of src/db-schema.ts -> ./drizzle
pnpm db:migrate    # apply (or DB_MIGRATE_ON_BOOT=true for ephemeral envs)
ADMIN_EMAIL=a@b.co ADMIN_PASSWORD=… pnpm db:seed   # idempotent admin
```

## Production notes

- Terminate TLS at the load balancer; only `APP_URL` + `TRUSTED_ORIGINS`
  may send cookie writes (CSRF + CORS enforce this).
- Rate limits are shared in Redis (`KeyvThrottlerStorage`), so any replica
  count enforces one quota.
- The image is non-root, ships without devDependencies, and healthchecks
  `/`. The audit trail is append-only — age out old rows with a scheduled
  `DELETE FROM audit_logs WHERE created_at < …`, never from app code.
- Still missing (deliberately deferred): CI workflow, BullMQ workers,
  S3 presigned-upload HTTP endpoints, metrics dashboards.
