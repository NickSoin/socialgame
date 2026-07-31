# NextHit Market: Steam game data pipeline agent task

**Status:** implementation and production backfill task  
**Date:** 31 July 2026  
**Repository:** `C:\Busyness\SteamGambling`  
**Product:** NextHit Market (`https://nexthitmarket.com`)

## Mission

Finish and productionize the game-enrichment pipeline so every active TopWishlisted game has trustworthy, cached metadata:

1. up to five real Steam tags;
2. the canonical GameHero image already used by cards and search;
3. two compressed hover screenshots whenever Steam provides at least two;
4. a truthful release date or a truthful non-exact label, without invented January/July dates;
5. a recorded terminal state when Steam genuinely does not provide a field, so “not available” is distinguishable from “sync failed”.

This is not a UI mock task. Implement the database model, ingestion/backfill, scheduled refresh, frontend data flow, tests, deployment, and production verification. The browser must read cached Supabase data and media; it must never scrape Steam while serving a page or search request.

## Read before changing code

Read these files completely and inspect their current tests/callers:

- `AGENTS.md`
- `.agents/skills/supabase/SKILL.md`
- `.agents/skills/supabase-schema-migrations/SKILL.md`
- `docs/ARCHITECTURE.md`
- `apps/database/supabase/schemas/forecasts.sql`
- `apps/database/supabase/functions/sync-steam-catalog/index.ts`
- `apps/database/supabase/functions/sync-steam-catalog/catalog.ts`
- `apps/database/supabase/functions/sync-steam-popular/index.ts`
- `apps/database/supabase/functions/sync-steam-details/index.ts`
- `apps/database/supabase/functions/_shared/steam-app-details.ts`
- `apps/database/supabase/functions/_shared/steam-release-date.ts`
- `apps/database/supabase/functions/_shared/steam-tags.ts`
- `apps/web/src/data/steam-game-catalog.ts`
- `apps/web/src/lib/steam-game-catalog.ts`
- `apps/web/src/lib/steam-hover-previews.ts`
- `apps/web/src/lib/steam-game-hero.ts`
- `apps/web/src/components/steambets/game-hero.tsx`
- `apps/web/scripts/optimize-game-previews.mjs`

The worktree may contain uncommitted fixes to the hover carousel and the 25 KiB image optimizer. Preserve and integrate those changes; do not reset or overwrite unrelated user work.

## Current system and known deficiencies

### What already exists

- `public.steam_games` is the canonical server-side catalog.
- Active catalog membership and wishlist rank come from the published v2 feed of `NickSoin/SteamTopWishlistsRank`.
- `sync-steam-catalog` imports the current 256 shards and preserves historical/released rows.
- `sync-steam-popular` imports Steam Popular Upcoming and intersects it with active TopWishlisted games.
- `sync-steam-details` calls Steam `appdetails` in bounded batches.
- Cards and search use `steam_games.image_url` as the single GameHero.
- The UI already limits displayed tags to five.
- Four proof-of-concept previews exist under `apps/web/public/game-previews`, and `steam-hover-previews.ts` hardcodes only two app IDs.

### Problems to fix

- `appdetails.genres` are currently presented as tags. These are genres, not the ordered Steam Store tags shown to users.
- Screenshots are not represented in the database and cannot be backfilled at catalog scale.
- Preview assets are bundled in the web app and mapped in source code.
- One combined `steam_data_updated_at`/`steam_data_attempted_at` pair cannot describe independent date, tag, and media outcomes.
- The date parser accepts only exact dates but discards the original precision/label. Earlier code paths have fabricated `January 1`, `July 1`, or similar dates from year/month-only values.
- A transient Steam failure can be confused with “Steam has no data”.
- Refresh coverage and backfill completeness are not directly measurable.
- The metadata functions currently accept unauthenticated POST requests. Scheduled production jobs must be authenticated without exposing service credentials.

## Non-negotiable source-of-truth rules

