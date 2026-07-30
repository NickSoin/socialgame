-- =============================================================================
-- Steam Prediction Market: declarative database schema
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";

CREATE SCHEMA IF NOT EXISTS private;

-- Remove the starter's permissive defaults before any new objects are created.
-- Every API-visible object receives an explicit grant later in this file.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA private
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role;

-- =============================================================================
-- Domain types
-- =============================================================================

CREATE TYPE public.avatar_id AS ENUM (
  'steam_blue',
  'neon_purple',
  'pixel_green',
  'ember_red',
  'golden_controller',
  'cyber_cat'
);

CREATE TYPE public.market_status AS ENUM ('open', 'resolved');
CREATE TYPE public.prediction_outcome AS ENUM ('yes', 'no');
CREATE TYPE public.coin_ledger_reason AS ENUM (
  'signup_bonus',
  'prediction_stake',
  'prediction_payout'
);

-- =============================================================================
-- Public profile and market data
-- =============================================================================

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  username text NOT NULL UNIQUE,
  display_name text NOT NULL,
  bio text NOT NULL DEFAULT '',
  avatar_id public.avatar_id NOT NULL DEFAULT 'steam_blue',
  links jsonb NOT NULL DEFAULT '{}'::jsonb,
  coin_balance bigint NOT NULL DEFAULT 1000,
  predictions_made integer NOT NULL DEFAULT 0,
  predictions_resolved integer NOT NULL DEFAULT 0,
  correct_predictions integer NOT NULL DEFAULT 0,
  coins_wagered bigint NOT NULL DEFAULT 0,
  coins_won bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_username_format_check CHECK (
    username = lower(username)
    AND username ~ '^[a-z0-9_]{3,24}$'
  ),
  CONSTRAINT profiles_display_name_length_check CHECK (
    char_length(btrim(display_name)) BETWEEN 1 AND 50
  ),
  CONSTRAINT profiles_bio_length_check CHECK (char_length(bio) <= 280),
  CONSTRAINT profiles_links_check CHECK (
    jsonb_typeof(links) = 'object'
    AND links - 'steam' - 'twitch' - 'youtube' - 'website' = '{}'::jsonb
    AND (
      links -> 'steam' IS NULL
      OR (
        jsonb_typeof(links -> 'steam') = 'string'
        AND char_length(links ->> 'steam') BETWEEN 8 AND 200
        AND links ->> 'steam' ~ '^https://'
      )
    )
    AND (
      links -> 'twitch' IS NULL
      OR (
        jsonb_typeof(links -> 'twitch') = 'string'
        AND char_length(links ->> 'twitch') BETWEEN 8 AND 200
        AND links ->> 'twitch' ~ '^https://'
      )
    )
    AND (
      links -> 'youtube' IS NULL
      OR (
        jsonb_typeof(links -> 'youtube') = 'string'
        AND char_length(links ->> 'youtube') BETWEEN 8 AND 200
        AND links ->> 'youtube' ~ '^https://'
      )
    )
    AND (
      links -> 'website' IS NULL
      OR (
        jsonb_typeof(links -> 'website') = 'string'
        AND char_length(links ->> 'website') BETWEEN 8 AND 200
        AND links ->> 'website' ~ '^https://'
      )
    )
  ),
  CONSTRAINT profiles_coin_balance_check CHECK (coin_balance >= 0),
  CONSTRAINT profiles_prediction_stats_check CHECK (
    predictions_made >= 0
    AND predictions_resolved >= 0
    AND correct_predictions >= 0
    AND correct_predictions <= predictions_resolved
    AND predictions_resolved <= predictions_made
  ),
  CONSTRAINT profiles_coin_stats_check CHECK (
    coins_wagered >= 0 AND coins_won >= 0
  )
);

