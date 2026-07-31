-- Numeric game forecasts for the coin-free MVP.

CREATE TABLE public.forecast_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id uuid NOT NULL REFERENCES public.markets(id) ON DELETE CASCADE,
  key text NOT NULL,
  label text NOT NULL,
  unit text NOT NULL,
  min_value numeric NOT NULL DEFAULT 0,
  max_value numeric,
  step numeric NOT NULL DEFAULT 1,
  display_order smallint NOT NULL DEFAULT 0,
  status public.market_status NOT NULL DEFAULT 'open',
  closes_at timestamptz NOT NULL,
  resolved_value numeric,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT forecast_targets_market_key_key UNIQUE (market_id, key),
  CONSTRAINT forecast_targets_key_check CHECK (key ~ '^[a-z0-9_]+$'),
  CONSTRAINT forecast_targets_label_check CHECK (char_length(label) BETWEEN 1 AND 80),
  CONSTRAINT forecast_targets_unit_check CHECK (unit IN ('players', 'reviews', 'usd', 'score')),
  CONSTRAINT forecast_targets_range_check CHECK (
    step > 0
    AND (max_value IS NULL OR max_value > min_value)
  ),
  CONSTRAINT forecast_targets_resolution_check CHECK (
    (status = 'open' AND resolved_value IS NULL AND resolved_at IS NULL)
    OR (status = 'resolved' AND resolved_value IS NOT NULL AND resolved_at IS NOT NULL)
  )
);

CREATE TABLE public.numeric_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id uuid NOT NULL REFERENCES public.forecast_targets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  value numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT numeric_predictions_user_target_key UNIQUE (user_id, target_id)
);

CREATE TABLE public.steam_bets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  steam_app_id bigint NOT NULL,
  target_key text NOT NULL,
  value numeric NOT NULL,
  game_name text,
  release_date text,
  release_label text,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT steam_bets_user_game_target_key UNIQUE (user_id, steam_app_id, target_key),
  CONSTRAINT steam_bets_app_id_check CHECK (steam_app_id > 0),
  CONSTRAINT steam_bets_target_key_check CHECK (
    target_key IN ('first_weekend_ccu', 'first_month_reviews', 'full_price_us')
  ),
  CONSTRAINT steam_bets_value_check CHECK (value >= 0 AND value <= 100000000),
  CONSTRAINT steam_bets_snapshot_check CHECK (
    (game_name IS NULL AND release_date IS NULL AND release_label IS NULL AND image_url IS NULL)
    OR
    (game_name IS NOT NULL AND release_date IS NOT NULL AND release_label IS NOT NULL AND image_url IS NOT NULL)
  )
);

-- Canonical Steam catalog mirrored from NickSoin/SteamTopWishlistsRank.
-- Only the service role writes this data; visitors receive a read-only catalog.
CREATE TABLE public.steam_games (
  steam_app_id bigint PRIMARY KEY,
  name text NOT NULL,
  image_url text NOT NULL,
  release_date date,
  release_label text NOT NULL DEFAULT 'TBA',
  lifecycle_status text NOT NULL DEFAULT 'upcoming',
  wishlist_rank integer,
  wishlist_estimate text,
  pre_release_rank integer,
  is_wishlisted boolean NOT NULL DEFAULT true,
  source text NOT NULL DEFAULT 'steam_wishlist_rank_v2',
  source_updated_at timestamptz NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_popular_upcoming boolean NOT NULL DEFAULT false,
  popular_upcoming_position integer,
  steam_data_updated_at timestamptz,
  tags text[] NOT NULL DEFAULT '{}'::text[],
  CONSTRAINT steam_games_app_id_check CHECK (steam_app_id > 0),
  CONSTRAINT steam_games_name_check CHECK (char_length(name) BETWEEN 1 AND 250),
  CONSTRAINT steam_games_image_url_check CHECK (image_url ~ '^https://'),
  CONSTRAINT steam_games_release_label_check CHECK (char_length(release_label) BETWEEN 1 AND 80),
  CONSTRAINT steam_games_lifecycle_check CHECK (lifecycle_status IN ('upcoming', 'released')),
  CONSTRAINT steam_games_wishlist_rank_check CHECK (
    wishlist_rank IS NULL OR wishlist_rank BETWEEN 1 AND 10000
  ),
  CONSTRAINT steam_games_pre_release_rank_check CHECK (
    pre_release_rank IS NULL OR pre_release_rank BETWEEN 1 AND 10000
  ),
  CONSTRAINT steam_games_release_state_check CHECK (
    (lifecycle_status = 'upcoming' AND released_at IS NULL)
    OR (lifecycle_status = 'released' AND released_at IS NOT NULL)
  ),
  CONSTRAINT steam_games_popular_position_check CHECK (
    (is_popular_upcoming = false AND popular_upcoming_position IS NULL)
    OR (
      is_popular_upcoming = true
      AND popular_upcoming_position BETWEEN 1 AND 200
    )
  )
);

