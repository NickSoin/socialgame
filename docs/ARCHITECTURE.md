# NextHit Market architecture

## Trust boundaries

The browser may read public markets and public profile statistics. It may request a prediction, profile edit, or market resolution, but it never writes protected tables directly.

- `update_own_profile(...)` accepts only username, display name, bio, one fixed avatar ID, and selected links.
- `place_prediction(...)` locks the user and market rows, validates the deadline and balance, calculates integer shares, debits the balance, records the stake in the immutable ledger, and inserts one prediction.
- `resolve_market(...)` requires an admin profile, locks the market, settles it exactly once, credits winning payouts, appends ledger entries, and updates public statistics in one transaction.
- Direct profile balance/stat mutations, prediction inserts/updates, ledger writes, and market resolution are denied to browser roles.

RLS remains enabled on every public table. Table grants and RLS are separate layers: a permissive policy cannot restore a revoked mutation grant.

## Data model

- `profiles`: public identity, fixed avatar, balance, and aggregate prediction statistics; one row per `auth.users` record.
- `markets`: Steam app metadata, binary price, deadline, lifecycle, and outcome.
- `predictions`: one immutable YES/NO position per user and market, including locked price, stake, shares, and settlement result.
- `coin_ledger`: append-only audit trail for starter grants, stakes, payouts, and refunds.
- `leaderboard`: read-only public ranking view for coins and resolved-market accuracy.

Prices use basis points. For a selected side, whole winning shares are:

```text
shares = floor(stake × 10,000 ÷ selected_side_price_bps)
```

Each winning share pays one platform coin. JavaScript quote tests and PostgreSQL settlement use the same integer formula.

## Authentication flows

Supabase SSR clients are request-scoped and use cookie `getAll`/`setAll`. Next.js `proxy.ts` refreshes sessions and protects nested app routes. Redirects pass through a same-origin relative-path sanitizer.

For hosted email templates, use the token hash route:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/dashboard">Confirm email</a>
```

Password recovery uses the same route with `type=recovery` and `next=/update-password`. Production Auth redirect URLs should be exact; use broad wildcards only for local or preview environments.

## Steam metadata

`public.steam_games` is the server-side game catalog. Membership and wishlist rank come from the 256 `v2/current` JSON shards published by `NickSoin/SteamTopWishlistsRank`; the ledger is read only for games that have already moved to `released`. The catalog sync rejects incomplete shard sets by comparing them with `v2/meta.json`. It never overwrites Steam-owned release, tag, or media fields.

Steam enrichment is split by responsibility:

- `sync-steam-catalog` refreshes catalog membership and initializes component state.
- `sync-steam-popular` stores Steam's ordered Popular Upcoming intersection; it does not fetch per-game metadata.
- `sync-steam-details` refreshes App Details release metadata, Store-page tags, and the ordered screenshot source manifest. Exact dates are stored only when Steam supplies a complete valid day; values such as `2026`, `July 2026`, `Q3 2026`, and `Coming soon` remain partial/TBA labels with a null `release_date`.
- The trusted Node worker claims media jobs, downloads only allowlisted Steam CDN URLs, converts at most two screenshots to WebP under 25 KiB without cropping or upscaling, uploads a versioned Storage object, and then atomically publishes its database row. The browser can read only active media rows and cannot upload.

`public.steam_game_enrichment_state` stores independent release/tags/media status, retries, errors, source fingerprints, and leases. `public.steam_enrichment_runs` and `public.steam_game_release_transitions` provide run and release audit history. Transient failures keep the last good catalog values and use bounded exponential backoff; a successful authoritative partial/TBA response may clear a formerly exact date. Successful responses with no field are recorded as `not_available`, not retried forever.

Cards and search read the same bounded Supabase catalog query, including active `public.steam_game_media` rows. Their canonical hero is the cached `steam_games.image_url`; their hover carousel reads Supabase Storage URLs. Rendering a page or searching never invokes a Steam metadata scraper.

Scheduled Edge Functions require a 32+ character `x-steam-sync-secret` in addition to the project API key. Browser roles have no grants on operational state, transition, or run tables. Service-only SQL functions revoke default `PUBLIC` execution explicitly.

Production schedules are `15 1,6,11,16,21 * * *` UTC for catalog membership, `17 */3 * * *` for Popular Upcoming, and every ten minutes at minutes `2,12,22,32,42,52` for details discovery. A separate GitHub worker runs twice hourly to drain media jobs. See `docs/STEAM_GAME_DATA_PIPELINE_RUNBOOK.md` for deployment, repair, and quality-report commands.

A game is closed to new predictions as soon as either the upstream ledger marks it released or Steam reports `coming_soon: false`; games that merely leave the current wishlist feed stay in history with `is_wishlisted = false`.

Release detection only closes new predictions and preserves existing immutable bet snapshots. It does not yet resolve the three numeric forecasts (first-weekend CCU, first-month reviews, and US price); those outcomes still require a separate evidence and scoring pipeline with an authorised human fallback.

No source code from `SteamTopWishlistsRank` is copied. NextHit Market consumes its published JSON data contract and uses its own ingestion and validation code.