| Field | Source of truth | Rules |
|---|---|---|
| Catalog membership, name, wishlist rank | `NickSoin/SteamTopWishlistsRank` published v2 feed | Only current TopWishlisted games are active/searchable. Keep historical rows needed by existing bets, but mark them inactive. |
| Popular Upcoming membership/order | Steam Popular Upcoming feed | Cache in Supabase. Intersect with active TopWishlisted games. Never build this tab directly from wishlist rank alone. |
| GameHero | Steam `appdetails.data.header_image` | One canonical image URL per game. Cards and search must use the same field and fallback behavior. |
| Exact release date and release state | Steam `appdetails.data.release_date` | `coming_soon` controls upcoming/released state. Only a complete valid calendar date may populate `release_date`. |
| Display release text | Raw Steam release text, normalized safely | Preserve useful partial precision such as `2026`, `Q4 2026`, or `July 2026`; display `TBA` for vague/empty values. Never invent a day. |
| Tags | Ordered tags displayed on the Steam Store page | Store the first five unique, cleaned tags. `appdetails.genres` may be a separately identified fallback, never silently treated as successful Steam-tag extraction. |
| Screenshots | First two valid Steam `appdetails.data.screenshots` entries | Download server-side, compress, upload to Supabase Storage, and record metadata. Do not hotlink screenshots in the UI. |

All Steam-derived data must be fetched by scheduled/background jobs, persisted, and served from Supabase. No client component, route render, search request, or image hover may trigger Steam scraping.

## Required data model

Implement an equivalent normalized model if the exact names below conflict with established conventions, but all semantics are required.

### Extend `public.steam_games`

Preserve existing columns and add enough explicit state to represent:

- the raw normalized release text from Steam;
- release precision: `exact`, `month`, `quarter`, `year`, or `tba`;
- Steam `coming_soon` separately from the nullable date;
- release metadata last-success time;
- tag source (`steam_store_tags`, `appdetails_genres_fallback`, or `none`) and tag last-success time;
- media last-success time;
- backward compatibility for existing queries during rollout.

`release_date` remains nullable and contains only exact dates. Do not encode partial dates using the first day of a month/year.

### Add `public.steam_game_media`

Store media records instead of hardcoding them in the web bundle. At minimum record:

- `steam_app_id`, foreign key to `steam_games`;
- media kind and 1-based position;
- original trusted Steam source URL;
- Supabase Storage bucket and object path;
- MIME type (`image/webp` for processed screenshots);
- byte size, width, height, and SHA-256/checksum;
- processed/source timestamps;
- an active flag or another atomic versioning mechanism;
- unique identity for `(steam_app_id, media kind, position)` among active rows.

The public browser roles need read-only access to active media metadata. Only service-side code may insert, update, delete, or upload media.

### Add component-level enrichment state

Use a service-only table such as `steam_game_enrichment_state`, or an equally queryable design, to track release/details, tags, and media independently:

- status: `pending`, `complete`, `partial`, `not_available`, or `error`;
- last attempt and last success timestamps;
- retry-after time and consecutive failure count;
- short machine-readable error code plus a bounded diagnostic message.

An HTTP timeout/429/5xx must produce `error` and retain the last good data. A successful response with zero screenshots must produce `not_available`, not `error`. Never replace good tags/media/date with empty values because one refresh failed.

### Add run-level observability

Extend the existing sync-run approach or add an enrichment run table containing start/end/status and counts for selected, succeeded, partial, unavailable, failed, released, uploaded, skipped-unchanged, and still-pending games. This table is service-role only.

### Supabase schema workflow

- Change declarative files under `apps/database/supabase/schemas/*.sql`.
- Never manually create or edit a file under `apps/database/supabase/migrations`.
- Generate the migration from `apps/database` with:

```bash
pnpm supabase db diff -f steam_game_data_pipeline
```

- Review the generated SQL, apply it locally, run pgTAP tests, and regenerate local TypeScript types.
- Explicitly configure grants and RLS for every new public table. Do not rely on automatic Data API exposure.
- Keep service-role credentials out of SQL source, client bundles, logs, and committed environment files.

