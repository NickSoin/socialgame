BEGIN;

CREATE SCHEMA IF NOT EXISTS tests;
GRANT USAGE ON SCHEMA tests TO anon, authenticated;

CREATE OR REPLACE FUNCTION tests.create_test_user(
  user_id uuid,
  user_email text,
  display_name text
)
RETURNS void
LANGUAGE sql
AS $$
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    user_id,
    'authenticated',
    'authenticated',
    user_email,
    extensions.crypt('Password123!', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('display_name', display_name),
    now(),
    now()
  );
$$;

CREATE OR REPLACE FUNCTION tests.set_user_context(user_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', user_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', user_id::text, 'role', 'authenticated')::text,
    true
  );
END;
$$;

CREATE OR REPLACE FUNCTION tests.clear_user_context()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
END;
$$;

GRANT EXECUTE ON FUNCTION tests.set_user_context(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION tests.clear_user_context() TO anon, authenticated;

SELECT no_plan();

-- =============================================================================
-- Schema, RLS, grants, and RPC shape
-- =============================================================================

SELECT hasnt_table('public', 'private_items', 'starter private_items table is removed');
SELECT hasnt_table('public', 'content_blog_posts', 'starter blog posts table is removed');
SELECT hasnt_table('public', 'content_blog_post_comments', 'starter blog comments table is removed');
SELECT has_table('public', 'profiles', 'profiles table exists');
SELECT has_table('public', 'markets', 'markets table exists');
SELECT has_table('public', 'predictions', 'predictions table exists');
SELECT has_table('public', 'coin_ledger', 'coin ledger table exists');
SELECT has_table('public', 'forecast_targets', 'numeric forecast targets table exists');
SELECT has_table('public', 'numeric_predictions', 'numeric predictions table exists');
SELECT has_table('public', 'steam_bets', 'locked Steam bets table exists');
SELECT has_table('public', 'steam_games', 'Steam wishlist catalog table exists');
SELECT has_table('public', 'steam_catalog_sync_runs', 'Steam catalog sync history table exists');
SELECT has_table('public', 'steam_percentile_models', 'versioned percentile models table exists');
SELECT has_table('public', 'steam_scoring_config', 'global scoring start configuration exists');
SELECT has_table('public', 'steam_forecast_markets', 'Steam points markets table exists');
SELECT has_table('public', 'steam_prediction_versions', 'forecast history table exists');
SELECT has_table('public', 'steam_market_daily_snapshots', 'daily scoring snapshots table exists');
SELECT has_table('public', 'steam_market_snapshot_predictions', 'immutable snapshot membership exists');
SELECT has_table('public', 'steam_market_results', 'versioned result audit table exists');
SELECT has_table('public', 'steam_score_runs', 'score recalculation audit table exists');
SELECT has_table('public', 'steam_prediction_score_entries', 'daily points entries table exists');
SELECT has_table('public', 'steam_user_leaderboard_stats', 'materialized points leaderboard exists');
SELECT has_function(
  'public', 'submit_steam_prediction', ARRAY['bigint', 'text', 'numeric'],
  'versioned Steam prediction RPC exists'
);
SELECT has_function(
  'public', 'get_steam_points_leaderboard', ARRAY['text', 'integer', 'integer'],
  'paginated points leaderboard RPC exists'
);
SELECT has_column('public', 'steam_bets', 'game_name', 'Steam bets preserve game names');
SELECT has_column('public', 'steam_bets', 'release_date', 'Steam bets preserve release dates');
SELECT has_column('public', 'steam_bets', 'release_label', 'Steam bets preserve release labels');
SELECT has_column('public', 'steam_bets', 'image_url', 'Steam bets preserve artwork URLs');
SELECT has_column('public', 'steam_games', 'wishlist_rank', 'Steam games preserve wishlist rank');
SELECT has_column('public', 'steam_games', 'lifecycle_status', 'Steam games preserve release state');
SELECT has_column('public', 'steam_games', 'source_updated_at', 'Steam games preserve source freshness');
SELECT has_column('public', 'steam_games', 'is_popular_upcoming', 'Steam games store Popular Upcoming membership');
SELECT has_column('public', 'steam_games', 'popular_upcoming_position', 'Steam games store Steam popularity position');
SELECT has_column('public', 'steam_games', 'steam_data_updated_at', 'Steam games store Steam refresh time');
SELECT has_column('public', 'steam_games', 'steam_data_attempted_at', 'Steam games store Steam refresh attempts');
SELECT has_column('public', 'steam_games', 'tags', 'Steam games store Steam genres');
SELECT ok(to_regclass('public.leaderboard') IS NOT NULL, 'leaderboard view exists');

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND confrelid = 'auth.users'::regclass
      AND contype = 'f'
  ),
  'profiles.id references auth.users.id'
);

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.profiles'::regclass),
  'profiles has RLS enabled'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.markets'::regclass),
  'markets has RLS enabled'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.predictions'::regclass),
  'predictions has RLS enabled'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.coin_ledger'::regclass),
  'coin ledger has RLS enabled'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.forecast_targets'::regclass),
  'forecast targets has RLS enabled'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.numeric_predictions'::regclass),
  'numeric predictions has RLS enabled'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.steam_bets'::regclass),
  'locked Steam bets has RLS enabled'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.steam_games'::regclass),
  'Steam games catalog has RLS enabled'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.steam_catalog_sync_runs'::regclass),
  'Steam catalog sync history has RLS enabled'
);
SELECT is(
  (
    SELECT prosecdef
    FROM pg_proc
    WHERE oid = 'public.get_steam_bet_trends()'::regprocedure
  ),
  true,
  'Steam trend aggregation is SECURITY DEFINER'
);
SELECT ok(
  has_function_privilege('anon', 'public.get_steam_bet_trends()', 'EXECUTE'),
  'anonymous visitors can read aggregate Steam bet trends'
);
SELECT has_function(
  'public',
  'get_steam_bet_summaries',
  ARRAY[]::text[],
  'Steam bet summary aggregation exists'
);
SELECT is(
  (
    SELECT prosecdef
    FROM pg_proc
    WHERE oid = 'public.get_steam_bet_summaries()'::regprocedure
  ),
  true,
  'Steam bet summary aggregation is SECURITY DEFINER'
);
SELECT ok(
  has_function_privilege('anon', 'public.get_steam_bet_summaries()', 'EXECUTE'),
  'anonymous visitors can read aggregate Steam bet summaries'
);

