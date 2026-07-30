# Steam Prediction Market: Top-Level Agent Task

**Status:** implementation task  
**Date:** 30 July 2026  
**Target:** desktop-first web application

## Objective

Build a functional web MVP for a Steam-focused, play-money prediction platform.

The product must not use real money, cryptocurrency, cash-equivalent prizes, redeemable tokens, wallets, deposits, withdrawals, or blockchain infrastructure.

## Confirmed Product Scope

- Users register and sign in.
- Users make predictions or place bets on events connected to different Steam game titles.
- The platform uses only internal platform coins.
- Successful predictions award platform coins.
- The home page lists available prediction markets.
- Each user has a public profile.
- A profile includes:
  - username and display name;
  - short description or bio;
  - selected links;
  - a platform-provided avatar selected from a fixed set;
  - coin balance and prediction statistics.
- Users cannot upload their own avatar images.
- The product includes:
  - a leaderboard ranked by coins;
  - a leaderboard ranked by correct predictions or prediction accuracy.
- The first release is a desktop web product.

Do not add real-money features, cryptocurrency features, user-uploaded images, or unrelated social features.

## Researched Technical Approaches

### Approach 1: Recommended Foundation

Use **NextBase Starter** as the application foundation.

Verified capabilities in the project include:

- Next.js 16 and TypeScript;
- Supabase Auth and Postgres;
- server-side authentication patterns;
- protected routes;
- Row Level Security;
- versioned database migrations;
- Zod-validated server actions;
- shadcn/ui and Tailwind;
- Vitest unit tests;
- Playwright end-to-end tests;
- pgTAP database and RLS test scaffolding;
- GitHub Actions starter workflows;
- MIT licence.

Use this foundation for authentication, sessions, database access, permissions, migrations, testing, and the initial application shell.

Reference:

- https://github.com/imbhargav5/nextbase-nextjs-supabase-starter

### Approach 2: Prediction-Market Reference

Use **Manifold** only as a reference and selective code donor.

Relevant areas already present in Manifold include:

- market pages and market UI patterns;
- market calculation code;
- play-money account and position concepts;
- user profiles;
- profile editing;
- leaderboards;
- portfolio and prediction history concepts.

Do not fork or retain the entire Manifold application. Its repository contains the full operational product, including a large monorepo, migrated and legacy storage systems, a separate backend, bots, mobile applications, groups, shops, comments, and other functionality outside this MVP.

Reuse only clearly isolated logic or patterns after checking dependencies. Preserve the required MIT licence notice for copied or substantially reused code.

References:

- Repository: https://github.com/manifoldmarkets/manifold
- Architecture: https://github.com/manifoldmarkets/manifold/blob/main/README.md
- Licence: https://github.com/manifoldmarkets/manifold/blob/main/LICENSE.md
- Market calculations: https://github.com/manifoldmarkets/manifold/tree/main/common/src
- Profile editor: https://github.com/manifoldmarkets/manifold/blob/main/web/components/profile/edit-profile.tsx
- Public profile page: https://github.com/manifoldmarkets/manifold/blob/main/web/pages/%5Busername%5D/index.tsx
- Leaderboard backend: https://github.com/manifoldmarkets/manifold/blob/main/backend/api/src/get-leaderboard.ts
- Leaderboard UI: https://github.com/manifoldmarkets/manifold/blob/main/web/components/leaderboard.tsx

### Approach 3: Official Supabase Patterns

Use official Supabase documentation as the authority for authentication, public profile tables, RLS policies, and database tests.

Verified official patterns include:

- Next.js cookie-based authentication;
- a public profile table linked to `auth.users`;
- Row Level Security for user-owned data;
- separate browser and server clients;
- pgTAP tests for tables, constraints, functions, and RLS policies.

References:

- Next.js Auth: https://supabase.com/docs/guides/auth/quickstarts/nextjs
- User management example: https://supabase.com/nextjs
- Managing user data: https://supabase.com/docs/guides/auth/managing-user-data
- Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Testing overview: https://supabase.com/docs/guides/local-development/testing/overview
- Database testing: https://supabase.com/docs/guides/database/testing

### Approach 4: Heavier Alternative

**Apptension SaaS Boilerplate** is a possible alternative when a separate full backend, Django admin, workers, advanced authentication, 2FA, active-session management, and AWS-oriented infrastructure are required.

It provides a React frontend, Django and GraphQL backend, admin panel, workers, Docker-based local environment, authentication features, and deployment infrastructure.

Do not select it by default for this MVP. It introduces substantially more infrastructure and maintenance than the recommended NextBase and Supabase approach.

Reference:

- https://github.com/apptension/saas-boilerplate

### Rejected Approach: Crypto-First Prediction-Market Clones

Do not base this product on Kuest or similar Polymarket clones.

Kuest is designed around Polygon, USDC, wallets, UMA resolution, CLOB infrastructure, shared liquidity, trading fees, and on-chain contracts. Those systems conflict with the confirmed play-money-only product.

Reference:

- https://github.com/kuestcom/prediction-market

## Existing Internal Steam Reference

The existing repository **NickSoin/SteamTopWishlistsRank** contains a working scheduled Steam data-feed pattern, Steam app ID handling, cached hosted shards, GitHub Actions, and parser tests.

It is not the application foundation, but agents may inspect it when implementing Steam metadata or scheduled Steam-data ingestion.

Reference:

- https://github.com/NickSoin/SteamTopWishlistsRank

## Selected Direction

Use this combination:

1. **NextBase Starter** for the application foundation.
2. **Supabase official patterns** for authentication, profiles, permissions, RLS, and database testing.
3. **Manifold** only for isolated prediction-market logic and interface references.
4. **SteamTopWishlistsRank** only as an optional reference for Steam data ingestion patterns.
5. Do not introduce blockchain or real-money infrastructure.

## Agent Execution Instruction

Act as the lead implementation agent and use parallel subagents where useful.

Before implementation:

1. Inspect the referenced repositories and official documentation.
2. Confirm the current licences and dependency boundaries.
3. Produce a short implementation plan based only on the confirmed scope and references in this task.

Then implement the MVP, including:

- project foundation and local setup;
- registration, login, logout, email confirmation, and password recovery;
- public user profiles with fixed selectable avatars, bio, and links;
- Steam-title prediction markets;
- platform coin tracking;
- user prediction history and statistics;
- leaderboard by coins;
- leaderboard by correct predictions or accuracy;
- database migrations and RLS policies;
- automated tests for authentication boundaries, ownership, coin mutations, predictions, market resolution, and leaderboards;
- concise run and deployment documentation.

Use server-side or database-controlled mutations for all privileged operations. Do not allow the browser to directly change coin balances, resolved results, another user's profile, or another user's predictions.

## Completion Standard

The task is complete only when:

- the application runs locally from documented commands;
- a new user can register, confirm an account, log in, and recover a password;
- a user can edit only their own permitted profile fields;
- a user can select only a platform-provided avatar;
- users can view markets and make predictions;
- successful resolved predictions update the platform coin state;
- both requested leaderboards work;
- RLS and permission boundaries are covered by database tests;
- critical user flows are covered by end-to-end tests;
- linting, type checking, unit tests, database tests, and end-to-end tests pass;
- copied or adapted open-source code retains all required licence notices.