## Release-date implementation

Create one canonical parser/normalizer and make every Steam sync use it. Remove alternate date conversion paths.

### Required behavior

- Accept exact ISO and both common English full-date orders only after calendar validation.
- Treat `Coming soon`, `To be announced`, empty strings, and equivalents as `tba` with `release_date = null`.
- Preserve but do not coerce `2026`, `Q3 2026`, `July 2026`, `Summer 2026`, and similar partial dates.
- Invalid dates such as `February 30, 2026` remain null and are reported as invalid source data.
- Never use JavaScript parsing of ambiguous Steam strings as a fallback.
- Use UTC for formatting and comparisons.
- `coming_soon: false` may move a game to `released` even if Steam supplies no exact date. That must not create a fake release date.
- A bet create/approve/cancel action must not write any release metadata. Add a regression test proving that a bet operation leaves the relevant `steam_games` fields byte-for-byte unchanged.
- Upcoming games may have their announced dates changed or removed by Steam. A successful authoritative refresh may therefore replace an old exact upcoming date with a truthful partial/TBA state, but this transition must be logged. A failed request may not do so.

### Display and sorting

- Exact date: render the current concise month/day label.
- Partial date: render a sanitized truthful label, including its year when available.
- No meaningful date: render `TBA`.
- Popular Upcoming sorting: exact dates ascending; inside the same date, wishlist rank ascending; partial/TBA games after exact dates, then wishlist rank. Do not manufacture dates to make sorting easier.

Include fixtures/regressions for the previously reported Dear Passengers case: identify its current Steam app ID from the catalog, retain the raw source response as a small sanitized fixture, and prove that it does not become January 1 or enter a dated bucket when Steam has no exact date.

## Tag implementation

The product requirement is the first five Steam Store tags, not merely `appdetails.genres`.

1. Determine the current stable Steam Store response field/embedded data that contains the ordered public tags.
2. Implement extraction from saved HTML/JSON fixtures rather than relying on an untested ad-hoc regular expression.
3. Normalize whitespace, decode entities, deduplicate case-insensitively while preserving source order, reject empty/oversized values, and persist at most five.
4. Keep the Steam hostname/redirect allowlist strict.
5. When tag extraction fails, preserve the last good tags and mark the tag component `error`.
6. If the Store page genuinely supplies no tags, record `not_available`. If genres are shown temporarily, record the fallback source explicitly so it remains eligible for a later real-tag refresh.
7. Roll the data-driven tags out to every active TopWishlisted game. Do not add per-game constants.

Account for age-gated and region-sensitive store pages in server-side fixtures and tests. Use the existing US/English product convention consistently.

## Screenshot ingestion and compression

### Selection

- Extend the typed `appdetails` response to read `data.screenshots`.
- Select the first two distinct valid screenshots deterministically.
- Accept only HTTPS URLs on the explicit trusted Steam CDN host allowlist.
- Preserve aspect ratio; never stretch, crop, or upscale a screenshot.
- If Steam has one screenshot, store one and mark the result `partial`. If it has none, mark `not_available`.

### Processing budget

Every persisted hover screenshot must satisfy all of these:

- WebP;
- maximum `25 * 1024` bytes after encoding;
- preferred maximum width 540 px;
- metadata stripped;
- original aspect ratio preserved;
- highest visual quality achievable within the byte budget.

Reuse/refactor the existing Sharp optimizer: search quality from high to low and reduce width only when quality alone cannot satisfy the budget. Record final byte size, dimensions, and chosen quality in logs/metadata. A file over 25 KiB must never be published as active.

Run binary image processing in a background Node worker/CI job that supports Sharp, not in a browser request. If Supabase Edge Runtime cannot reliably run the chosen codec, keep metadata discovery in the Edge Function and have an authenticated resumable Node worker claim/process media jobs. Document the chosen runtime and how it is scheduled.