SELECT ok(
  NOT has_table_privilege('authenticated', 'public.profiles', 'UPDATE'),
  'authenticated cannot directly update profiles'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.predictions', 'INSERT'),
  'authenticated cannot directly insert predictions'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.coin_ledger', 'INSERT'),
  'authenticated cannot directly insert coin ledger entries'
);
SELECT ok(
  NOT has_table_privilege('anon', 'public.predictions', 'SELECT'),
  'anonymous users cannot read predictions'
);
SELECT ok(
  has_table_privilege('authenticated', 'public.steam_bets', 'SELECT'),
  'authenticated users can read their locked Steam bets'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.steam_bets', 'INSERT'),
  'authenticated users cannot bypass the versioned Steam prediction RPC'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.steam_bets', 'UPDATE'),
  'authenticated users cannot update a locked Steam bet'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.steam_bets', 'DELETE'),
  'authenticated users cannot delete a locked Steam bet'
);
SELECT ok(
  NOT has_table_privilege('anon', 'public.steam_bets', 'SELECT'),
  'anonymous users cannot read Steam bets'
);
SELECT ok(
  has_table_privilege('anon', 'public.steam_games', 'SELECT'),
  'anonymous visitors can read the Steam games catalog'
);
SELECT ok(
  has_table_privilege('authenticated', 'public.steam_games', 'SELECT'),
  'authenticated users can read the Steam games catalog'
);
SELECT ok(
  NOT has_table_privilege('anon', 'public.steam_games', 'INSERT'),
  'anonymous visitors cannot mutate the Steam games catalog'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.steam_games', 'INSERT'),
  'authenticated users cannot mutate the Steam games catalog'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.steam_catalog_sync_runs', 'SELECT'),
  'catalog sync history remains service-role only'
);
SELECT is(
  (
    SELECT prosecdef
    FROM pg_proc
    WHERE oid = 'public.update_own_profile(text,text,text,text,jsonb)'::regprocedure
  ),
  true,
  'update_own_profile is SECURITY DEFINER'
);
SELECT is(
  (
    SELECT prosecdef
    FROM pg_proc
    WHERE oid = 'public.place_prediction(uuid,text,integer)'::regprocedure
  ),
  true,
  'place_prediction is SECURITY DEFINER'
);
SELECT is(
  (
    SELECT prosecdef
    FROM pg_proc
    WHERE oid = 'public.resolve_market(uuid,text)'::regprocedure
  ),
  true,
  'resolve_market is SECURITY DEFINER'
);
SELECT is(
  (
    SELECT prosecdef
    FROM pg_proc
    WHERE oid = 'public.is_current_user_admin()'::regprocedure
  ),
  true,
  'is_current_user_admin is SECURITY DEFINER'
);
SELECT is(
  (
    SELECT prosecdef
    FROM pg_proc
    WHERE oid = 'public.upsert_numeric_prediction(uuid,numeric)'::regprocedure
  ),
  true,
  'upsert_numeric_prediction is SECURITY DEFINER'
);

-- =============================================================================
-- Cross-user fixtures (postgres role; signup trigger runs for each user)
-- =============================================================================

SELECT tests.create_test_user(
  '91111111-1111-4111-8111-111111111111',
  'alpha@test.com',
  'Alpha Predictor'
);
SELECT tests.create_test_user(
  '92222222-2222-4222-8222-222222222222',
  'beta@test.com',
  'Beta Predictor'
);
SELECT tests.create_test_user(
  '93333333-3333-4333-8333-333333333333',
  'admin@test.com',
  'Market Admin'
);

INSERT INTO private.admin_users (user_id)
VALUES ('93333333-3333-4333-8333-333333333333');

INSERT INTO public.markets (
  id,
  slug,
  steam_app_id,
  steam_title,
  question,
  description,
  category,
  yes_price_bps,
  created_at,
  closes_at,
  header_image_url
)
VALUES
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    'test-cs2-player-peak',
    730,
    'Counter-Strike 2',
    'Will the test player-count outcome be YES?',
    'Deterministic market used to test 60/40 share math and resolution.',
    'Player count',
    6000,
    now() - interval '1 day',
    now() + interval '1 day',
    'https://cdn.akamai.steamstatic.com/steam/apps/730/header.jpg'
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
    'test-future-market',
    413150,
    'Stardew Valley',
    'Will this future test market resolve YES?',
    'Open market for stake-validation and early-resolution tests.',
    'Reviews',
    5000,
    now(),
    now() + interval '2 days',
    'https://cdn.akamai.steamstatic.com/steam/apps/413150/header.jpg'
  ),
  (
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc3',
    'test-closed-market',
    1091500,
    'Cyberpunk 2077',
    'Will this already closed market resolve YES?',
    'Closed market used to ensure new predictions are rejected.',
    'Player count',
    5500,
    now() - interval '2 days',
    now() - interval '1 day',
    'https://cdn.akamai.steamstatic.com/steam/apps/1091500/header.jpg'
  );

