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

### Copy the game catalog from production

Copy only the non-personal game catalog and its compressed screenshots. Auth users,
profiles, forecasts, points, role assignments, and simulation data remain isolated.

```powershell
$env:SOURCE_SUPABASE_URL='https://<production-project>.supabase.co'
$env:SOURCE_SUPABASE_SECRET_KEY='<production-secret-key>'
$env:TARGET_SUPABASE_URL='https://<staging-project>.supabase.co'
$env:TARGET_SUPABASE_SECRET_KEY='<staging-secret-key>'
pnpm --filter database steam:copy-catalog
```

The command is safe to rerun: it upserts `steam_games`, copies the
`steam-game-media` objects, upserts their metadata, and verifies the resulting
game, Popular Upcoming, and media counts.

## Access model

- Every verified Supabase Auth user starts as `user`.
- A `game_designer` can access `/internal/game-master`.
- A root administrator is derived only from `ROOT_ADMIN_EMAILS`; `root` is not a database enum value and cannot be granted, stored, or revoked through the UI.
- Root opens `/internal/staging-admin` to search Auth users, grant/revoke `game_designer`, create or revoke pending email assignments, and inspect the append-only audit trail.
- A pending assignment is claimed automatically after the matching email becomes verified.
- Every protected request rechecks the database role. Revocation therefore applies on the next request without waiting for a token refresh.
- Denied access attempts are appended to the role audit log.

## Running gameplay staging

`/internal/game-master` is the normal NextHit Market product UI backed by an isolated, persistent staging workspace. It has no production side effects.

1. Open the artificial-user menu below the profile icon. Add, delete, or switch the active player there.
2. Enter forecasts in the normal game cards. The active artificial player owns those forecasts.
3. Use the blue handle to the right of any forecast field to open **Game manipulation**. It can submit a value for any existing artificial player or create a randomized batch in a chosen range. Every batch forecast gets its own artificial player, so repeated batches are unbounded.
4. Use **Resolve** in the small panel to the right of a game card. All three markets receive a final snapshot, lock, resolve, and score. The game leaves Trending/Popular upcoming, appears under Completed, and the staging leaderboard is recalculated.
5. Use Trending, Popular upcoming, Completed, My forecasts, and search exactly as in the product UI. The header Bets and Points values always belong to the currently selected artificial player.

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

The browser release checklist is: unauthenticated redirect, verified root login, add/switch/delete an artificial player, submit forecasts for at least two players, create a randomized batch, resolve a game, verify it moved to Completed, verify leaderboard movement, role grant, role revoke, immediate denied access, and `X-Robots-Tag: noindex, nofollow` on internal APIs.

## Deployment

Deploy the web app as its own staging project and the database as its own Supabase project or persistent branch. Add both staging callback URLs to Supabase Auth and Google OAuth. Route `staging.nexthitmarket.com` and `admin.staging.nexthitmarket.com` to the staging web deployment; the admin hostname redirects its root to `/internal/staging-admin`.

Never attach the production hostname to this deployment, copy production service keys into it, enable production cron jobs, or reuse production Auth users. Backups and cleanup are independent from production.
