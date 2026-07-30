# NextHit Market

NextHit Market is a desktop-first forecasting platform for upcoming Steam games. Users predict launch performance, review totals, and pricing, then compare their forecasts as results become available.

NextHit Market does **not** support real money, cash-equivalent prizes, cryptocurrency, wallets, deposits, withdrawals, blockchain infrastructure, or user-uploaded avatars.

## What is included

- Email/password registration, email confirmation, login, logout, magic links, and password recovery
- Public Steam-title markets with fixed-price binary quotes
- Atomic prediction placement and one-time market resolution
- Immutable coin ledger plus server-controlled balance and statistics
- Public profiles with eight platform avatars, a short bio, and selected links
- Personal prediction history and potential/settled payouts
- Coin and accuracy leaderboards
- Admin-only market resolution console
- Supabase migrations, RLS policies, pgTAP tests, Vitest tests, and Playwright flows

## Local setup

Requirements: Node.js 24+, pnpm 11+, Docker Desktop.

```bash
pnpm install
pnpm database#start
pnpm supabase:sync-env
pnpm web#dev
```

Open [http://localhost:3000](http://localhost:3000). Supabase Studio is at [http://localhost:54323](http://localhost:54323), and confirmation/recovery emails appear in Mailpit at [http://localhost:54324](http://localhost:54324).

For the local resolver console, the seed creates `admin@steamforecast.local` with password `Password123!`. This is demo data only and must not be recreated in production.

The app loads its local public Supabase settings from the root `.env.local`. `pnpm supabase:sync-env` creates or updates that file from the running local stack. Never use the local keys in production.

To stop the local database:

```bash
pnpm database#stop
```

## Checks

Run the local Supabase stack before database or end-to-end tests.

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter database test-db
pnpm build
pnpm test:e2e
```

Database types consumed by the web app are generated with:

```bash
pnpm gen-types-local
```

## Production deployment

1. Create a hosted Supabase project and link it from `apps/database`.
2. Apply the generated migrations with `supabase db push`.
3. Configure exact production and preview redirect URLs in Supabase Auth.
4. Use the token-hash confirmation and recovery routes documented in `docs/ARCHITECTURE.md`.
5. Configure a production SMTP provider; Supabase's default mailer is rate-limited.
6. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `NEXT_PUBLIC_SITE_URL` on the Next.js host.
7. Build with `pnpm build` and start with `pnpm --filter web start`.

Do not expose a Supabase secret/service key to the browser. Coin grants, stakes, payouts, profile permissions, and resolution remain database-controlled in every environment.

## Architecture and licences

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the data model, trust boundaries, and settlement lifecycle. Open-source notices are in [docs/OPEN_SOURCE_NOTICES.md](docs/OPEN_SOURCE_NOTICES.md); the retained NextBase MIT licence is in [LICENSE](LICENSE).
