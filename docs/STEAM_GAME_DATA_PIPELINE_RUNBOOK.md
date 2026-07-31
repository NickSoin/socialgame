# Steam game data pipeline runbook

## Runtime ownership

- Supabase Edge Functions discover catalog, release, tags, followers, and screenshot source data.
- A Node.js worker with `sharp` performs image conversion and Storage publication.
- The browser reads cached database rows and public active Storage objects only.

Required operator secrets are `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL`), `SUPABASE_SECRET_KEY`, and a random `STEAM_SYNC_CRON_SECRET` of at least 32 characters. Never expose the secret/service key through `NEXT_PUBLIC_*` variables.

## Deploy and schedule

From `apps/database`, generate schema migrations only through the declarative workflow:

```bash
pnpm supabase db diff -f <migration_name>
pnpm supabase db push
pnpm supabase functions deploy sync-steam-catalog --no-verify-jwt
pnpm supabase functions deploy sync-steam-popular --no-verify-jwt
pnpm supabase functions deploy sync-steam-details --no-verify-jwt
pnpm supabase functions deploy sync-steam-followers --no-verify-jwt
pnpm supabase secrets set STEAM_SYNC_CRON_SECRET="$STEAM_SYNC_CRON_SECRET"
```

`--no-verify-jwt` is intentional: scheduled service requests authenticate inside each handler with the dedicated constant-time secret check. Then configure Vault and cron from the repository root:

```bash
pnpm steam:configure-schedule
```

Configure the GitHub Actions secrets `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and `STEAM_SYNC_CRON_SECRET`. The `steam-game-enrichment.yml` workflow is concurrency-locked so overlapping media workers do not accumulate; database leases remain the second safety layer.

## Backfill and repair

Inspect the plan without writing:

```bash
pnpm steam:backfill -- --dry-run --limit 100
```

Run a bounded batch, or repair one app id:

```bash
pnpm steam:backfill -- --limit 100 --concurrency 4
pnpm steam:backfill -- --app-id 4534960 --limit 1
```

The worker uploads the new version before switching the active row and deletes the old object only after the database publication succeeds. Retrying an unchanged source is idempotent. A failed job keeps the previous active media and receives exponential backoff with jitter.

To force rediscovery for a component, clear only its retry/lease and mark it pending with a service-role SQL session; do not delete historical run or release-transition rows:

```sql
update public.steam_game_enrichment_state
set status = 'pending', retry_after = null, lease_owner = null, lease_expires_at = null
where steam_app_id = 4534960 and component in ('release', 'tags', 'media', 'followers');
```

## Quality and failure checks

Call the service-only report after each deployment/backfill:

```sql
select * from public.get_steam_game_data_quality_report();
```

Investigate nonzero stale, pending, or failed counts through `steam_game_enrichment_state`, ordered by `retry_after` and `consecutive_failures`. A `not_available` state is terminal for the current successful source response; an `error` state is retryable and must retain last-good public values. Watch `steam_enrichment_runs` for unfinished `running` rows and compare uploaded/succeeded/partial/failed counts.

Followers are refreshed independently in paced batches of 20 every four minutes. A single sequential worker completes a full catalog pass in roughly 17 hours, while each game is eligible again only after its last successful follower refresh is at least 24 hours old.

For safe rollback, stop the GitHub workflow and unschedule the four sync jobs first. Revert application code and schema through a new declarative schema change/migration; never edit an existing migration file. Active Storage objects remain readable during rollback and can be garbage-collected only after verifying no active database row references them.