CREATE TABLE private.admin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.markets (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  slug text NOT NULL UNIQUE,
  steam_app_id integer NOT NULL,
  steam_title text NOT NULL,
  question text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  status public.market_status NOT NULL DEFAULT 'open',
  yes_price_bps integer NOT NULL,
  total_volume bigint NOT NULL DEFAULT 0,
  closes_at timestamptz NOT NULL,
  resolved_outcome public.prediction_outcome,
  header_image_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CONSTRAINT markets_slug_format_check CHECK (
    slug = lower(slug)
    AND slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    AND char_length(slug) BETWEEN 3 AND 100
  ),
  CONSTRAINT markets_steam_app_id_check CHECK (steam_app_id > 0),
  CONSTRAINT markets_steam_title_length_check CHECK (
    char_length(btrim(steam_title)) BETWEEN 1 AND 120
  ),
  CONSTRAINT markets_question_length_check CHECK (
    char_length(btrim(question)) BETWEEN 10 AND 240
  ),
  CONSTRAINT markets_description_length_check CHECK (
    char_length(description) BETWEEN 1 AND 2000
  ),
  CONSTRAINT markets_category_length_check CHECK (
    char_length(btrim(category)) BETWEEN 2 AND 40
  ),
  CONSTRAINT markets_yes_price_bps_check CHECK (yes_price_bps BETWEEN 100 AND 9900),
  CONSTRAINT markets_total_volume_check CHECK (total_volume >= 0),
  CONSTRAINT markets_closes_after_creation_check CHECK (closes_at > created_at),
  CONSTRAINT markets_header_image_url_check CHECK (header_image_url ~ '^https://'),
  CONSTRAINT markets_resolution_state_check CHECK (
    (
      status = 'open'
      AND resolved_outcome IS NULL
      AND resolved_at IS NULL
    )
    OR (
      status = 'resolved'
      AND resolved_outcome IS NOT NULL
      AND resolved_at IS NOT NULL
    )
  )
);

CREATE INDEX markets_status_closes_at_idx
  ON public.markets (status, closes_at);

CREATE INDEX markets_steam_app_id_idx
  ON public.markets (steam_app_id);

-- =============================================================================
-- Prediction and coin accounting data
-- =============================================================================

CREATE TABLE public.predictions (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  market_id uuid NOT NULL REFERENCES public.markets (id) ON DELETE RESTRICT,
  outcome public.prediction_outcome NOT NULL,
  stake integer NOT NULL,
  price_bps integer NOT NULL,
  shares bigint NOT NULL,
  payout bigint NOT NULL DEFAULT 0,
  is_correct boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CONSTRAINT predictions_user_market_key UNIQUE (user_id, market_id),
  CONSTRAINT predictions_stake_check CHECK (stake BETWEEN 10 AND 1000000),
  CONSTRAINT predictions_price_bps_check CHECK (price_bps BETWEEN 100 AND 9900),
  CONSTRAINT predictions_shares_check CHECK (shares > 0),
  CONSTRAINT predictions_payout_check CHECK (payout >= 0),
  CONSTRAINT predictions_resolution_state_check CHECK (
    (
      is_correct IS NULL
      AND resolved_at IS NULL
      AND payout = 0
    )
    OR (
      is_correct IS NOT NULL
      AND resolved_at IS NOT NULL
      AND (
        (is_correct AND payout = shares)
        OR (NOT is_correct AND payout = 0)
      )
    )
  )
);

CREATE INDEX predictions_user_created_at_idx
  ON public.predictions (user_id, created_at DESC);

CREATE INDEX predictions_market_id_idx
  ON public.predictions (market_id);

CREATE TABLE public.coin_ledger (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id uuid NOT NULL,
  amount bigint NOT NULL,
  balance_after bigint NOT NULL,
  reason public.coin_ledger_reason NOT NULL,
  market_id uuid,
  prediction_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coin_ledger_amount_check CHECK (amount <> 0),
  CONSTRAINT coin_ledger_balance_after_check CHECK (balance_after >= 0),
  CONSTRAINT coin_ledger_reason_shape_check CHECK (
    (
      reason = 'signup_bonus'
      AND amount > 0
      AND market_id IS NULL
      AND prediction_id IS NULL
    )
    OR (
      reason = 'prediction_stake'
      AND amount < 0
      AND market_id IS NOT NULL
      AND prediction_id IS NOT NULL
    )
    OR (
      reason = 'prediction_payout'
      AND amount > 0
      AND market_id IS NOT NULL
      AND prediction_id IS NOT NULL
    )
  )
);

CREATE INDEX coin_ledger_user_created_at_idx
  ON public.coin_ledger (user_id, created_at DESC);

