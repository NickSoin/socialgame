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

The MVP stores curated Steam app IDs, titles, and header image URLs with each market. Market resolution must use timestamped, reviewable evidence and an authorised human fallback. No code from `SteamTopWishlistsRank` is copied because that repository did not expose an open-source licence when this implementation was prepared.