SELECT is(
  (SELECT count(*)::integer FROM public.profiles WHERE id IN (
    '91111111-1111-4111-8111-111111111111',
    '92222222-2222-4222-8222-222222222222',
    '93333333-3333-4333-8333-333333333333'
  )),
  3,
  'signup trigger creates one profile per auth user'
);
SELECT is(
  (SELECT min(coin_balance) FROM public.profiles WHERE id IN (
    '91111111-1111-4111-8111-111111111111',
    '92222222-2222-4222-8222-222222222222',
    '93333333-3333-4333-8333-333333333333'
  )),
  1000::bigint,
  'every signup profile starts with 1000 coins'
);
SELECT is(
  (
    SELECT count(*)::integer
    FROM public.coin_ledger
    WHERE reason = 'signup_bonus'
      AND user_id IN (
        '91111111-1111-4111-8111-111111111111',
        '92222222-2222-4222-8222-222222222222',
        '93333333-3333-4333-8333-333333333333'
      )
  ),
  3,
  'signup trigger records one immutable bonus per user'
);
SELECT has_trigger(
  'auth',
  'users',
  'on_auth_user_created',
  'auth.users has the profile signup trigger'
);

-- =============================================================================
-- Anonymous read boundary and authenticated profile editing
-- =============================================================================

SET LOCAL ROLE anon;
SELECT tests.clear_user_context();

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.profiles
    WHERE id IN (
      '91111111-1111-4111-8111-111111111111',
      '92222222-2222-4222-8222-222222222222',
      '93333333-3333-4333-8333-333333333333'
    )
  ),
  3,
  'anonymous users can read public profiles'
);
SELECT is(
  (
    SELECT count(*)::integer
    FROM public.markets
    WHERE id IN (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
      'cccccccc-cccc-4ccc-8ccc-ccccccccccc3'
    )
  ),
  3,
  'anonymous users can read public Steam markets'
);
SELECT throws_ok(
  $$SELECT public.update_own_profile('anon_user', 'Anon', '', 'steam_blue', '{}')$$,
  '42501',
  NULL,
  'anonymous users cannot call profile mutation successfully'
);

SET LOCAL ROLE authenticated;
SELECT tests.set_user_context('91111111-1111-4111-8111-111111111111');
SELECT is(
  public.is_current_user_admin(),
  false,
  'ordinary authenticated users are not reported as admins'
);

SELECT lives_ok(
  $$SELECT public.update_own_profile(
    'alpha_steam',
    'Alpha Steam',
    'Tracks Steam peaks.',
    'golden_controller',
    '{"steam":"https://steamcommunity.com/id/alpha"}'
  )$$,
  'a user can update their own display fields through the RPC'
);
SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = '91111111-1111-4111-8111-111111111111'
      AND username = 'alpha_steam'
      AND display_name = 'Alpha Steam'
      AND avatar_id = 'golden_controller'
      AND links ->> 'steam' = 'https://steamcommunity.com/id/alpha'
  ),
  'update_own_profile changes only the caller profile display fields'
);
SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = '91111111-1111-4111-8111-111111111111'
      AND coin_balance = 1000
      AND predictions_made = 0
      AND correct_predictions = 0
  ),
  'profile RPC preserves protected financial and prediction stats'
);
SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = '92222222-2222-4222-8222-222222222222'
      AND display_name = 'Beta Predictor'
      AND coin_balance = 1000
  ),
  'updating a profile does not mutate another user'
);
SELECT throws_ok(
  $$SELECT public.update_own_profile('alpha_steam', 'Alpha', '', 'uploaded_avatar', '{}')$$,
  '22P02',
  NULL,
  'profile RPC rejects avatars outside the platform enum'
);
SELECT throws_ok(
  $$SELECT public.update_own_profile(
    'alpha_steam',
    'Alpha',
    '',
    'steam_blue',
    '{"malicious":"https://example.com"}'
  )$$,
  '23514',
  NULL,
  'profile RPC rejects unapproved link keys'
);
SELECT throws_ok(
  $$UPDATE public.profiles
    SET coin_balance = 999999
    WHERE id = '91111111-1111-4111-8111-111111111111'$$,
  '42501',
  NULL,
  'authenticated users cannot directly mutate coin balance'
);

-- =============================================================================
-- Prediction placement: exact integer math, atomic debit, and RLS isolation
-- =============================================================================