### Storage

- Create a dedicated Supabase Storage bucket, for example `steam-game-media`.
- Public may read active objects; browser roles may not upload, replace, or delete.
- Use content-addressed or versioned object paths, for example `<appId>/screenshots/1-<sha12>.webp`.
- Upload and validate the new object first, then atomically switch the database pointer. Delete the previous object only after the switch, and tolerate cleanup retry failures.
- Do not put the full catalog under `apps/web/public` and do not keep a generated TypeScript map of app IDs.
- Do not persist expiring signed URLs. Store bucket/path and derive a stable public/CDN URL.

### Frontend

- Remove the hardcoded `STEAM_HOVER_PREVIEWS` map after the database-backed path is live.
- Fetch active preview metadata with the catalog query in a bounded way; avoid one query per card.
- Card and search thumbnail continue to use the same canonical GameHero.
- Hover sequence is exactly `GameHero -> screenshot 1 -> screenshot 2 -> GameHero ...`, one-second steps.
- Preload available frames. One failed frame is skipped without stopping or resetting the sequence.
- Every new hover starts deterministically from GameHero and every mouse leave immediately restores GameHero and clears timers/listeners.
- With one screenshot, alternate GameHero and that screenshot. With none, remain on GameHero.
- Preserve the current click behavior: clicking a game card opens its Steam Store page in a new tab.

## Background processing and schedule

The pipeline must be idempotent, resumable, rate-limited, and safe under overlapping scheduler invocations.

### Priority order

1. active Popular Upcoming games;
2. active games with user forecasts/trending activity;
3. games with an exact release date within the next 14 days;
4. missing/failed fields by wishlist rank;
5. normal stale refresh by wishlist rank.

### Cadence target

- Catalog membership: keep the existing cadence aligned after the upstream TopWishlisted publication.
- Popular Upcoming: refresh from Steam every few hours and persist the result.
- Release state/date for priority games: every 1–2 hours.
- Complete active-catalog metadata sweep: at least daily once initial backfill is complete.
- Tags/screenshots: skip unchanged sources; refresh on source URL/change signal or on a slower weekly cadence.
- Failures: exponential backoff with jitter; honor 429/Retry-After; cap concurrency and request timeouts.

Use a lock/lease so a second run returns `already_running` or safely claims different work. Never let two workers publish the same media position concurrently.

Scheduled function calls must be authenticated. Use Supabase Vault/project secrets and the current supported Cron/Edge Function pattern; never commit the service-role key or a cron secret. Do not expose a publicly callable unauthenticated mutation endpoint.

## Backfill and operational tooling

Provide a resumable command for the initial production backfill with at least:

- `--dry-run`;
- `--limit`;
- `--app-id` for a single-game repair;
- bounded `--concurrency`;
- resume/claim behavior rather than starting over;
- a final summary with coverage and failure counts.

Backfill all active TopWishlisted games in wishlist-rank order. Do not reactivate games that have left the current feed. Historical games with bets remain in the database, but are not a prerequisite for the initial active-catalog completion.

Add a service-only data-quality report/query that returns, for active games:

- total games;
- exact, partial, and TBA release counts;
- five tags, one-to-four tags, fallback tags, and missing-tag counts;
- two screenshots, one screenshot, genuinely unavailable, pending, and failed counts;
- stale release/tag/media counts;
- oldest pending item and most recent successful run.

The final agent report must include before/after production counts from this query.

## Tests

Do not consider this complete without all relevant automated tests.

### Unit/fixture tests

- exact, partial, vague, invalid, and whitespace/entity release strings;
- leap-year/calendar validation;
- Dear Passengers regression;
- ordered tag extraction, deduplication, five-tag cap, age-gated page, and no-tag result;
- trusted/untrusted Steam image URLs and redirects;
- deterministic selection of the first two screenshots;
- merge semantics: network failure preserves the previous good fields;
- lifecycle changes without fabricated release dates;
- image optimizer produces valid WebP at or under 25 KiB and preserves aspect ratio.