CREATE UNIQUE INDEX coin_ledger_prediction_reason_key
  ON public.coin_ledger (prediction_id, reason)
  WHERE prediction_id IS NOT NULL;

-- =============================================================================
-- Internal helpers and immutable-ledger guard
-- =============================================================================

CREATE OR REPLACE FUNCTION private.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := pg_catalog.now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.reject_coin_ledger_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'coin ledger entries are immutable'
    USING ERRCODE = '42501';
END;
$$;

CREATE OR REPLACE FUNCTION private.is_admin(candidate_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM private.admin_users
    WHERE user_id = candidate_user_id
  );
$$;

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER coin_ledger_reject_update_delete
  BEFORE UPDATE OR DELETE ON public.coin_ledger
  FOR EACH ROW
  EXECUTE FUNCTION private.reject_coin_ledger_mutation();

-- =============================================================================
-- Auth signup trigger
-- =============================================================================

CREATE OR REPLACE FUNCTION private.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  generated_username text;
  generated_display_name text;
BEGIN
  generated_username := 'player_' || pg_catalog.substr(
    pg_catalog.replace(NEW.id::text, '-', ''),
    1,
    12
  );

  generated_display_name := pg_catalog.left(
    COALESCE(
      NULLIF(pg_catalog.btrim(NEW.raw_user_meta_data ->> 'display_name'), ''),
      NULLIF(pg_catalog.btrim(NEW.raw_user_meta_data ->> 'full_name'), ''),
      'Steam Predictor'
    ),
    50
  );

  INSERT INTO public.profiles (
    id,
    username,
    display_name,
    coin_balance
  )
  VALUES (
    NEW.id,
    generated_username,
    generated_display_name,
    1000
  );

  INSERT INTO public.coin_ledger (
    user_id,
    amount,
    balance_after,
    reason
  )
  VALUES (
    NEW.id,
    1000,
    1000,
    'signup_bonus'
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION private.handle_new_user();

-- =============================================================================
-- Public RPCs: the only client-accessible mutations
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(private.is_admin(auth.uid()), false);
$$;

CREATE OR REPLACE FUNCTION public.update_own_profile(
  p_username text,
  p_display_name text,
  p_bio text,
  p_avatar_id text,
  p_links jsonb
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id uuid := auth.uid();
  updated_profile public.profiles%ROWTYPE;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles
  SET
    username = pg_catalog.lower(pg_catalog.btrim(p_username)),
    display_name = pg_catalog.btrim(p_display_name),
    bio = COALESCE(p_bio, ''),
    avatar_id = p_avatar_id::public.avatar_id,
    links = COALESCE(p_links, '{}'::jsonb)
  WHERE id = caller_id
  RETURNING * INTO updated_profile;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile not found' USING ERRCODE = 'P0002';
  END IF;

  RETURN updated_profile;
END;
$$;

CREATE OR REPLACE FUNCTION public.place_prediction(
  p_market_id uuid,
  p_outcome text,
  p_stake integer
)
RETURNS public.predictions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id uuid := auth.uid();
  chosen_outcome public.prediction_outcome;
  selected_market public.markets%ROWTYPE;
  current_profile public.profiles%ROWTYPE;
  outcome_price_bps integer;
  calculated_shares bigint;
  created_prediction public.predictions%ROWTYPE;
  new_balance bigint;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  CASE pg_catalog.lower(pg_catalog.btrim(p_outcome))
    WHEN 'yes' THEN chosen_outcome := 'yes';
    WHEN 'no' THEN chosen_outcome := 'no';
    ELSE
      RAISE EXCEPTION 'outcome must be yes or no' USING ERRCODE = '22023';
  END CASE;

  IF p_stake IS NULL OR p_stake NOT BETWEEN 10 AND 1000000 THEN
    RAISE EXCEPTION 'stake must be between 10 and 1000000 coins'
      USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO selected_market
  FROM public.markets
  WHERE id = p_market_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'market not found' USING ERRCODE = 'P0002';
  END IF;

  IF selected_market.status <> 'open' OR selected_market.closes_at <= pg_catalog.now() THEN
    RAISE EXCEPTION 'market is closed' USING ERRCODE = '55000';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.predictions
    WHERE user_id = caller_id AND market_id = p_market_id
  ) THEN
    RAISE EXCEPTION 'a prediction already exists for this market'
      USING ERRCODE = '23505';
  END IF;

  SELECT *
  INTO current_profile
  FROM public.profiles
  WHERE id = caller_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile not found' USING ERRCODE = 'P0002';
  END IF;

  IF current_profile.coin_balance < p_stake THEN
    RAISE EXCEPTION 'insufficient coin balance' USING ERRCODE = '22003';
  END IF;

  outcome_price_bps := CASE chosen_outcome
    WHEN 'yes' THEN selected_market.yes_price_bps
    WHEN 'no' THEN 10000 - selected_market.yes_price_bps
  END;

  calculated_shares := (p_stake::bigint * 10000) / outcome_price_bps;
  new_balance := current_profile.coin_balance - p_stake;

  INSERT INTO public.predictions (
    user_id,
    market_id,
    outcome,
    stake,
    price_bps,
    shares
  )
  VALUES (
    caller_id,
    p_market_id,
    chosen_outcome,
    p_stake,
    outcome_price_bps,
    calculated_shares
  )
  RETURNING * INTO created_prediction;

  UPDATE public.profiles
  SET
    coin_balance = new_balance,
    predictions_made = predictions_made + 1,
    coins_wagered = coins_wagered + p_stake
  WHERE id = caller_id;

  UPDATE public.markets
  SET total_volume = total_volume + p_stake
  WHERE id = p_market_id;

  INSERT INTO public.coin_ledger (
    user_id,
    amount,
    balance_after,
    reason,
    market_id,
    prediction_id
  )
  VALUES (
    caller_id,
    -p_stake,
    new_balance,
    'prediction_stake',
    p_market_id,
    created_prediction.id
  );

  RETURN created_prediction;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_market(
  p_market_id uuid,
  p_outcome text
)
RETURNS public.markets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id uuid := auth.uid();
  chosen_resolution public.prediction_outcome;
  selected_market public.markets%ROWTYPE;
BEGIN
  IF caller_id IS NULL OR NOT private.is_admin(caller_id) THEN
    RAISE EXCEPTION 'admin access required' USING ERRCODE = '42501';
  END IF;

  CASE pg_catalog.lower(pg_catalog.btrim(p_outcome))
    WHEN 'yes' THEN chosen_resolution := 'yes';
    WHEN 'no' THEN chosen_resolution := 'no';
    ELSE
      RAISE EXCEPTION 'outcome must be yes or no' USING ERRCODE = '22023';
  END CASE;

  SELECT *
  INTO selected_market
  FROM public.markets
  WHERE id = p_market_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'market not found' USING ERRCODE = 'P0002';
  END IF;

  IF selected_market.status = 'resolved' THEN
    IF selected_market.resolved_outcome = chosen_resolution THEN
      RETURN selected_market;
    END IF;

    RAISE EXCEPTION 'market was already resolved with another outcome'
      USING ERRCODE = '55000';
  END IF;

  IF selected_market.closes_at > pg_catalog.now() THEN
    RAISE EXCEPTION 'market has not closed yet' USING ERRCODE = '55000';
  END IF;

  UPDATE public.profiles AS profile
  SET
    coin_balance = profile.coin_balance + result.payout,
    predictions_resolved = profile.predictions_resolved + 1,
    correct_predictions = profile.correct_predictions + CASE WHEN result.is_correct THEN 1 ELSE 0 END,
    coins_won = profile.coins_won + result.payout
  FROM (
    SELECT
      prediction.user_id,
      prediction.outcome = chosen_resolution AS is_correct,
      CASE
        WHEN prediction.outcome = chosen_resolution THEN prediction.shares
        ELSE 0
      END AS payout
    FROM public.predictions AS prediction
    WHERE prediction.market_id = p_market_id
      AND prediction.resolved_at IS NULL
  ) AS result
  WHERE profile.id = result.user_id;

  UPDATE public.predictions AS prediction
  SET
    is_correct = prediction.outcome = chosen_resolution,
    payout = CASE
      WHEN prediction.outcome = chosen_resolution THEN prediction.shares
      ELSE 0
    END,
    resolved_at = pg_catalog.now()
  WHERE prediction.market_id = p_market_id
    AND prediction.resolved_at IS NULL;

  INSERT INTO public.coin_ledger (
    user_id,
    amount,
    balance_after,
    reason,
    market_id,
    prediction_id
  )
  SELECT
    prediction.user_id,
    prediction.payout,
    profile.coin_balance,
    'prediction_payout',
    prediction.market_id,
    prediction.id
  FROM public.predictions AS prediction
  JOIN public.profiles AS profile ON profile.id = prediction.user_id
  WHERE prediction.market_id = p_market_id
    AND prediction.is_correct
    AND prediction.payout > 0;

  UPDATE public.markets
  SET
    status = 'resolved',
    resolved_outcome = chosen_resolution,
    resolved_at = pg_catalog.now()
  WHERE id = p_market_id
  RETURNING * INTO selected_market;

  RETURN selected_market;
END;
$$;

-- =============================================================================
-- Safe public leaderboard projection
-- =============================================================================

CREATE VIEW public.leaderboard
WITH (security_invoker = true)
AS
SELECT
  profile.id,
  profile.username,
  profile.display_name,
  profile.avatar_id,
  profile.coin_balance,
  profile.predictions_made,
  profile.predictions_resolved,
  profile.correct_predictions,
  profile.coins_wagered,
  profile.coins_won,
  CASE
    WHEN profile.predictions_resolved = 0 THEN 0
    ELSE (profile.correct_predictions::bigint * 10000 / profile.predictions_resolved)::integer
  END AS accuracy_bps,
  dense_rank() OVER (
    ORDER BY profile.coin_balance DESC, profile.correct_predictions DESC, profile.created_at ASC
  ) AS coin_rank,
  dense_rank() OVER (
    ORDER BY
      CASE
        WHEN profile.predictions_resolved = 0 THEN 0
        ELSE profile.correct_predictions::numeric / profile.predictions_resolved
      END DESC,
      profile.correct_predictions DESC,
      profile.predictions_resolved DESC,
      profile.coin_balance DESC
  ) AS accuracy_rank
FROM public.profiles AS profile;

-- =============================================================================
-- Row Level Security
-- =============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.admin_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_public_read
  ON public.profiles
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY markets_public_read
  ON public.markets
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY predictions_read_own
  ON public.predictions
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY coin_ledger_read_own
  ON public.coin_ledger
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- =============================================================================
-- Least-privilege grants
-- =============================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

REVOKE ALL ON TABLE public.profiles FROM anon, authenticated;
REVOKE ALL ON TABLE public.markets FROM anon, authenticated;
REVOKE ALL ON TABLE public.predictions FROM anon, authenticated;
REVOKE ALL ON TABLE public.coin_ledger FROM anon, authenticated;
REVOKE ALL ON TABLE public.leaderboard FROM anon, authenticated;
REVOKE ALL ON TABLE public.coin_ledger FROM service_role;
REVOKE ALL ON TABLE public.leaderboard FROM service_role;

GRANT SELECT ON TABLE public.profiles TO anon, authenticated;
GRANT SELECT ON TABLE public.markets TO anon, authenticated;
GRANT SELECT ON TABLE public.predictions TO authenticated;
GRANT SELECT ON TABLE public.coin_ledger TO authenticated;
GRANT SELECT ON TABLE public.leaderboard TO anon, authenticated;

GRANT ALL ON TABLE public.profiles TO service_role;
GRANT ALL ON TABLE public.markets TO service_role;
GRANT ALL ON TABLE public.predictions TO service_role;
GRANT SELECT, INSERT ON TABLE public.coin_ledger TO service_role;
GRANT SELECT ON TABLE public.leaderboard TO service_role;

REVOKE ALL ON FUNCTION public.update_own_profile(text, text, text, text, jsonb)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.place_prediction(uuid, text, integer)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resolve_market(uuid, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_current_user_admin()
  FROM PUBLIC, anon, service_role;

GRANT EXECUTE ON FUNCTION public.update_own_profile(text, text, text, text, jsonb)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.place_prediction(uuid, text, integer)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resolve_market(uuid, text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_current_user_admin()
  TO authenticated;

REVOKE ALL ON FUNCTION private.set_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.reject_coin_ledger_mutation() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.handle_new_user() FROM PUBLIC;