SELECT lives_ok(
  $$SELECT public.place_prediction(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    'yes',
    100
  )$$,
  'user Alpha can place a YES prediction'
);
SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.predictions
    WHERE user_id = '91111111-1111-4111-8111-111111111111'
      AND market_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
      AND outcome = 'yes'
      AND stake = 100
      AND price_bps = 6000
      AND shares = 166
  ),
  'YES shares use floor(stake * 10000 / yes_price_bps)'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = '91111111-1111-4111-8111-111111111111'
      AND coin_balance = 900
      AND predictions_made = 1
      AND coins_wagered = 100
  ),
  'placing a prediction atomically debits balance and updates stats'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM public.coin_ledger
    WHERE user_id = '91111111-1111-4111-8111-111111111111'
      AND reason = 'prediction_stake'
      AND amount = -100
      AND balance_after = 900
  ),
  'prediction debit has an exact ledger entry'
);
SELECT is(
  (SELECT total_volume FROM public.markets WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'),
  100::bigint,
  'market volume increases with the first stake'
);

SELECT tests.set_user_context('92222222-2222-4222-8222-222222222222');
SELECT lives_ok(
  $$SELECT public.place_prediction(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    'no',
    200
  )$$,
  'user Beta can place a NO prediction'
);
SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.predictions
    WHERE user_id = '92222222-2222-4222-8222-222222222222'
      AND market_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
      AND outcome = 'no'
      AND stake = 200
      AND price_bps = 4000
      AND shares = 500
  ),
  'NO shares use floor(stake * 10000 / (10000 - yes_price_bps))'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = '92222222-2222-4222-8222-222222222222'
      AND coin_balance = 800
      AND predictions_made = 1
      AND coins_wagered = 200
  ),
  'second user debit and stats are isolated'
);

SELECT tests.set_user_context('91111111-1111-4111-8111-111111111111');
SELECT is(
  (SELECT count(*)::integer FROM public.predictions),
  1,
  'RLS exposes only the caller prediction history'
);
SELECT is(
  (
    SELECT count(*)::integer
    FROM public.predictions
    WHERE user_id = '92222222-2222-4222-8222-222222222222'
  ),
  0,
  'RLS hides another user prediction'
);
SELECT is(
  (SELECT count(*)::integer FROM public.coin_ledger),
  2,
  'RLS exposes only the caller signup and stake ledger entries'
);

SELECT throws_ok(
  $$SELECT public.place_prediction(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    'no',
    50
  )$$,
  '23505',
  NULL,
  'one prediction per user and market is enforced'
);
SELECT throws_ok(
  $$SELECT public.place_prediction(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
    'yes',
    9
  )$$,
  '22023',
  NULL,
  'stake below the minimum is rejected'
);
SELECT throws_ok(
  $$SELECT public.place_prediction(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
    'yes',
    901
  )$$,
  '22003',
  NULL,
  'stake above the current balance is rejected atomically'
);
SELECT throws_ok(
  $$SELECT public.place_prediction(
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc3',
    'yes',
    10
  )$$,
  '55000',
  NULL,
  'predictions cannot be placed after market close'
);
SELECT throws_ok(
  $$INSERT INTO public.predictions (
    user_id, market_id, outcome, stake, price_bps, shares
  ) VALUES (
    '91111111-1111-4111-8111-111111111111',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
    'yes', 10, 5000, 20
  )$$,
  '42501',
  NULL,
  'authenticated users cannot bypass place_prediction with direct INSERT'
);
SELECT throws_ok(
  $$INSERT INTO public.coin_ledger (
    user_id, amount, balance_after, reason
  ) VALUES (
    '91111111-1111-4111-8111-111111111111', 1000, 1900, 'signup_bonus'
  )$$,
  '42501',
  NULL,
  'authenticated users cannot mint coins with direct ledger INSERT'
);

RESET ROLE;
UPDATE public.markets
SET closes_at = now() - interval '1 minute'
WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';

SET LOCAL ROLE authenticated;
SELECT tests.set_user_context('91111111-1111-4111-8111-111111111111');
SELECT throws_ok(
  $$SELECT public.resolve_market(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    'yes'
  )$$,
  '42501',
  NULL,
  'non-admin users cannot resolve markets'
);

SELECT tests.set_user_context('93333333-3333-4333-8333-333333333333');
SELECT is(
  public.is_current_user_admin(),
  true,
  'admin RPC reports the resolver account safely'
);
SELECT throws_ok(
  $$SELECT public.resolve_market(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
    'yes'
  )$$,
  '55000',
  NULL,
  'admin cannot resolve a market before its close time'
);

-- =============================================================================
-- Admin resolution: atomic payouts, stats, idempotency, and leaderboard
-- =============================================================================

SELECT lives_ok(
  $$SELECT public.resolve_market(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    'yes'
  )$$,
  'admin can resolve a closed market'
);

RESET ROLE;
SELECT ok(
  EXISTS (
    SELECT 1 FROM public.markets
    WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
      AND status = 'resolved'
      AND resolved_outcome = 'yes'
      AND resolved_at IS NOT NULL
  ),
  'resolution stores final market state'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = '91111111-1111-4111-8111-111111111111'
      AND coin_balance = 1066
      AND predictions_resolved = 1
      AND correct_predictions = 1
      AND coins_won = 166
  ),
  'winner receives shares as payout and correct stats'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = '92222222-2222-4222-8222-222222222222'
      AND coin_balance = 800
      AND predictions_resolved = 1
      AND correct_predictions = 0
      AND coins_won = 0
  ),
  'loser receives no payout and resolved stats still advance'
);
SELECT is(
  (
    SELECT count(*)::integer
    FROM public.predictions
    WHERE market_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
      AND resolved_at IS NOT NULL
      AND (
        (outcome = 'yes' AND is_correct AND payout = 166)
        OR (outcome = 'no' AND NOT is_correct AND payout = 0)
      )
  ),
  2,
  'both predictions store the correct resolution result'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM public.coin_ledger
    WHERE user_id = '91111111-1111-4111-8111-111111111111'
      AND reason = 'prediction_payout'
      AND amount = 166
      AND balance_after = 1066
  ),
  'winner payout has one exact ledger entry'
);

SET LOCAL ROLE authenticated;
SELECT lives_ok(
  $$SELECT public.resolve_market(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    'yes'
  )$$,
  'repeating the same resolution is idempotent'
);