CREATE TABLE public.steam_catalog_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_updated_at timestamptz NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'running',
  current_count integer NOT NULL DEFAULT 0,
  released_count integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  error_message text,
  CONSTRAINT steam_catalog_sync_runs_status_check CHECK (status IN ('running', 'success', 'error')),
  CONSTRAINT steam_catalog_sync_runs_counts_check CHECK (
    current_count >= 0 AND released_count >= 0
  ),
  CONSTRAINT steam_catalog_sync_runs_completion_check CHECK (
    (status = 'running' AND finished_at IS NULL)
    OR (status IN ('success', 'error') AND finished_at IS NOT NULL)
  )
);

CREATE INDEX forecast_targets_market_order_idx
  ON public.forecast_targets (market_id, status, display_order);

CREATE INDEX numeric_predictions_target_idx
  ON public.numeric_predictions (target_id);

CREATE INDEX numeric_predictions_user_updated_idx
  ON public.numeric_predictions (user_id, updated_at DESC);

CREATE INDEX steam_bets_user_created_idx
  ON public.steam_bets (user_id, created_at DESC);

CREATE INDEX steam_bets_app_created_idx
  ON public.steam_bets (steam_app_id, created_at DESC);

CREATE INDEX steam_games_current_rank_idx
  ON public.steam_games (lifecycle_status, is_wishlisted, wishlist_rank)
  WHERE lifecycle_status = 'upcoming' AND is_wishlisted = true;

CREATE INDEX steam_games_name_search_idx
  ON public.steam_games (lower(name) text_pattern_ops);

CREATE INDEX steam_games_source_updated_idx
  ON public.steam_games (source_updated_at DESC);

CREATE INDEX steam_games_popular_release_rank_idx
  ON public.steam_games (
    release_date ASC NULLS LAST,
    wishlist_rank ASC NULLS LAST,
    popular_upcoming_position ASC
  )
  WHERE lifecycle_status = 'upcoming'
    AND is_wishlisted = true
    AND is_popular_upcoming = true;

CREATE INDEX steam_catalog_sync_runs_started_idx
  ON public.steam_catalog_sync_runs (started_at DESC);

CREATE TRIGGER forecast_targets_set_updated_at
  BEFORE UPDATE ON public.forecast_targets
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER numeric_predictions_set_updated_at
  BEFORE UPDATE ON public.numeric_predictions
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER steam_games_set_updated_at
  BEFORE UPDATE ON public.steam_games
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

ALTER TABLE public.forecast_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.numeric_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.steam_bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.steam_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.steam_catalog_sync_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY forecast_targets_public_read
  ON public.forecast_targets
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY numeric_predictions_read_own
  ON public.numeric_predictions
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY steam_bets_read_own
  ON public.steam_bets
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY steam_bets_insert_own
  ON public.steam_bets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1
      FROM public.steam_games AS game
      WHERE game.steam_app_id = steam_bets.steam_app_id
        AND game.lifecycle_status = 'upcoming'
        AND game.is_wishlisted = true
    )
  );

