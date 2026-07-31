# NextHit staging, Game Master, and role administration

## Environment boundary

The sandbox is a separate deployment backed by a separate Supabase instance. Never point it at the production project (`azysnjlxrrvnkzntslqz`). The production site must keep both staging feature flags disabled.

Required staging environment:

```dotenv
APP_ENV=staging
NEXT_PUBLIC_SITE_URL=https://staging.nexthitmarket.com
NEXT_PUBLIC_SUPABASE_URL=https://<staging-project>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<staging-publishable-key>
SUPABASE_SECRET_KEY=<staging-secret-key>
ENABLE_GAME_MASTER_CONSOLE=true
ENABLE_STAGING_ROLE_ADMIN=true
ROOT_ADMIN_EMAILS=<verified-owner-email>
STAGING_ALLOWED_HOSTS=staging.nexthitmarket.com,admin.staging.nexthitmarket.com
```

`SUPABASE_SECRET_KEY` and root emails are server-only. Do not prefix either with `NEXT_PUBLIC_`. Staging email, analytics, outbound webhooks, and production jobs are disabled. The production build rejects staging flags, and the staging build rejects the production Supabase host and production website hostname.

## Local setup

1. From the repository root run `pnpm i`.
2. Start the isolated stack with `pnpm --filter staging-database start`.
3. Reset it with `pnpm --filter staging-database db:reset`.
4. Read the local URL and keys with `pnpm --filter staging-database status` and put them in `.env.staging.local` using `.env.staging.example` as the template.
5. For local production-build QA only set `ALLOW_LOCAL_STAGING_BUILD=true`. Never set it remotely.
6. Start the web app with the staging environment loaded.

The staging database composes the production declarative schema with `apps/staging-database/supabase/schemas/staging.sql`. The generated base-schema copies are ignored. Schema edits belong in declarative SQL; generate migrations from `apps/staging-database` with `pnpm db:diff -- -f <name>`.

## Access model

- Every verified Supabase Auth user starts as `user`.
- A `game_designer` can access `/internal/game-master`.
- A root administrator is derived only from `ROOT_ADMIN_EMAILS`; `root` is not a database enum value and cannot be granted, stored, or revoked through the UI.
- Root opens `/internal/staging-admin` to search Auth users, grant/revoke `game_designer`, create or revoke pending email assignments, and inspect the append-only audit trail.
- A pending assignment is claimed automatically after the matching email becomes verified.
- Every protected request rechecks the database role. Revocation therefore applies on the next request without waiting for a token refresh.
- Denied access attempts are appended to the role audit log.

## Running a simulation

1. Open `/internal/game-master` and create one of the ten deterministic presets with a seed.
2. Use **Run/Pause**, `+1 hour`, `+1 day`, `+7 days`, or **Next event**. Time is isolated per simulation and only moves forward.
3. Generate synthetic players and forecast batches. Synthetic players never become Auth users.
4. Create a game with its three standard markets, or add an individual market. Submit a manual forecast from the Players tab when an exact edge case is needed.
5. Lock a market manually or advance past its lock time. Run snapshots manually or let clock advancement create crossed-midnight snapshots.
6. Resolve a locked market. A correction creates a new result and score-run version; previous versions remain immutable. Void requires a reason.
7. Inspect the canonical leave-one-out result in **Leaderboard** and **Score Inspector**. Formula Comparison is read-only and never changes canonical points.
8. Add an external signal to record a scenario event without calling any real external service.
9. Save checkpoints, restore or clone any selected checkpoint, or clone the exact current state. Export/import uses `nexthit-simulation-v1` JSON with all identifiers safely remapped; the downloadable JSON also includes the immutable event log, checkpoint manifest, and leaderboard. Separate CSV downloads cover forecasts, snapshots, score entries, and the canonical leaderboard.
10. Player Preview creates only a bannered, read-only product preview context. It cannot impersonate a real Auth user.

## Required release verification

Run all of these before staging deployment:

```powershell
pnpm --filter staging-database db:reset
pnpm --filter staging-database test
pnpm --filter web lint
pnpm --filter web typecheck
pnpm --filter web test
pnpm --filter web build
```

Also run the environment-gated integration test against the isolated local Supabase instance:

```powershell
$env:RUN_STAGING_INTEGRATION='true'
pnpm --filter web exec vitest run --root src src/lib/staging/simulation-service.integration.test.ts
```

The browser release checklist is: unauthenticated redirect, verified root login, create a preset, advance time, inspect forecasts/snapshots, lock and resolve, inspect leaderboard and Score Inspector, correct the result, clone, export/import, role grant, role revoke, immediate denied access, and `X-Robots-Tag: noindex, nofollow` on internal APIs.

## Deployment

Deploy the web app as its own staging project and the database as its own Supabase project or persistent branch. Add both staging callback URLs to Supabase Auth and Google OAuth. Route `staging.nexthitmarket.com` and `admin.staging.nexthitmarket.com` to the staging web deployment; the admin hostname redirects its root to `/internal/staging-admin`.

Never attach the production hostname to this deployment, copy production service keys into it, enable production cron jobs, or reuse production Auth users. Backups and cleanup are independent from production.