RESET ROLE;
SELECT ok(
  (
    SELECT correct_predictions = 1 AND predictions_resolved = 1
    FROM public.profiles
    WHERE id = '91111111-1111-4111-8111-111111111111'
  )
  AND (
    SELECT count(*) = 1
    FROM public.coin_ledger
    WHERE prediction_id = (
      SELECT id FROM public.predictions
      WHERE user_id = '91111111-1111-4111-8111-111111111111'
        AND market_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
    )
      AND reason = 'prediction_payout'
  ),
  'idempotent resolution does not duplicate stats or payout ledger rows'
);

SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$SELECT public.resolve_market(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    'no'
  )$$,
  '55000',
  NULL,
  'resolved market cannot be changed to another outcome'
);

RESET ROLE;
SELECT throws_ok(
  $$UPDATE public.coin_ledger
    SET amount = amount + 1
    WHERE id = (SELECT id FROM public.coin_ledger LIMIT 1)$$,
  '42501',
  NULL,
  'coin ledger rows cannot be updated even by direct SQL'
);
SELECT throws_ok(
  $$DELETE FROM public.coin_ledger
    WHERE id = (SELECT id FROM public.coin_ledger LIMIT 1)$$,
  '42501',
  NULL,
  'coin ledger rows cannot be deleted even by direct SQL'
);

SET LOCAL ROLE anon;
SELECT tests.clear_user_context();
SELECT is(
  (
    SELECT coin_rank
    FROM public.leaderboard
    WHERE id = '91111111-1111-4111-8111-111111111111'
  ),
  1::bigint,
  'coin leaderboard ranks the highest balance first'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM public.leaderboard
    WHERE id = '91111111-1111-4111-8111-111111111111'
      AND accuracy_bps = 10000
      AND accuracy_rank = 1
  ),
  'accuracy leaderboard ranks the perfect resolved record first'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM public.leaderboard
    WHERE id = '92222222-2222-4222-8222-222222222222'
      AND accuracy_bps = 0
      AND predictions_resolved = 1
  ),
  'leaderboard reports a losing resolved record as zero accuracy'
);
SELECT is(
  (
    SELECT total_volume
    FROM public.markets
    WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
  ),
  300::bigint,
  'market volume equals the sum of both accepted stakes'
);

RESET ROLE;
SELECT tests.clear_user_context();

INSERT INTO public.forecast_targets (
  id,
  market_id,
  key,
  label,
  unit,
  min_value,
  max_value,
  step,
  closes_at
)
VALUES (
  'dddddddd-dddd-4ddd-8ddd-ddddddddddd4',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
  'test_peak_ccu',
  'Test peak CCU',
  'players',
  0,
  1000000,
  1000,
  now() + interval '1 day'
);

INSERT INTO public.forecast_targets (
  id,
  market_id,
  key,
  label,
  unit,
  min_value,
  max_value,
  step,
  status,
  closes_at,
  resolved_value,
  resolved_at
)
VALUES (
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5',
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc3',
  'test_resolved_ccu',
  'Resolved test CCU',
  'players',
  0,
  1000000,
  1000,
  'resolved',
  now() - interval '1 day',
  100,
  now() - interval '2 hours'
);

INSERT INTO public.numeric_predictions (target_id, user_id, value)
VALUES
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5', '91111111-1111-4111-8111-111111111111', 100),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5', '92222222-2222-4222-8222-222222222222', 90);

SET LOCAL ROLE authenticated;
SELECT tests.set_user_context('91111111-1111-4111-8111-111111111111');
SELECT throws_ok(
  $$INSERT INTO public.numeric_predictions (target_id, user_id, value)
    VALUES (
      'dddddddd-dddd-4ddd-8ddd-ddddddddddd4',
      '91111111-1111-4111-8111-111111111111',
      12000
    )$$,
  '42501',
  NULL,
  'authenticated users cannot bypass the numeric forecast RPC'
);
SELECT lives_ok(
  $$SELECT public.upsert_numeric_prediction(
    'dddddddd-dddd-4ddd-8ddd-ddddddddddd4',
    12345
  )$$,
  'an authenticated user can save a numeric forecast through the RPC'
);
SELECT is(
  (
    SELECT value
    FROM public.numeric_predictions
    WHERE target_id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd4'
      AND user_id = '91111111-1111-4111-8111-111111111111'
  ),
  12345::numeric,
  'the numeric forecast RPC persists the supplied value'
);

RESET ROLE;
SET LOCAL ROLE anon;
SELECT tests.clear_user_context();
SELECT is(
  (
    SELECT prediction_count
    FROM public.get_forecast_summaries(
      ARRAY['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'::uuid]
    )
    WHERE target_id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd4'
  ),
  1::bigint,
  'public summaries expose the raw numeric forecast count without individual positions'
);
SELECT is(
  (
    SELECT rank
    FROM public.get_forecast_leaderboard('day')
    WHERE profile_id = '91111111-1111-4111-8111-111111111111'
  ),
  1::bigint,
  'daily numeric leaderboard ranks the most accurate forecast first'
);

RESET ROLE;
SELECT tests.clear_user_context();