### Database/pgTAP tests

- new tables, columns, constraints, foreign keys, unique positions, and indexes;
- RLS enabled;
- anon/authenticated can read only the intended active public metadata;
- anon/authenticated cannot mutate catalog, enrichment state, run history, objects, or media rows;
- service role can perform required writes;
- deleting/inactivating catalog membership does not break historical bets;
- bet approval does not mutate release fields.

### Frontend tests

- catalog/search share one GameHero URL;
- zero/one/two-preview behavior;
- deterministic hover sequence across repeated enter/leave cycles using fake timers;
- failed image skips correctly and leaves no stale timer/listener;
- tag display shows at most five;
- exact/partial/TBA labels and sort order.

### Full verification

With local Supabase running, execute:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter database test-db
pnpm gen-types-local
pnpm build
```

Run focused tests during implementation, then the full suite once at the end. Do not weaken existing tests to make the build pass.

## Deployment sequence

1. Record the production baseline with the data-quality report.
2. Apply reviewed generated database migrations.
3. Create/configure the Storage bucket and policies reproducibly.
4. Deploy updated Edge Functions and the authenticated media worker/schedule.
5. Run one single-app canary containing two screenshots and verify object size, dimensions, policies, DB rows, card/search image, and repeated hover behavior.
6. Run a small ranked batch and inspect rate limits/errors.
7. Start/resume the full active-catalog backfill.
8. Deploy the web app only after the DB/API remains backward compatible with the currently deployed frontend.
9. Verify `/`, `/trending`, `/involved`, and search on `https://nexthitmarket.com` as signed-out and signed-in users.
10. Confirm the next scheduled job completes without duplicating objects or resetting correct metadata.
11. Record final coverage counts and remaining legitimate `not_available` games.

Do not delete old preview assets or compatibility fields until the production frontend is confirmed to use database-backed media. Cleanup must be a later, recoverable step.

## Acceptance criteria

The task is complete only when:

- 100% of active TopWishlisted games have been attempted by each enrichment component and are in a terminal or scheduled-retry state;
- every game for which Steam exposes tags stores the first five ordered real Store tags, with the source identified;
- every game for which Steam exposes at least two screenshots has exactly two active Supabase-hosted WebP previews, each no larger than 25 KiB;
- media is database-driven and there is no production hardcoded app-ID preview map;
- release dates are exact or null; partial/vague dates are never coerced to January 1, July 1, July 3, or another invented day;
- release transitions are detected by the scheduled pipeline and are independent from bet mutations;
- transient failures preserve the last successful data and are observable/retryable;
- all catalog/search requests use Supabase data only and make zero live Steam requests;
- repeated hover sessions cycle reliably through GameHero and all available previews;
- RLS/grants prevent browser writes and secrets are absent from the bundle/repository;
- local checks pass, production migration/function/web deployments succeed, and a scheduled production run is verified;
- `docs/ARCHITECTURE.md` and operational instructions describe the final sources, schedules, Storage layout, repair command, and failure recovery.

## Explicit non-goals

- Do not add games outside the current TopWishlisted catalog to active search/feed pages.
- Do not use screenshots as alternate search thumbnails; GameHero remains the only canonical main image.
- Do not introduce user-uploaded media.
- Do not resolve forecast outcomes in this task.
- Do not redesign cards, navigation, leaderboard, points, or authentication.
- Do not scrape Steam from the browser or per page view.
- Do not fabricate missing data to improve visual completeness.

## Required handoff from the implementing agent

Return a concise report containing:

1. schema and pipeline decisions;
2. files changed;
3. generated migration name;
4. exact schedules and batch/concurrency/backoff settings;
5. before/after production coverage table;
6. screenshot byte-size distribution and any games with fewer than two source screenshots;
7. release-date regression results, including Dear Passengers;
8. commands/tests run and their results;
9. deployed function/web versions;
10. remaining failures with app IDs, error classes, retry times, and the safe next action.