CREATE POLICY steam_games_public_read
  ON public.steam_games
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE OR REPLACE FUNCTION public.upsert_numeric_prediction(
  p_target_id uuid,
  p_value numeric
)
RETURNS public.numeric_predictions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  target public.forecast_targets%ROWTYPE;
  saved_prediction public.numeric_predictions%ROWTYPE;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT *
  INTO target
  FROM public.forecast_targets
  WHERE id = p_target_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'forecast target not found' USING ERRCODE = 'P0002';
  END IF;

  IF target.status <> 'open' OR target.closes_at <= now() THEN
    RAISE EXCEPTION 'forecast target is closed' USING ERRCODE = '22023';
  END IF;

  IF p_value < target.min_value
     OR (target.max_value IS NOT NULL AND p_value > target.max_value) THEN
    RAISE EXCEPTION 'forecast value is outside the allowed range' USING ERRCODE = '22003';
  END IF;

  INSERT INTO public.numeric_predictions (target_id, user_id, value)
  VALUES (p_target_id, current_user_id, p_value)
  ON CONFLICT (user_id, target_id)
  DO UPDATE SET value = EXCLUDED.value
  RETURNING * INTO saved_prediction;

  RETURN saved_prediction;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_forecast_summaries(
  p_market_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  target_id uuid,
  raw_average numeric,
  weighted_average numeric,
  prediction_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH reputation AS (
    SELECT
      prediction.user_id,
      avg(
        greatest(
          0::numeric,
          1 - abs(prediction.value - target.resolved_value)
            / greatest(abs(target.resolved_value), 1)
        )
      ) AS accuracy
    FROM public.numeric_predictions AS prediction
    JOIN public.forecast_targets AS target ON target.id = prediction.target_id
    WHERE target.status = 'resolved'
    GROUP BY prediction.user_id
  )
  SELECT
    target.id,
    avg(prediction.value),
    sum(prediction.value * (1 + coalesce(reputation.accuracy, 0) * 2))
      / nullif(sum(1 + coalesce(reputation.accuracy, 0) * 2), 0),
    count(prediction.id)
  FROM public.forecast_targets AS target
  LEFT JOIN public.numeric_predictions AS prediction ON prediction.target_id = target.id
  LEFT JOIN reputation ON reputation.user_id = prediction.user_id
  WHERE target.status = 'open'
    AND (p_market_ids IS NULL OR target.market_id = ANY(p_market_ids))
  GROUP BY target.id;
$$;

CREATE OR REPLACE FUNCTION public.get_forecast_leaderboard(
  p_period text DEFAULT 'week'
)
RETURNS TABLE (
  rank bigint,
  profile_id uuid,
  username text,
  display_name text,
  avatar_id public.avatar_id,
  accuracy numeric,
  prediction_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH scored AS (
    SELECT
      prediction.user_id,
      greatest(
        0::numeric,
        100 - abs(prediction.value - target.resolved_value)
          / greatest(abs(target.resolved_value), 1) * 100
      ) AS score
    FROM public.numeric_predictions AS prediction
    JOIN public.forecast_targets AS target ON target.id = prediction.target_id
    WHERE target.status = 'resolved'
      AND target.resolved_at >= CASE p_period
        WHEN 'day' THEN now() - interval '1 day'
        WHEN 'month' THEN now() - interval '1 month'
        ELSE now() - interval '1 week'
      END
  ), totals AS (
    SELECT
      scored.user_id,
      avg(scored.score) AS accuracy,
      count(*) AS prediction_count
    FROM scored
    GROUP BY scored.user_id
  ), ranked AS (
    SELECT
      row_number() OVER (
        ORDER BY totals.accuracy DESC, totals.prediction_count DESC, profile.created_at ASC
      ) AS rank,
      profile.id AS profile_id,
      profile.username,
      profile.display_name,
      profile.avatar_id,
      totals.accuracy,
      totals.prediction_count
    FROM totals
    JOIN public.profiles AS profile ON profile.id = totals.user_id
  )
  SELECT * FROM ranked ORDER BY rank LIMIT 50;
$$;

CREATE OR REPLACE FUNCTION public.get_steam_bet_trends()
RETURNS TABLE (
  steam_app_id bigint,
  bet_count bigint,
  game_name text,
  release_date text,
  release_label text,
  image_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    bet.steam_app_id,
    count(*) AS bet_count,
    game.name AS game_name,
    game.release_date::text AS release_date,
    game.release_label,
    game.image_url
  FROM public.steam_bets AS bet
  JOIN public.steam_games AS game ON game.steam_app_id = bet.steam_app_id
  WHERE game.lifecycle_status = 'upcoming'
    AND game.is_wishlisted = true
  GROUP BY
    bet.steam_app_id,
    game.name,
    game.release_date,
    game.release_label,
    game.image_url
  ORDER BY count(*) DESC, max(bet.created_at) DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_steam_bet_summaries()
RETURNS TABLE (
  steam_app_id bigint,
  target_key text,
  average_value numeric,
  prediction_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    bet.steam_app_id,
    bet.target_key,
    avg(bet.value) AS average_value,
    count(*) AS prediction_count
  FROM public.steam_bets AS bet
  JOIN public.steam_games AS game ON game.steam_app_id = bet.steam_app_id
  WHERE game.lifecycle_status = 'upcoming'
    AND game.is_wishlisted = true
  GROUP BY bet.steam_app_id, bet.target_key
  ORDER BY bet.steam_app_id, bet.target_key;
$$;

REVOKE ALL ON TABLE public.forecast_targets FROM PUBLIC;
REVOKE ALL ON TABLE public.numeric_predictions FROM PUBLIC;
REVOKE ALL ON TABLE public.steam_bets FROM PUBLIC;
REVOKE ALL ON TABLE public.steam_games FROM PUBLIC;
REVOKE ALL ON TABLE public.steam_catalog_sync_runs FROM PUBLIC;
REVOKE ALL ON TABLE public.steam_bets FROM anon, authenticated;
REVOKE ALL ON TABLE public.steam_games FROM anon, authenticated;
REVOKE ALL ON TABLE public.steam_catalog_sync_runs FROM anon, authenticated;
GRANT SELECT ON TABLE public.forecast_targets TO anon, authenticated;
GRANT SELECT ON TABLE public.numeric_predictions TO authenticated;
GRANT SELECT, INSERT ON TABLE public.steam_bets TO authenticated;
GRANT SELECT ON TABLE public.steam_games TO anon, authenticated;
GRANT ALL ON TABLE public.forecast_targets TO service_role;
GRANT ALL ON TABLE public.numeric_predictions TO service_role;
GRANT ALL ON TABLE public.steam_bets TO service_role;
GRANT ALL ON TABLE public.steam_games TO service_role;
GRANT ALL ON TABLE public.steam_catalog_sync_runs TO service_role;

REVOKE ALL ON FUNCTION public.upsert_numeric_prediction(uuid, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_forecast_summaries(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_forecast_leaderboard(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_steam_bet_trends() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_steam_bet_summaries() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_numeric_prediction(uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_forecast_summaries(uuid[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_forecast_leaderboard(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_steam_bet_trends() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_steam_bet_summaries() TO anon, authenticated, service_role;