INSERT INTO public.steam_games (
  steam_app_id,
  name,
  image_url,
  release_date,
  release_label,
  lifecycle_status,
  wishlist_rank,
  pre_release_rank,
  is_wishlisted,
  source_updated_at,
  is_popular_upcoming,
  popular_upcoming_position,
  steam_data_updated_at,
  released_at
)
VALUES
  (
    4739040,
    'DISCIPLINE SIMULATOR',
    'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/4739040/header.jpg',
    NULL,
    'TBA',
    'upcoming',
    7,
    7,
    true,
    now(),
    true,
    15,
    now(),
    NULL
  ),
  (
    9990001,
    'Removed Wishlist Game',
    'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/9990001/header.jpg',
    NULL,
    'TBA',
    'upcoming',
    NULL,
    900,
    false,
    now(),
    false,
    NULL,
    now(),
    NULL
  ),
  (
    9990002,
    'Completed Wishlist Game',
    'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/9990002/header.jpg',
    '2026-07-31',
    'July 31',
    'released',
    NULL,
    100,
    false,
    now(),
    false,
    NULL,
    now(),
    now()
  )
ON CONFLICT (steam_app_id) DO UPDATE
SET
  name = EXCLUDED.name,
  image_url = EXCLUDED.image_url,
  release_date = EXCLUDED.release_date,
  release_label = EXCLUDED.release_label,
  lifecycle_status = EXCLUDED.lifecycle_status,
  wishlist_rank = EXCLUDED.wishlist_rank,
  pre_release_rank = EXCLUDED.pre_release_rank,
  is_wishlisted = EXCLUDED.is_wishlisted,
  source_updated_at = EXCLUDED.source_updated_at,
  is_popular_upcoming = EXCLUDED.is_popular_upcoming,
  popular_upcoming_position = EXCLUDED.popular_upcoming_position,
  steam_data_updated_at = EXCLUDED.steam_data_updated_at,
  released_at = EXCLUDED.released_at;

INSERT INTO public.steam_bets (
  user_id,
  steam_app_id,
  target_key,
  value,
  game_name,
  release_date,
  release_label,
  image_url
)
VALUES
  (
    '91111111-1111-4111-8111-111111111111',
    9990001,
    'first_month_reviews',
    10,
    'Removed Wishlist Game',
    '2030-01-01',
    'January 1',
    'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/9990001/header.jpg'
  ),
  (
    '91111111-1111-4111-8111-111111111111',
    9990002,
    'first_month_reviews',
    20,
    'Completed Wishlist Game',
    '2026-07-31',
    'July 31',
    'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/9990002/header.jpg'
  );

SET LOCAL ROLE authenticated;
SELECT tests.set_user_context('91111111-1111-4111-8111-111111111111');
SELECT lives_ok(
  $$SELECT public.submit_steam_prediction(4739040, 'first_weekend_ccu', 100)$$,
  'a user can create a percentile forecast through the RPC'
);
SELECT is(
  (
    SELECT value
    FROM public.steam_bets
    WHERE steam_app_id = 4739040
      AND target_key = 'first_weekend_ccu'
  ),
  100::numeric,
  'the active projection stores the raw forecast'
);
SELECT is(
  (
    SELECT percentile_value
    FROM public.steam_bets
    WHERE steam_app_id = 4739040 AND target_key = 'first_weekend_ccu'
  ),
  14::numeric,
  'the fixed percentile model is applied at submission time'
);
SELECT lives_ok(
  $$SELECT public.submit_steam_prediction(4739040, 'first_weekend_ccu', 1000)$$,
  'a forecast can be edited before its market locks'
);
SELECT is(
  (
    SELECT value FROM public.steam_bets
    WHERE steam_app_id = 4739040 AND target_key = 'first_weekend_ccu'
  ),
  1000::numeric,
  'editing updates the active projection'
);
SELECT is(
  (
    SELECT count(*)::integer
    FROM public.steam_prediction_versions AS version
    JOIN public.steam_forecast_markets AS market ON market.id = version.market_id
    WHERE market.steam_app_id = 4739040
      AND market.metric_type = 'first_weekend_ccu'
      AND version.user_id = '91111111-1111-4111-8111-111111111111'
  ),
  2,
  'editing preserves both forecast versions'
);
SELECT throws_ok(
  $$UPDATE public.steam_bets
    SET value = 91
    WHERE steam_app_id = 4739040$$,
  '42501',
  NULL,
  'the active projection still cannot be updated directly'
);
SELECT throws_ok(
  $$DELETE FROM public.steam_bets
    WHERE steam_app_id = 4739040$$,
  '42501',
  NULL,
  'a locked Steam bet cannot be deleted'
);

SELECT tests.set_user_context('92222222-2222-4222-8222-222222222222');
SELECT lives_ok(
  $$SELECT public.submit_steam_prediction(4739040, 'first_weekend_ccu', 500)$$,
  'another user can submit to the same market'
);
SELECT is(
  (
    SELECT count(*)::integer
    FROM public.steam_bets
    WHERE steam_app_id = 4739040
  ),
  1,
  'RLS exposes only the caller Steam bet'
);
SELECT throws_ok(
  $$INSERT INTO public.steam_bets (user_id, steam_app_id, target_key, value)
    VALUES ('91111111-1111-4111-8111-111111111111', 4739040, 'first_month_reviews', 12)$$,
  '42501', NULL,
  'direct inserts cannot spoof another account'
);
SELECT throws_ok(
  $$SELECT public.submit_steam_prediction(9990001, 'full_price_us', 20)$$,
  'P0002', NULL,
  'the RPC rejects games outside TopWishlisted'
);

RESET ROLE;
SELECT tests.clear_user_context();

-- Backdate the controlled test history so two UTC snapshots can prove that an
-- edit starts affecting points only on the next snapshot.
UPDATE public.steam_scoring_config SET scoring_start_at = date_trunc('day', now()) - interval '2 days';
UPDATE public.steam_forecast_markets
SET scoring_start_at = date_trunc('day', now()) - interval '2 days'
WHERE steam_app_id = 4739040;

