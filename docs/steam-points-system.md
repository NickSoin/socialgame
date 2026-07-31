# Steam points system

## Scoring

Each numeric forecast is converted to a percentile with the immutable model version attached to its market. A UTC snapshot stores the exact forecast version that was active at 00:00. Edits therefore begin affecting scoring at the next snapshot and never rewrite an older snapshot.

For every eligible player-day (at least two forecasts in the snapshot):

```text
M = average percentile of every other player
points = abs(actual_percentile - M) - abs(actual_percentile - player_percentile)
```

Positive points mean the player improved on the rest of the crowd. Negative points mean the crowd without that player was closer. Leaderboard totals are the sum of every current, non-void score run.

## Lifecycle and jobs

- `process_steam_market_cycle()` runs every five minutes. It creates markets for current TopWishlisted games, keeps release-derived dates current, migrates legacy `steam_bets` into version history, and locks due markets.
- `create_steam_market_snapshots()` runs at 00:00 UTC and is idempotent per market/date.
- `get_steam_resolution_queue()` exposes locked markets whose measurement window has ended to administrators/service jobs.
- `resolve_steam_forecast_market()`, `recalculate_steam_forecast_market()`, and `void_steam_forecast_market()` require an administrator or service role. Results and score runs are versioned; corrections do not erase the previous calculation.
- `rebuild_steam_leaderboard_stats()` materializes the All/CCU/Reviews/Price rankings after resolution, correction, recalculation, or voiding.

## Migration

There is one global `scoring_start_at`, created when the system is first initialized. Existing `steam_bets` become the initial active forecast version at that timestamp. No snapshots or points are invented for earlier dates.

Deploy database migrations before the web build, then run:

```sql
select public.process_steam_market_cycle();
```

Finally apply `apps/database/scripts/configure-steam-sync-schedule.mjs` so both market jobs are registered with `pg_cron`.

## Explicit MVP assumptions

- Steam catalog data currently gives a release **date**, not a reliable release timestamp. The lock boundary is therefore 00:00 UTC on that date. A future exact timestamp can be applied only while a market is open.
- The first-weekend measurement becomes eligible on the Monday following release; first-month reviews after 30 days; launch price immediately at release. Actual values still require a trusted resolver/admin source.
- The initial percentile distributions are an explicit `mvp_fixture_v1`, not live user forecasts. Replacing them requires a new model version and dataset reference; existing markets retain version 1.
- NextHit displays its existing generated badge avatars and public nickname only. Google email/photo data is never exposed by the leaderboard.