WITH ordered AS (
  SELECT version.id, version.raw_value
  FROM public.steam_prediction_versions AS version
  JOIN public.steam_forecast_markets AS market ON market.id = version.market_id
  WHERE market.steam_app_id = 4739040
    AND market.metric_type = 'first_weekend_ccu'
    AND version.user_id = '91111111-1111-4111-8111-111111111111'
)
UPDATE public.steam_prediction_versions AS version
SET
  valid_from = CASE ordered.raw_value
    WHEN 100 THEN date_trunc('day', now()) - interval '2 days'
    ELSE date_trunc('day', now()) - interval '12 hours'
  END,
  valid_to = CASE ordered.raw_value
    WHEN 100 THEN date_trunc('day', now()) - interval '12 hours'
    ELSE NULL
  END
FROM ordered WHERE ordered.id = version.id;

UPDATE public.steam_prediction_versions AS version
SET valid_from = date_trunc('day', now()) - interval '2 days'
FROM public.steam_forecast_markets AS market
WHERE market.id = version.market_id
  AND market.steam_app_id = 4739040
  AND market.metric_type = 'first_weekend_ccu'
  AND version.user_id = '92222222-2222-4222-8222-222222222222';

SELECT lives_ok(
  $$SELECT public.create_steam_market_snapshots(date_trunc('day', now()) - interval '1 day')$$,
  'the daily UTC snapshot job can reconstruct an eligible day idempotently'
);
SELECT lives_ok(
  $$SELECT public.create_steam_market_snapshots(date_trunc('day', now()))$$,
  'the current UTC snapshot is created'
);
SELECT is(
  (
    SELECT count(*)::integer FROM public.steam_market_daily_snapshots AS snapshot
    JOIN public.steam_forecast_markets AS market ON market.id = snapshot.market_id
    WHERE market.steam_app_id = 4739040 AND market.metric_type = 'first_weekend_ccu'
  ),
  2,
  'there are two immutable daily snapshots for the scored market'
);
SELECT results_eq(
  $$
    SELECT membership.raw_value
    FROM public.steam_market_snapshot_predictions AS membership
    JOIN public.steam_market_daily_snapshots AS snapshot ON snapshot.id = membership.snapshot_id
    JOIN public.steam_forecast_markets AS market ON market.id = snapshot.market_id
    WHERE market.steam_app_id = 4739040
      AND market.metric_type = 'first_weekend_ccu'
      AND membership.user_id = '91111111-1111-4111-8111-111111111111'
    ORDER BY snapshot.snapshot_date
  $$,
  $$VALUES (100::numeric), (1000::numeric)$$,
  'the old forecast scores on the first day and the edit begins on the next day'
);
SELECT results_eq(
  $$
    SELECT snapshot.eligible_prediction_count
    FROM public.steam_market_daily_snapshots AS snapshot
    JOIN public.steam_forecast_markets AS market ON market.id = snapshot.market_id
    WHERE market.steam_app_id = 4739040 AND market.metric_type = 'first_weekend_ccu'
    ORDER BY snapshot.snapshot_date
  $$,
  $$VALUES (2), (2)$$,
  'both days have enough players for leave-one-out scoring'
);

UPDATE public.steam_forecast_markets
SET status = 'locked'
WHERE steam_app_id = 4739040 AND metric_type = 'first_weekend_ccu';

SET LOCAL ROLE authenticated;
SELECT tests.set_user_context('92222222-2222-4222-8222-222222222222');
SELECT throws_ok(
  format(
    'SELECT public.resolve_steam_forecast_market(%L, 1000, %L, %L, NULL)',
    (SELECT id FROM public.steam_forecast_markets
      WHERE steam_app_id = 4739040 AND metric_type = 'first_weekend_ccu'),
    'test-source', now()
  ),
  '42501', NULL,
  'a non-admin cannot resolve a points market'
);

RESET ROLE;
INSERT INTO private.admin_users (user_id)
VALUES ('91111111-1111-4111-8111-111111111111') ON CONFLICT DO NOTHING;
SET LOCAL ROLE authenticated;
SELECT tests.set_user_context('91111111-1111-4111-8111-111111111111');
SELECT lives_ok(
  format(
    'SELECT public.resolve_steam_forecast_market(%L, 1000, %L, %L, NULL)',
    (SELECT id FROM public.steam_forecast_markets
      WHERE steam_app_id = 4739040 AND metric_type = 'first_weekend_ccu'),
    'test-source', date_trunc('second', now())
  ),
  'an admin can resolve a locked points market'
);

RESET ROLE;
SELECT is(
  (
    SELECT count(*)::integer FROM public.steam_prediction_score_entries AS entry
    JOIN public.steam_score_runs AS run ON run.id = entry.score_run_id AND run.is_current = true
    JOIN public.steam_forecast_markets AS market ON market.id = entry.market_id
    WHERE market.steam_app_id = 4739040 AND market.metric_type = 'first_weekend_ccu'
  ),
  4,
  'resolution writes one leave-one-out entry per eligible player-day'
);
SELECT is(
  (
    SELECT points FROM public.steam_user_leaderboard_stats
    WHERE user_id = '92222222-2222-4222-8222-222222222222' AND metric_type = 'all'
  ),
  4::numeric,
  'daily leave-one-out points are summed into the all-metrics leaderboard'
);
SELECT is(
  (
    SELECT sum(points) FROM public.steam_user_leaderboard_stats WHERE metric_type = 'all'
  ),
  0::numeric,
  'the two-player leave-one-out score is zero-sum for this fixture'
);

SET LOCAL ROLE authenticated;
SELECT tests.set_user_context('91111111-1111-4111-8111-111111111111');
SELECT lives_ok(
  format(
    'SELECT public.resolve_steam_forecast_market(%L, 1000, %L, %L, NULL)',
    (SELECT id FROM public.steam_forecast_markets
      WHERE steam_app_id = 4739040 AND metric_type = 'first_weekend_ccu'),
    'test-source',
    (SELECT resolved_at FROM public.steam_market_results AS result
      JOIN public.steam_forecast_markets AS market ON market.id = result.market_id
      WHERE market.steam_app_id = 4739040 AND result.is_current = true)
  ),
  'repeating an identical result is idempotent'
);
RESET ROLE;
SELECT is(
  (
    SELECT count(*)::integer FROM public.steam_market_results AS result
    JOIN public.steam_forecast_markets AS market ON market.id = result.market_id
    WHERE market.steam_app_id = 4739040 AND market.metric_type = 'first_weekend_ccu'
  ),
  1,
  'idempotent resolution does not create a second result version'
);

SET LOCAL ROLE authenticated;
SELECT tests.set_user_context('91111111-1111-4111-8111-111111111111');
SELECT lives_ok(
  format(
    'SELECT public.resolve_steam_forecast_market(%L, 500, %L, %L, %L)',
    (SELECT id FROM public.steam_forecast_markets
      WHERE steam_app_id = 4739040 AND metric_type = 'first_weekend_ccu'),
    'corrected-source', now(), 'fixture correction'
  ),
  'a corrected trusted result creates a new audited score run'
);
RESET ROLE;
SELECT ok(
  (
    SELECT count(*) = 2 AND count(*) FILTER (WHERE is_current) = 1
    FROM public.steam_market_results AS result
    JOIN public.steam_forecast_markets AS market ON market.id = result.market_id
    WHERE market.steam_app_id = 4739040 AND market.metric_type = 'first_weekend_ccu'
  )
  AND (
    SELECT count(*) = 2 AND count(*) FILTER (WHERE run.is_current) = 1
    FROM public.steam_score_runs AS run
    JOIN public.steam_forecast_markets AS market ON market.id = run.market_id
    WHERE market.steam_app_id = 4739040 AND market.metric_type = 'first_weekend_ccu'
  ),
  'correction keeps the old result and score run for audit while selecting one current version'
);
SELECT is(
  (
    SELECT points FROM public.steam_user_leaderboard_stats
    WHERE user_id = '92222222-2222-4222-8222-222222222222' AND metric_type = 'all'
  ),
  20::numeric,
  'leaderboard totals are rebuilt from the corrected current score run'
);

SET LOCAL ROLE authenticated;
SELECT tests.set_user_context('91111111-1111-4111-8111-111111111111');
SELECT ok(
  EXISTS (
    SELECT 1 FROM public.get_steam_points_leaderboard('all', 1, 0)
    WHERE is_current_user = true AND is_page_member = false
  ),
  'the current user is returned even when outside the requested leaderboard page'
);
SELECT lives_ok(
  format(
    'SELECT public.recalculate_steam_forecast_market(%L, %L)',
    (SELECT id FROM public.steam_forecast_markets
      WHERE steam_app_id = 4739040 AND metric_type = 'first_weekend_ccu'),
    'test replay'
  ),
  'an audited recalculation can be replayed without duplicating active points'
);
RESET ROLE;
SELECT is(
  (
    SELECT count(*)::integer FROM public.steam_score_runs AS run
    JOIN public.steam_forecast_markets AS market ON market.id = run.market_id
    WHERE market.steam_app_id = 4739040
      AND market.metric_type = 'first_weekend_ccu' AND run.is_current = true
  ),
  1,
  'exactly one score run remains current after recalculation'
);

UPDATE public.steam_forecast_markets SET status = 'locked'
WHERE steam_app_id = 4739040 AND metric_type = 'first_month_reviews';
SET LOCAL ROLE authenticated;
SELECT tests.set_user_context('92222222-2222-4222-8222-222222222222');
SELECT throws_ok(
  $$SELECT public.submit_steam_prediction(4739040, 'first_month_reviews', 12)$$,
  '22023', NULL,
  'submissions that race with market locking are rejected atomically'
);

RESET ROLE;
SELECT tests.clear_user_context();
SET LOCAL ROLE anon;
SELECT cmp_ok(
  (
    SELECT bet_count
    FROM public.get_steam_bet_trends()
    WHERE steam_app_id = 4739040
  ),
  '>=',
  2::bigint,
  'trending exposes aggregate bet counts without user positions'
);
SELECT is(
  (
    SELECT release_label
    FROM public.get_steam_bet_trends()
    WHERE steam_app_id = 4739040
  ),
  'TBA'::text,
  'trending reads the canonical catalog date instead of a bet snapshot'
);
SELECT is(
  (
    SELECT count(*)::integer
    FROM public.get_steam_bet_trends()
    WHERE steam_app_id = 9990001
  ),
  0,
  'trending excludes bets for games outside TopWishlisted'
);
SELECT is(
  (
    SELECT count(*)::integer
    FROM public.get_steam_bet_trends()
    WHERE steam_app_id = 9990002
  ),
  0,
  'trending excludes completed games after release'
);
RESET ROLE;
SELECT tests.clear_user_context();
SELECT * FROM finish();
ROLLBACK;
