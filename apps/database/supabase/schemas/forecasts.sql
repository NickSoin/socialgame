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
    target_key IN ('first_weekend_ccu', 'first_month_reviews', 'full_price_us', 'launch_discount')
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
  steam_data_attempted_at timestamptz,
  tags text[] NOT NULL DEFAULT '{}'::text[],
  release_text text,
  release_precision text NOT NULL DEFAULT 'tba',
  steam_coming_soon boolean,
  release_metadata_updated_at timestamptz,
  tag_source text NOT NULL DEFAULT 'none',
  tags_updated_at timestamptz,
  media_updated_at timestamptz,
  steam_app_type text,
  classification_updated_at timestamptz,
  follower_count bigint,
  followers_updated_at timestamptz,
  average_forecast_history jsonb NOT NULL DEFAULT '{}'::jsonb,
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
  ),
  CONSTRAINT steam_games_release_text_check CHECK (
    release_text IS NULL OR char_length(release_text) BETWEEN 1 AND 120
  ),
  CONSTRAINT steam_games_release_precision_check CHECK (
    release_precision IN ('exact', 'month', 'quarter', 'year', 'tba')
  ),
  CONSTRAINT steam_games_release_exactness_check CHECK (
    release_precision <> 'exact' OR release_date IS NOT NULL
  ),
  CONSTRAINT steam_games_tag_source_check CHECK (
    tag_source IN ('steam_store_tags', 'appdetails_genres_fallback', 'none')
  ),
  CONSTRAINT steam_games_tags_limit_check CHECK (cardinality(tags) <= 5),
  CONSTRAINT steam_games_app_type_check CHECK (
    steam_app_type IS NULL OR steam_app_type ~ '^[a-z0-9_]{1,40}$'
  ),
  CONSTRAINT steam_games_follower_count_check CHECK (
    follower_count IS NULL OR follower_count >= 0
  ),
  CONSTRAINT steam_games_average_forecast_history_check CHECK (
    jsonb_typeof(average_forecast_history) = 'object'
  ),
  CONSTRAINT steam_games_classification_check CHECK (
    (steam_app_type IS NULL AND classification_updated_at IS NULL)
    OR (steam_app_type IS NOT NULL AND classification_updated_at IS NOT NULL)
  )
);

CREATE TABLE public.steam_catalog_exclusions (
  steam_app_id bigint PRIMARY KEY,
  name text NOT NULL,
  reason text NOT NULL,
  steam_app_type text,
  release_date date,
  source text NOT NULL DEFAULT 'steam_appdetails',
  excluded_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT steam_catalog_exclusions_app_id_check CHECK (steam_app_id > 0),
  CONSTRAINT steam_catalog_exclusions_name_check CHECK (char_length(name) BETWEEN 1 AND 250),
  CONSTRAINT steam_catalog_exclusions_reason_check CHECK (
    reason IN ('released_before_cutoff', 'non_game')
  ),
  CONSTRAINT steam_catalog_exclusions_app_type_check CHECK (
    steam_app_type IS NULL OR steam_app_type ~ '^[a-z0-9_]{1,40}$'
  ),
  CONSTRAINT steam_catalog_exclusions_source_check CHECK (
    source IN ('steam_appdetails', 'catalog_cleanup')
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

-- Component state is deliberately separate from the public catalog. A successful
-- empty Steam response is terminal (`not_available`), while transport failures
-- remain retryable and never erase the last good catalog values.
CREATE TABLE public.steam_game_enrichment_state (
  steam_app_id bigint NOT NULL REFERENCES public.steam_games(steam_app_id) ON DELETE CASCADE,
  component text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  retry_after timestamptz,
  consecutive_failures integer NOT NULL DEFAULT 0,
  error_code text,
  error_message text,
  source_fingerprint text,
  source_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  lease_owner text,
  lease_expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (steam_app_id, component),
  CONSTRAINT steam_game_enrichment_state_component_check CHECK (
    component IN ('release', 'tags', 'media', 'followers')
  ),
  CONSTRAINT steam_game_enrichment_state_status_check CHECK (
    status IN ('pending', 'complete', 'partial', 'not_available', 'error')
  ),
  CONSTRAINT steam_game_enrichment_state_failure_check CHECK (consecutive_failures >= 0),
  CONSTRAINT steam_game_enrichment_state_error_code_check CHECK (
    error_code IS NULL OR char_length(error_code) BETWEEN 1 AND 80
  ),
  CONSTRAINT steam_game_enrichment_state_error_message_check CHECK (
    error_message IS NULL OR char_length(error_message) BETWEEN 1 AND 500
  ),
  CONSTRAINT steam_game_enrichment_state_lease_check CHECK (
    (lease_owner IS NULL AND lease_expires_at IS NULL)
    OR (lease_owner IS NOT NULL AND lease_expires_at IS NOT NULL)
  )
);

CREATE TABLE public.steam_game_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  steam_app_id bigint NOT NULL REFERENCES public.steam_games(steam_app_id) ON DELETE CASCADE,
  kind text NOT NULL,
  position smallint NOT NULL,
  original_source_url text NOT NULL,
  storage_bucket text NOT NULL,
  storage_path text NOT NULL,
  mime_type text NOT NULL,
  byte_size integer NOT NULL,
  width integer NOT NULL,
  height integer NOT NULL,
  checksum_sha256 text NOT NULL,
  encoder_quality smallint NOT NULL,
  source_updated_at timestamptz,
  processed_at timestamptz NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT steam_game_media_kind_check CHECK (kind = 'screenshot'),
  CONSTRAINT steam_game_media_position_check CHECK (position BETWEEN 1 AND 2),
  CONSTRAINT steam_game_media_source_url_check CHECK (original_source_url ~ '^https://'),
  CONSTRAINT steam_game_media_bucket_check CHECK (storage_bucket = 'steam-game-media'),
  CONSTRAINT steam_game_media_path_check CHECK (
    storage_path ~ '^[1-9][0-9]*/screenshots/[12]-[a-f0-9]{12}[.]webp$'
  ),
  CONSTRAINT steam_game_media_mime_check CHECK (mime_type = 'image/webp'),
  CONSTRAINT steam_game_media_size_check CHECK (byte_size BETWEEN 1 AND 25600),
  CONSTRAINT steam_game_media_dimensions_check CHECK (width > 0 AND height > 0 AND width <= 540),
  CONSTRAINT steam_game_media_checksum_check CHECK (checksum_sha256 ~ '^[a-f0-9]{64}$'),
  CONSTRAINT steam_game_media_quality_check CHECK (encoder_quality BETWEEN 1 AND 100),
  CONSTRAINT steam_game_media_storage_path_key UNIQUE (storage_bucket, storage_path)
);

CREATE TABLE public.steam_game_release_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  steam_app_id bigint NOT NULL REFERENCES public.steam_games(steam_app_id) ON DELETE CASCADE,
  previous_release_date date,
  next_release_date date,
  previous_release_text text,
  next_release_text text,
  previous_precision text NOT NULL,
  next_precision text NOT NULL,
  previous_coming_soon boolean,
  next_coming_soon boolean,
  observed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT steam_game_release_transitions_previous_precision_check CHECK (
    previous_precision IN ('exact', 'month', 'quarter', 'year', 'tba')
  ),
  CONSTRAINT steam_game_release_transitions_next_precision_check CHECK (
    next_precision IN ('exact', 'month', 'quarter', 'year', 'tba')
  )
);

CREATE TABLE public.steam_enrichment_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id text NOT NULL,
  status text NOT NULL DEFAULT 'running',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  selected_count integer NOT NULL DEFAULT 0,
  succeeded_count integer NOT NULL DEFAULT 0,
  partial_count integer NOT NULL DEFAULT 0,
  unavailable_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  released_count integer NOT NULL DEFAULT 0,
  uploaded_count integer NOT NULL DEFAULT 0,
  skipped_unchanged_count integer NOT NULL DEFAULT 0,
  still_pending_count integer NOT NULL DEFAULT 0,
  error_message text,
  excluded_count integer NOT NULL DEFAULT 0,
  CONSTRAINT steam_enrichment_runs_status_check CHECK (
    status IN ('running', 'success', 'partial', 'error', 'already_running')
  ),
  CONSTRAINT steam_enrichment_runs_counts_check CHECK (
    selected_count >= 0 AND succeeded_count >= 0 AND partial_count >= 0
    AND unavailable_count >= 0 AND failed_count >= 0 AND released_count >= 0
    AND uploaded_count >= 0 AND skipped_unchanged_count >= 0 AND still_pending_count >= 0
    AND excluded_count >= 0
  ),
  CONSTRAINT steam_enrichment_runs_completion_check CHECK (
    (status = 'running' AND finished_at IS NULL)
    OR (status <> 'running' AND finished_at IS NOT NULL)
  ),
  CONSTRAINT steam_enrichment_runs_error_message_check CHECK (
    error_message IS NULL OR char_length(error_message) <= 1000
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

CREATE INDEX steam_games_details_refresh_idx
  ON public.steam_games (steam_data_attempted_at ASC NULLS FIRST, wishlist_rank ASC NULLS LAST)
  WHERE lifecycle_status = 'upcoming' AND is_wishlisted = true;

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

CREATE INDEX steam_catalog_exclusions_reason_idx
  ON public.steam_catalog_exclusions (reason, excluded_at DESC);

CREATE UNIQUE INDEX steam_game_media_active_position_idx
  ON public.steam_game_media (steam_app_id, kind, position)
  WHERE active = true;

CREATE INDEX steam_game_media_active_catalog_idx
  ON public.steam_game_media (steam_app_id, position)
  WHERE active = true;

CREATE INDEX steam_game_enrichment_retry_idx
  ON public.steam_game_enrichment_state (
    component, status, retry_after ASC NULLS FIRST, lease_expires_at ASC NULLS FIRST
  )
  WHERE status IN ('pending', 'error', 'partial');

CREATE INDEX steam_game_release_transitions_game_idx
  ON public.steam_game_release_transitions (steam_app_id, observed_at DESC);

CREATE INDEX steam_enrichment_runs_started_idx
  ON public.steam_enrichment_runs (started_at DESC);

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

CREATE TRIGGER steam_game_enrichment_state_set_updated_at
  BEFORE UPDATE ON public.steam_game_enrichment_state
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

ALTER TABLE public.forecast_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.numeric_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.steam_bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.steam_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.steam_catalog_exclusions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.steam_catalog_sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.steam_game_enrichment_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.steam_game_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.steam_game_release_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.steam_enrichment_runs ENABLE ROW LEVEL SECURITY;

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

CREATE POLICY steam_game_media_public_read
  ON public.steam_game_media
  FOR SELECT
  TO anon, authenticated
  USING (active = true);

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

CREATE OR REPLACE FUNCTION public.claim_steam_media_jobs(
  p_limit integer,
  p_worker_id text,
  p_lease_seconds integer DEFAULT 900,
  p_app_id bigint DEFAULT NULL
)
RETURNS TABLE (
  steam_app_id bigint,
  source_payload jsonb,
  source_fingerprint text,
  consecutive_failures integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_limit < 1 OR p_limit > 100 OR p_lease_seconds < 60 OR p_lease_seconds > 3600
    OR nullif(trim(p_worker_id), '') IS NULL THEN
    RAISE EXCEPTION 'invalid media claim parameters' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT state.steam_app_id
    FROM public.steam_game_enrichment_state AS state
    JOIN public.steam_games AS game ON game.steam_app_id = state.steam_app_id
    WHERE state.component = 'media'
      AND state.status IN ('pending', 'partial', 'error')
      AND (state.retry_after IS NULL OR state.retry_after <= now())
      AND (state.lease_expires_at IS NULL OR state.lease_expires_at <= now())
      AND game.is_wishlisted = true
      AND game.lifecycle_status = 'upcoming'
      AND (p_app_id IS NULL OR state.steam_app_id = p_app_id)
    ORDER BY
      CASE
        WHEN game.is_popular_upcoming THEN 0
        WHEN EXISTS (
          SELECT 1 FROM public.steam_bets AS bet
          WHERE bet.steam_app_id = game.steam_app_id
        ) THEN 1
        WHEN game.release_date BETWEEN current_date AND current_date + 14 THEN 2
        ELSE 3
      END,
      state.last_success_at ASC NULLS FIRST,
      game.wishlist_rank ASC NULLS LAST
    FOR UPDATE OF state SKIP LOCKED
    LIMIT p_limit
  ), claimed AS (
    UPDATE public.steam_game_enrichment_state AS state
    SET
      lease_owner = p_worker_id,
      lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      last_attempt_at = now()
    FROM candidates
    WHERE state.steam_app_id = candidates.steam_app_id
      AND state.component = 'media'
    RETURNING state.steam_app_id, state.source_payload, state.source_fingerprint,
      state.consecutive_failures
  )
  SELECT claimed.steam_app_id, claimed.source_payload, claimed.source_fingerprint,
    claimed.consecutive_failures
  FROM claimed;
END;
$$;

CREATE OR REPLACE FUNCTION public.publish_steam_game_media(
  p_steam_app_id bigint,
  p_position smallint,
  p_original_source_url text,
  p_storage_bucket text,
  p_storage_path text,
  p_byte_size integer,
  p_width integer,
  p_height integer,
  p_checksum_sha256 text,
  p_encoder_quality smallint,
  p_source_updated_at timestamptz DEFAULT NULL
)
RETURNS TABLE (previous_storage_bucket text, previous_storage_path text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_media_id uuid;
  previous_bucket text;
  previous_path text;
BEGIN
  SELECT media.storage_bucket, media.storage_path
  INTO previous_bucket, previous_path
  FROM public.steam_game_media AS media
  WHERE media.steam_app_id = p_steam_app_id
    AND media.kind = 'screenshot'
    AND media.position = p_position
    AND media.active = true
  FOR UPDATE;

  IF previous_bucket = p_storage_bucket AND previous_path = p_storage_path THEN
    RETURN QUERY SELECT previous_bucket, previous_path;
    RETURN;
  END IF;

  INSERT INTO public.steam_game_media (
    steam_app_id, kind, position, original_source_url, storage_bucket, storage_path,
    mime_type, byte_size, width, height, checksum_sha256, encoder_quality,
    source_updated_at, active
  ) VALUES (
    p_steam_app_id, 'screenshot', p_position, p_original_source_url,
    p_storage_bucket, p_storage_path, 'image/webp', p_byte_size, p_width, p_height,
    p_checksum_sha256, p_encoder_quality, p_source_updated_at, false
  )
  RETURNING id INTO new_media_id;

  UPDATE public.steam_game_media
  SET active = false
  WHERE steam_app_id = p_steam_app_id
    AND kind = 'screenshot'
    AND position = p_position
    AND active = true;

  UPDATE public.steam_game_media SET active = true WHERE id = new_media_id;
  UPDATE public.steam_games SET media_updated_at = now() WHERE steam_games.steam_app_id = p_steam_app_id;

  RETURN QUERY SELECT previous_bucket, previous_path;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_steam_game_data_quality_report()
RETURNS TABLE (
  total_games bigint,
  exact_release_count bigint,
  partial_release_count bigint,
  tba_release_count bigint,
  five_tags_count bigint,
  one_to_four_tags_count bigint,
  fallback_tags_count bigint,
  missing_tags_count bigint,
  two_screenshots_count bigint,
  one_screenshot_count bigint,
  media_unavailable_count bigint,
  media_pending_count bigint,
  media_failed_count bigint,
  stale_release_count bigint,
  stale_tag_count bigint,
  stale_media_count bigint,
  oldest_pending_at timestamptz,
  most_recent_successful_run_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH active_games AS (
    SELECT game.*
    FROM public.steam_games AS game
    WHERE game.is_wishlisted = true AND game.lifecycle_status = 'upcoming'
  ), media_counts AS (
    SELECT media.steam_app_id, count(*) FILTER (WHERE media.active)::integer AS media_count
    FROM public.steam_game_media AS media
    GROUP BY media.steam_app_id
  ), component_state AS (
    SELECT state.steam_app_id,
      max(state.status) FILTER (WHERE state.component = 'media') AS media_status,
      min(coalesce(state.last_attempt_at, game.first_seen_at))
        FILTER (WHERE state.status IN ('pending', 'partial', 'error')) AS pending_at
    FROM public.steam_game_enrichment_state AS state
    JOIN active_games AS game ON game.steam_app_id = state.steam_app_id
    GROUP BY state.steam_app_id
  )
  SELECT
    count(*),
    count(*) FILTER (WHERE game.release_precision = 'exact'),
    count(*) FILTER (WHERE game.release_precision IN ('month', 'quarter', 'year')),
    count(*) FILTER (WHERE game.release_precision = 'tba'),
    count(*) FILTER (WHERE cardinality(game.tags) = 5 AND game.tag_source = 'steam_store_tags'),
    count(*) FILTER (WHERE cardinality(game.tags) BETWEEN 1 AND 4 AND game.tag_source = 'steam_store_tags'),
    count(*) FILTER (WHERE game.tag_source = 'appdetails_genres_fallback'),
    count(*) FILTER (WHERE cardinality(game.tags) = 0 OR game.tag_source = 'none'),
    count(*) FILTER (WHERE coalesce(media.media_count, 0) = 2),
    count(*) FILTER (WHERE coalesce(media.media_count, 0) = 1),
    count(*) FILTER (WHERE state.media_status = 'not_available'),
    count(*) FILTER (WHERE state.media_status IN ('pending', 'partial') OR state.media_status IS NULL),
    count(*) FILTER (WHERE state.media_status = 'error'),
    count(*) FILTER (
      WHERE game.release_metadata_updated_at IS NULL
        OR game.release_metadata_updated_at < now() - interval '30 hours'
    ),
    count(*) FILTER (
      WHERE game.tags_updated_at IS NULL OR game.tags_updated_at < now() - interval '8 days'
    ),
    count(*) FILTER (
      WHERE game.media_updated_at IS NULL OR game.media_updated_at < now() - interval '8 days'
    ),
    min(state.pending_at),
    (SELECT max(run.finished_at) FROM public.steam_enrichment_runs AS run
      WHERE run.status IN ('success', 'partial'))
  FROM active_games AS game
  LEFT JOIN media_counts AS media ON media.steam_app_id = game.steam_app_id
  LEFT JOIN component_state AS state ON state.steam_app_id = game.steam_app_id;
$$;

REVOKE ALL ON TABLE public.forecast_targets FROM PUBLIC;
REVOKE ALL ON TABLE public.numeric_predictions FROM PUBLIC;
REVOKE ALL ON TABLE public.steam_bets FROM PUBLIC;
REVOKE ALL ON TABLE public.steam_games FROM PUBLIC;
REVOKE ALL ON TABLE public.steam_catalog_exclusions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.steam_catalog_sync_runs FROM PUBLIC;
REVOKE ALL ON TABLE public.steam_game_enrichment_state FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.steam_game_media FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.steam_game_release_transitions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.steam_enrichment_runs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.steam_bets FROM anon, authenticated;
REVOKE ALL ON TABLE public.steam_games FROM anon, authenticated;
REVOKE ALL ON TABLE public.steam_catalog_sync_runs FROM anon, authenticated;
GRANT SELECT ON TABLE public.forecast_targets TO anon, authenticated;
GRANT SELECT ON TABLE public.numeric_predictions TO authenticated;
GRANT SELECT, INSERT ON TABLE public.steam_bets TO authenticated;
GRANT SELECT ON TABLE public.steam_games TO anon, authenticated;
GRANT SELECT ON TABLE public.steam_game_media TO anon, authenticated;
GRANT ALL ON TABLE public.forecast_targets TO service_role;
GRANT ALL ON TABLE public.numeric_predictions TO service_role;
GRANT ALL ON TABLE public.steam_bets TO service_role;
GRANT ALL ON TABLE public.steam_games TO service_role;
GRANT ALL ON TABLE public.steam_catalog_exclusions TO service_role;
GRANT ALL ON TABLE public.steam_catalog_sync_runs TO service_role;
GRANT ALL ON TABLE public.steam_game_enrichment_state TO service_role;
GRANT ALL ON TABLE public.steam_game_media TO service_role;
GRANT ALL ON TABLE public.steam_game_release_transitions TO service_role;
GRANT ALL ON TABLE public.steam_enrichment_runs TO service_role;

REVOKE ALL ON FUNCTION public.upsert_numeric_prediction(uuid, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_forecast_summaries(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_forecast_leaderboard(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_steam_bet_trends() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_steam_bet_summaries() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_steam_media_jobs(integer, text, integer, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.publish_steam_game_media(bigint, smallint, text, text, text, integer, integer, integer, text, smallint, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_steam_game_data_quality_report() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_numeric_prediction(uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_forecast_summaries(uuid[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_forecast_leaderboard(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_steam_bet_trends() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_steam_bet_summaries() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_steam_media_jobs(integer, text, integer, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.publish_steam_game_media(bigint, smallint, text, text, text, integer, integer, integer, text, smallint, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_steam_game_data_quality_report() TO service_role;

-- =============================================================================
-- NextHit points system
-- =============================================================================

-- A model is an immutable empirical distribution. Markets keep the exact model
-- version they opened with, so changing a reference dataset never changes old
-- forecasts or scores.
CREATE TABLE public.steam_percentile_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type text NOT NULL,
  model_version integer NOT NULL,
  dataset_reference text NOT NULL,
  sample_size integer NOT NULL,
  reference_values numeric[] NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT steam_percentile_models_metric_check CHECK (
    metric_type IN ('first_weekend_ccu', 'first_month_reviews', 'full_price_us', 'launch_discount')
  ),
  CONSTRAINT steam_percentile_models_version_check CHECK (model_version > 0),
  CONSTRAINT steam_percentile_models_values_check CHECK (
    sample_size = cardinality(reference_values) AND sample_size >= 10
  ),
  CONSTRAINT steam_percentile_models_metric_version_key UNIQUE (metric_type, model_version)
);

CREATE UNIQUE INDEX steam_percentile_models_active_idx
  ON public.steam_percentile_models (metric_type)
  WHERE is_active = true;

CREATE TABLE public.steam_scoring_config (
  singleton boolean PRIMARY KEY DEFAULT true,
  scoring_start_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT steam_scoring_config_singleton_check CHECK (singleton = true)
);

CREATE TABLE public.steam_forecast_markets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  steam_app_id bigint NOT NULL REFERENCES public.steam_games(steam_app_id) ON DELETE RESTRICT,
  metric_type text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  lock_at timestamptz,
  resolve_after timestamptz,
  source_release_date date,
  percentile_model_id uuid NOT NULL REFERENCES public.steam_percentile_models(id) ON DELETE RESTRICT,
  percentile_model_version integer NOT NULL,
  scoring_start_at timestamptz NOT NULL,
  resolution_attempt_count integer NOT NULL DEFAULT 0,
  resolution_last_attempt_at timestamptz,
  resolution_next_retry_at timestamptz,
  resolution_last_error text,
  void_reason text,
  voided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT steam_forecast_markets_game_metric_key UNIQUE (steam_app_id, metric_type),
  CONSTRAINT steam_forecast_markets_metric_check CHECK (
    metric_type IN ('first_weekend_ccu', 'first_month_reviews', 'full_price_us', 'launch_discount')
  ),
  CONSTRAINT steam_forecast_markets_status_check CHECK (
    status IN ('open', 'locked', 'resolved', 'void')
  ),
  CONSTRAINT steam_forecast_markets_resolution_attempt_count_check CHECK (
    resolution_attempt_count >= 0
  ),
  CONSTRAINT steam_forecast_markets_resolution_last_error_check CHECK (
    resolution_last_error IS NULL OR char_length(resolution_last_error) <= 1000
  ),
  CONSTRAINT steam_forecast_markets_void_check CHECK (
    (status = 'void' AND void_reason IS NOT NULL AND voided_at IS NOT NULL)
    OR (status <> 'void')
  )
);

ALTER TABLE public.steam_bets
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN percentile_value numeric,
  ADD COLUMN percentile_model_version integer;

CREATE TABLE public.steam_prediction_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id uuid NOT NULL REFERENCES public.steam_forecast_markets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  raw_value numeric NOT NULL,
  percentile_value numeric NOT NULL,
  percentile_model_version integer NOT NULL,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT steam_prediction_versions_raw_check CHECK (raw_value >= 0),
  CONSTRAINT steam_prediction_versions_percentile_check CHECK (
    percentile_value BETWEEN 0 AND 100
  ),
  CONSTRAINT steam_prediction_versions_validity_check CHECK (
    valid_to IS NULL OR valid_to >= valid_from
  )
);

CREATE UNIQUE INDEX steam_prediction_versions_active_idx
  ON public.steam_prediction_versions (market_id, user_id)
  WHERE valid_to IS NULL;

CREATE INDEX steam_prediction_versions_history_idx
  ON public.steam_prediction_versions (market_id, user_id, valid_from DESC);

CREATE TABLE public.steam_market_daily_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id uuid NOT NULL REFERENCES public.steam_forecast_markets(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL,
  snapshot_at timestamptz NOT NULL,
  eligible_prediction_count integer NOT NULL DEFAULT 0,
  crowd_percentile numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT steam_market_daily_snapshots_key UNIQUE (market_id, snapshot_date),
  CONSTRAINT steam_market_daily_snapshots_midnight_check CHECK (
    snapshot_at = date_trunc('day', snapshot_at AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
  ),
  CONSTRAINT steam_market_daily_snapshots_count_check CHECK (eligible_prediction_count >= 0),
  CONSTRAINT steam_market_daily_snapshots_percentile_check CHECK (
    crowd_percentile IS NULL OR crowd_percentile BETWEEN 0 AND 100
  )
);

CREATE TABLE public.steam_market_snapshot_predictions (
  snapshot_id uuid NOT NULL REFERENCES public.steam_market_daily_snapshots(id) ON DELETE CASCADE,
  prediction_version_id uuid NOT NULL REFERENCES public.steam_prediction_versions(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  raw_value numeric NOT NULL,
  percentile_value numeric NOT NULL,
  PRIMARY KEY (snapshot_id, user_id),
  CONSTRAINT steam_market_snapshot_predictions_percentile_check CHECK (
    percentile_value BETWEEN 0 AND 100
  )
);

CREATE TABLE public.steam_market_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id uuid NOT NULL REFERENCES public.steam_forecast_markets(id) ON DELETE CASCADE,
  result_version integer NOT NULL,
  actual_raw_value numeric NOT NULL,
  actual_percentile_value numeric NOT NULL,
  source_reference text NOT NULL,
  resolved_at timestamptz NOT NULL,
  correction_note text,
  is_current boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT steam_market_results_version_key UNIQUE (market_id, result_version),
  CONSTRAINT steam_market_results_raw_check CHECK (actual_raw_value >= 0),
  CONSTRAINT steam_market_results_percentile_check CHECK (
    actual_percentile_value BETWEEN 0 AND 100
  )
);

CREATE UNIQUE INDEX steam_market_results_current_idx
  ON public.steam_market_results (market_id)
  WHERE is_current = true;

CREATE TABLE public.steam_score_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id uuid NOT NULL REFERENCES public.steam_forecast_markets(id) ON DELETE CASCADE,
  result_id uuid NOT NULL REFERENCES public.steam_market_results(id) ON DELETE RESTRICT,
  run_version integer NOT NULL,
  reason text NOT NULL,
  is_current boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT steam_score_runs_version_key UNIQUE (market_id, run_version)
);

CREATE UNIQUE INDEX steam_score_runs_current_idx
  ON public.steam_score_runs (market_id)
  WHERE is_current = true;

CREATE TABLE public.steam_prediction_score_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  score_run_id uuid NOT NULL REFERENCES public.steam_score_runs(id) ON DELETE CASCADE,
  market_id uuid NOT NULL REFERENCES public.steam_forecast_markets(id) ON DELETE CASCADE,
  snapshot_id uuid NOT NULL REFERENCES public.steam_market_daily_snapshots(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_percentile numeric NOT NULL,
  crowd_without_user_percentile numeric NOT NULL,
  actual_percentile numeric NOT NULL,
  points numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT steam_prediction_score_entries_key UNIQUE (score_run_id, snapshot_id, user_id),
  CONSTRAINT steam_prediction_score_entries_user_percentile_check CHECK (
    user_percentile BETWEEN 0 AND 100
  ),
  CONSTRAINT steam_prediction_score_entries_crowd_percentile_check CHECK (
    crowd_without_user_percentile BETWEEN 0 AND 100
  ),
  CONSTRAINT steam_prediction_score_entries_actual_percentile_check CHECK (
    actual_percentile BETWEEN 0 AND 100
  )
);

CREATE INDEX steam_prediction_score_entries_user_idx
  ON public.steam_prediction_score_entries (user_id, market_id);

CREATE TABLE public.steam_user_leaderboard_stats (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  metric_type text NOT NULL,
  points numeric NOT NULL DEFAULT 0,
  scored_days integer NOT NULL DEFAULT 0,
  resolved_markets integer NOT NULL DEFAULT 0,
  rank_position bigint NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, metric_type),
  CONSTRAINT steam_user_leaderboard_stats_metric_check CHECK (
    metric_type IN ('all', 'first_weekend_ccu', 'first_month_reviews', 'full_price_us', 'launch_discount')
  ),
  CONSTRAINT steam_user_leaderboard_stats_counts_check CHECK (
    scored_days >= 0 AND resolved_markets >= 0 AND rank_position > 0
  )
);

CREATE INDEX steam_user_leaderboard_stats_rank_idx
  ON public.steam_user_leaderboard_stats (metric_type, rank_position);

CREATE INDEX steam_forecast_markets_resolution_queue_idx
  ON public.steam_forecast_markets (resolve_after, resolution_next_retry_at)
  WHERE status = 'locked';

CREATE TABLE public.steam_ccu_observations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  market_id uuid NOT NULL REFERENCES public.steam_forecast_markets(id) ON DELETE CASCADE,
  observed_at timestamptz NOT NULL,
  player_count integer NOT NULL,
  source_reference text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT steam_ccu_observations_player_count_check CHECK (player_count >= 0),
  CONSTRAINT steam_ccu_observations_market_time_key UNIQUE (market_id, observed_at)
);

CREATE INDEX steam_ccu_observations_peak_idx
  ON public.steam_ccu_observations (market_id, player_count DESC, observed_at);

CREATE TRIGGER steam_forecast_markets_set_updated_at
  BEFORE UPDATE ON public.steam_forecast_markets
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER steam_bets_set_updated_at
  BEFORE UPDATE ON public.steam_bets
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

ALTER TABLE public.steam_percentile_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.steam_scoring_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.steam_forecast_markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.steam_prediction_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.steam_market_daily_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.steam_market_snapshot_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.steam_market_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.steam_score_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.steam_prediction_score_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.steam_user_leaderboard_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.steam_ccu_observations ENABLE ROW LEVEL SECURITY;

CREATE POLICY steam_forecast_markets_public_read
  ON public.steam_forecast_markets FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY steam_prediction_versions_read_own
  ON public.steam_prediction_versions FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY steam_market_results_public_read
  ON public.steam_market_results FOR SELECT TO anon, authenticated USING (is_current = true);
CREATE POLICY steam_prediction_score_entries_read_own
  ON public.steam_prediction_score_entries FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY steam_user_leaderboard_stats_public_read
  ON public.steam_user_leaderboard_stats FOR SELECT TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION private.steam_is_internal_actor()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(auth.role() = 'service_role', false)
    OR coalesce(private.is_admin(auth.uid()), false);
$$;

CREATE OR REPLACE FUNCTION private.steam_metric_lock_at(p_release_date date)
RETURNS timestamptz
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE WHEN p_release_date IS NULL THEN NULL
    ELSE p_release_date::timestamp AT TIME ZONE 'UTC'
  END;
$$;

CREATE OR REPLACE FUNCTION private.steam_metric_resolve_after(
  p_metric_type text,
  p_release_date date
)
RETURNS timestamptz
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_release_date IS NULL THEN NULL
    WHEN p_metric_type = 'full_price_us'
      THEN p_release_date::timestamp AT TIME ZONE 'UTC'
    WHEN p_metric_type = 'launch_discount'
      THEN p_release_date::timestamp AT TIME ZONE 'UTC'
    WHEN p_metric_type = 'first_weekend_ccu'
      THEN (date_trunc('week', p_release_date::timestamp) + interval '7 days') AT TIME ZONE 'UTC'
    WHEN p_metric_type = 'first_month_reviews'
      THEN (p_release_date::timestamp + interval '30 days') AT TIME ZONE 'UTC'
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_steam_points_system()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  scoring_start timestamptz;
BEGIN
  INSERT INTO public.steam_scoring_config (singleton, scoring_start_at)
  VALUES (true, now())
  ON CONFLICT (singleton) DO NOTHING;

  INSERT INTO public.steam_percentile_models (
    metric_type, model_version, dataset_reference, sample_size, reference_values, is_active
  ) VALUES
    (
      'first_weekend_ccu', 1, 'mvp_fixture_v1: replace only with a versioned audited dataset', 25,
      ARRAY[0,25,50,100,200,350,500,750,1000,1500,2500,4000,6500,10000,16000,25000,40000,65000,100000,175000,300000,600000,1000000,3000000,10000000]::numeric[], true
    ),
    (
      'first_month_reviews', 1, 'mvp_fixture_v1: replace only with a versioned audited dataset', 25,
      ARRAY[0,2,5,10,20,35,50,80,120,180,275,400,650,1000,1600,2500,4000,6500,10000,18000,30000,60000,120000,300000,1000000]::numeric[], true
    ),
    (
      'full_price_us', 1, 'mvp_fixture_v1: replace only with a versioned audited dataset', 25,
      ARRAY[0,0.99,1.99,2.99,3.99,4.99,5.99,7.99,9.99,11.99,12.99,14.99,17.99,19.99,24.99,29.99,34.99,39.99,44.99,49.99,59.99,69.99,79.99,89.99,99.99]::numeric[], true
    ),
    (
      'launch_discount', 1, 'mvp_fixture_v1: replace only with a versioned audited dataset', 25,
      ARRAY[0,0,0,0,5,10,10,10,15,15,20,20,20,25,25,30,33,35,40,50,60,70,80,90,100]::numeric[], true
    )
  ON CONFLICT (metric_type, model_version) DO NOTHING;

  SELECT config.scoring_start_at INTO scoring_start
  FROM public.steam_scoring_config AS config
  WHERE config.singleton = true;

  INSERT INTO public.steam_forecast_markets (
    steam_app_id,
    metric_type,
    lock_at,
    resolve_after,
    source_release_date,
    percentile_model_id,
    percentile_model_version,
    scoring_start_at
  )
  SELECT
    game.steam_app_id,
    metric.metric_type,
    private.steam_metric_lock_at(game.release_date),
    private.steam_metric_resolve_after(metric.metric_type, game.release_date),
    game.release_date,
    model.id,
    model.model_version,
    scoring_start
  FROM public.steam_games AS game
  CROSS JOIN (
    VALUES ('first_weekend_ccu'), ('first_month_reviews'), ('full_price_us'), ('launch_discount')
  ) AS metric(metric_type)
  JOIN public.steam_percentile_models AS model
    ON model.metric_type = metric.metric_type AND model.is_active = true
  WHERE game.lifecycle_status = 'upcoming' AND game.is_wishlisted = true
  ON CONFLICT (steam_app_id, metric_type) DO NOTHING;

  UPDATE public.steam_forecast_markets AS market
  SET
    lock_at = private.steam_metric_lock_at(game.release_date),
    resolve_after = private.steam_metric_resolve_after(market.metric_type, game.release_date),
    source_release_date = game.release_date
  FROM public.steam_games AS game
  WHERE game.steam_app_id = market.steam_app_id
    AND market.status IN ('open', 'locked')
    AND (
      market.source_release_date IS DISTINCT FROM game.release_date
      OR market.lock_at IS DISTINCT FROM private.steam_metric_lock_at(game.release_date)
      OR market.resolve_after IS DISTINCT FROM private.steam_metric_resolve_after(
        market.metric_type,
        game.release_date
      )
    );

  UPDATE public.steam_forecast_markets AS market
  SET status = 'void', void_reason = 'Game left the TopWishlisted catalog', voided_at = now()
  FROM public.steam_games AS game
  WHERE game.steam_app_id = market.steam_app_id
    AND market.status = 'open'
    AND game.lifecycle_status = 'upcoming'
    AND game.is_wishlisted = false;

  UPDATE public.steam_bets AS bet
  SET
    percentile_value = public.steam_percentile_value(
      market.metric_type,
      market.percentile_model_version,
      bet.value
    ),
    percentile_model_version = market.percentile_model_version
  FROM public.steam_forecast_markets AS market
  WHERE market.steam_app_id = bet.steam_app_id
    AND market.metric_type = bet.target_key
    AND (bet.percentile_value IS NULL OR bet.percentile_model_version IS NULL);

  INSERT INTO public.steam_prediction_versions (
    market_id, user_id, raw_value, percentile_value, percentile_model_version, valid_from
  )
  SELECT
    market.id,
    bet.user_id,
    bet.value,
    bet.percentile_value,
    bet.percentile_model_version,
    market.scoring_start_at
  FROM public.steam_bets AS bet
  JOIN public.steam_forecast_markets AS market
    ON market.steam_app_id = bet.steam_app_id AND market.metric_type = bet.target_key
  WHERE bet.percentile_value IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.steam_prediction_versions AS version
      WHERE version.market_id = market.id AND version.user_id = bet.user_id
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.steam_percentile_value(
  p_metric_type text,
  p_model_version integer,
  p_raw_value numeric
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  reference numeric[];
  below_count integer;
  equal_count integer;
BEGIN
  IF p_raw_value IS NULL OR p_raw_value < 0 THEN
    RAISE EXCEPTION 'forecast value must be zero or greater' USING ERRCODE = '22003';
  END IF;

  SELECT model.reference_values INTO reference
  FROM public.steam_percentile_models AS model
  WHERE model.metric_type = p_metric_type AND model.model_version = p_model_version;

  IF reference IS NULL THEN
    RAISE EXCEPTION 'percentile model not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT
    count(*) FILTER (WHERE item < p_raw_value),
    count(*) FILTER (WHERE item = p_raw_value)
  INTO below_count, equal_count
  FROM unnest(reference) AS item;

  RETURN round((below_count + equal_count * 0.5) * 100.0 / cardinality(reference), 4);
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_steam_forecast_markets()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  market_count integer;
BEGIN
  PERFORM public.ensure_steam_points_system();
  SELECT count(*) INTO market_count FROM public.steam_forecast_markets;
  RETURN market_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.lock_due_steam_forecast_markets()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  locked_count integer;
BEGIN
  UPDATE public.steam_forecast_markets
  SET status = 'locked'
  WHERE status = 'open' AND lock_at IS NOT NULL AND lock_at <= now();
  GET DIAGNOSTICS locked_count = ROW_COUNT;
  RETURN locked_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_steam_prediction(
  p_steam_app_id bigint,
  p_metric_type text,
  p_raw_value numeric
)
RETURNS TABLE (
  steam_app_id bigint,
  metric_type text,
  raw_value numeric,
  percentile_value numeric,
  market_status text,
  lock_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  market public.steam_forecast_markets%ROWTYPE;
  game public.steam_games%ROWTYPE;
  calculated_percentile numeric;
  saved_at timestamptz := clock_timestamp();
  current_version public.steam_prediction_versions%ROWTYPE;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;
  IF p_metric_type NOT IN ('first_weekend_ccu', 'first_month_reviews', 'full_price_us', 'launch_discount') THEN
    RAISE EXCEPTION 'unsupported forecast metric' USING ERRCODE = '22023';
  END IF;
  IF p_raw_value IS NULL OR p_raw_value < 0
    OR (p_metric_type = 'first_weekend_ccu' AND p_raw_value > 9999999)
    OR (p_metric_type = 'first_month_reviews' AND p_raw_value > 999999)
    OR (p_metric_type = 'full_price_us' AND p_raw_value > 10000)
    OR (p_metric_type = 'launch_discount' AND p_raw_value > 100)
  THEN
    RAISE EXCEPTION 'forecast value is outside the allowed range' USING ERRCODE = '22003';
  END IF;

  SELECT * INTO game FROM public.steam_games
  WHERE steam_games.steam_app_id = p_steam_app_id
    AND lifecycle_status = 'upcoming' AND is_wishlisted = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'game is not open for predictions' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO market FROM public.steam_forecast_markets
  WHERE steam_forecast_markets.steam_app_id = p_steam_app_id
    AND steam_forecast_markets.metric_type = p_metric_type
  FOR UPDATE;
  IF NOT FOUND THEN
    PERFORM public.ensure_steam_points_system();
    SELECT * INTO market FROM public.steam_forecast_markets
    WHERE steam_forecast_markets.steam_app_id = p_steam_app_id
      AND steam_forecast_markets.metric_type = p_metric_type
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'forecast market not found' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  IF market.status = 'open' AND market.lock_at IS NOT NULL AND market.lock_at <= now() THEN
    UPDATE public.steam_forecast_markets SET status = 'locked' WHERE id = market.id;
    market.status := 'locked';
  END IF;
  IF market.status <> 'open' THEN
    RAISE EXCEPTION 'forecast market is %', market.status USING ERRCODE = '22023';
  END IF;

  calculated_percentile := public.steam_percentile_value(
    market.metric_type, market.percentile_model_version, p_raw_value
  );

  SELECT * INTO current_version
  FROM public.steam_prediction_versions
  WHERE market_id = market.id AND user_id = current_user_id AND valid_to IS NULL
  FOR UPDATE;

  IF FOUND AND current_version.raw_value IS DISTINCT FROM p_raw_value THEN
    UPDATE public.steam_prediction_versions SET valid_to = saved_at WHERE id = current_version.id;
  END IF;

  IF NOT FOUND OR current_version.raw_value IS DISTINCT FROM p_raw_value THEN
    INSERT INTO public.steam_prediction_versions (
      market_id, user_id, raw_value, percentile_value, percentile_model_version, valid_from
    ) VALUES (
      market.id, current_user_id, p_raw_value, calculated_percentile,
      market.percentile_model_version, saved_at
    );
  END IF;

  INSERT INTO public.steam_bets (
    user_id, steam_app_id, target_key, value, game_name, release_date,
    release_label, image_url, percentile_value, percentile_model_version
  ) VALUES (
    current_user_id, game.steam_app_id, p_metric_type, p_raw_value, game.name,
    coalesce(game.release_date::text, ''), game.release_label, game.image_url,
    calculated_percentile, market.percentile_model_version
  )
  ON CONFLICT ON CONSTRAINT steam_bets_user_game_target_key DO UPDATE SET
    value = EXCLUDED.value,
    game_name = EXCLUDED.game_name,
    release_date = EXCLUDED.release_date,
    release_label = EXCLUDED.release_label,
    image_url = EXCLUDED.image_url,
    percentile_value = EXCLUDED.percentile_value,
    percentile_model_version = EXCLUDED.percentile_model_version;

  RETURN QUERY SELECT
    game.steam_app_id,
    market.metric_type,
    p_raw_value,
    calculated_percentile,
    market.status,
    market.lock_at,
    saved_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_steam_market_snapshots(
  p_snapshot_at timestamptz DEFAULT date_trunc('day', now())
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  normalized_at timestamptz := date_trunc('day', p_snapshot_at AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  inserted_count integer;
BEGIN
  IF p_snapshot_at IS DISTINCT FROM normalized_at THEN
    RAISE EXCEPTION 'snapshot time must be 00:00 UTC' USING ERRCODE = '22023';
  END IF;
  IF normalized_at > now() THEN
    RAISE EXCEPTION 'future snapshots are not allowed' USING ERRCODE = '22023';
  END IF;

  PERFORM public.ensure_steam_points_system();

  INSERT INTO public.steam_market_daily_snapshots (
    market_id, snapshot_date, snapshot_at
  )
  SELECT market.id, normalized_at::date, normalized_at
  FROM public.steam_forecast_markets AS market
  WHERE market.status <> 'void'
    AND normalized_at >= date_trunc('day', market.scoring_start_at AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
    AND (market.lock_at IS NULL OR normalized_at < market.lock_at)
  ON CONFLICT (market_id, snapshot_date) DO NOTHING;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  INSERT INTO public.steam_market_snapshot_predictions (
    snapshot_id, prediction_version_id, user_id, raw_value, percentile_value
  )
  SELECT snapshot.id, version.id, version.user_id, version.raw_value, version.percentile_value
  FROM public.steam_market_daily_snapshots AS snapshot
  JOIN public.steam_prediction_versions AS version
    ON version.market_id = snapshot.market_id
    AND version.valid_from <= snapshot.snapshot_at
    AND (version.valid_to IS NULL OR version.valid_to > snapshot.snapshot_at)
  WHERE snapshot.snapshot_at = normalized_at
  ON CONFLICT (snapshot_id, user_id) DO NOTHING;

  UPDATE public.steam_market_daily_snapshots AS snapshot
  SET
    eligible_prediction_count = aggregate.prediction_count,
    crowd_percentile = aggregate.crowd_percentile
  FROM (
    SELECT membership.snapshot_id,
      count(*)::integer AS prediction_count,
      avg(membership.percentile_value) AS crowd_percentile
    FROM public.steam_market_snapshot_predictions AS membership
    GROUP BY membership.snapshot_id
  ) AS aggregate
  WHERE snapshot.id = aggregate.snapshot_id AND snapshot.snapshot_at = normalized_at;

  WITH daily_average AS (
    SELECT
      market.steam_app_id,
      market.metric_type AS target_key,
      snapshot.snapshot_at,
      avg(prediction.raw_value) AS average_value
    FROM public.steam_market_daily_snapshots AS snapshot
    JOIN public.steam_forecast_markets AS market ON market.id = snapshot.market_id
    JOIN public.steam_market_snapshot_predictions AS prediction
      ON prediction.snapshot_id = snapshot.id
    WHERE snapshot.snapshot_at >= normalized_at - interval '29 days'
      AND snapshot.snapshot_at <= normalized_at
    GROUP BY market.steam_app_id, market.metric_type, snapshot.snapshot_at
  ), market_history AS (
    SELECT
      daily_average.steam_app_id,
      daily_average.target_key,
      jsonb_agg(
        jsonb_build_object(
          'at', daily_average.snapshot_at,
          'average_value', daily_average.average_value
        )
        ORDER BY daily_average.snapshot_at
      ) AS points
    FROM daily_average
    GROUP BY daily_average.steam_app_id, daily_average.target_key
  ), game_history AS (
    SELECT
      market_history.steam_app_id,
      jsonb_object_agg(market_history.target_key, market_history.points) AS history
    FROM market_history
    GROUP BY market_history.steam_app_id
  )
  UPDATE public.steam_games AS game
  SET average_forecast_history = game_history.history
  FROM game_history
  WHERE game.steam_app_id = game_history.steam_app_id;

  RETURN inserted_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.rebuild_steam_leaderboard_stats()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  rebuilt_count integer;
BEGIN
  DELETE FROM public.steam_user_leaderboard_stats
  WHERE user_id IS NOT NULL;

  WITH current_entries AS (
    SELECT entry.*, market.metric_type, snapshot.snapshot_date
    FROM public.steam_prediction_score_entries AS entry
    JOIN public.steam_score_runs AS run
      ON run.id = entry.score_run_id AND run.is_current = true
    JOIN public.steam_forecast_markets AS market ON market.id = entry.market_id
    JOIN public.steam_market_daily_snapshots AS snapshot ON snapshot.id = entry.snapshot_id
    WHERE market.status = 'resolved'
  ), grouped AS (
    SELECT user_id, metric_type, sum(points) AS points,
      count(DISTINCT snapshot_date)::integer AS scored_days,
      count(DISTINCT market_id)::integer AS resolved_markets
    FROM current_entries GROUP BY user_id, metric_type
    UNION ALL
    SELECT user_id, 'all', sum(points), count(DISTINCT snapshot_date)::integer,
      count(DISTINCT market_id)::integer
    FROM current_entries GROUP BY user_id
  ), ranked AS (
    SELECT grouped.*,
      row_number() OVER (
        PARTITION BY grouped.metric_type
        ORDER BY grouped.points DESC, grouped.scored_days DESC,
          grouped.resolved_markets DESC, profile.created_at ASC, grouped.user_id ASC
      ) AS rank_position
    FROM grouped
    JOIN public.profiles AS profile ON profile.id = grouped.user_id
  )
  INSERT INTO public.steam_user_leaderboard_stats (
    user_id, metric_type, points, scored_days, resolved_markets, rank_position
  )
  SELECT user_id, metric_type, points, scored_days, resolved_markets, rank_position
  FROM ranked;

  GET DIAGNOSTICS rebuilt_count = ROW_COUNT;
  RETURN rebuilt_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_steam_forecast_market(
  p_market_id uuid,
  p_actual_raw_value numeric,
  p_source_reference text,
  p_resolved_at timestamptz DEFAULT now(),
  p_correction_note text DEFAULT NULL
)
RETURNS public.steam_market_results
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  market public.steam_forecast_markets%ROWTYPE;
  current_result public.steam_market_results%ROWTYPE;
  saved_result public.steam_market_results%ROWTYPE;
  saved_run public.steam_score_runs%ROWTYPE;
  actual_percentile numeric;
  next_result_version integer;
  next_run_version integer;
BEGIN
  IF NOT private.steam_is_internal_actor() THEN
    RAISE EXCEPTION 'administrator access required' USING ERRCODE = '42501';
  END IF;
  IF p_actual_raw_value IS NULL OR p_actual_raw_value < 0 OR nullif(trim(p_source_reference), '') IS NULL THEN
    RAISE EXCEPTION 'actual value and source are required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO market FROM public.steam_forecast_markets WHERE id = p_market_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'forecast market not found' USING ERRCODE = 'P0002'; END IF;
  IF market.status = 'void' OR market.status = 'open' THEN
    RAISE EXCEPTION 'only locked or resolved markets can be resolved' USING ERRCODE = '22023';
  END IF;

  actual_percentile := public.steam_percentile_value(
    market.metric_type, market.percentile_model_version, p_actual_raw_value
  );
  SELECT * INTO current_result FROM public.steam_market_results
  WHERE market_id = market.id AND is_current = true FOR UPDATE;

  IF FOUND
    AND current_result.actual_raw_value = p_actual_raw_value
    AND current_result.source_reference = p_source_reference
  THEN
    RETURN current_result;
  END IF;

  UPDATE public.steam_market_results SET is_current = false
  WHERE market_id = market.id AND is_current = true;
  SELECT coalesce(max(result_version), 0) + 1 INTO next_result_version
  FROM public.steam_market_results WHERE market_id = market.id;
  INSERT INTO public.steam_market_results (
    market_id, result_version, actual_raw_value, actual_percentile_value,
    source_reference, resolved_at, correction_note, created_by
  ) VALUES (
    market.id, next_result_version, p_actual_raw_value, actual_percentile,
    p_source_reference, p_resolved_at, p_correction_note, auth.uid()
  ) RETURNING * INTO saved_result;

  UPDATE public.steam_score_runs SET is_current = false
  WHERE market_id = market.id AND is_current = true;
  SELECT coalesce(max(run_version), 0) + 1 INTO next_run_version
  FROM public.steam_score_runs WHERE market_id = market.id;
  INSERT INTO public.steam_score_runs (
    market_id, result_id, run_version, reason, created_by
  ) VALUES (
    market.id, saved_result.id, next_run_version,
    CASE WHEN next_run_version = 1 THEN 'initial resolution' ELSE 'result correction' END,
    auth.uid()
  ) RETURNING * INTO saved_run;

  INSERT INTO public.steam_prediction_score_entries (
    score_run_id, market_id, snapshot_id, user_id, user_percentile,
    crowd_without_user_percentile, actual_percentile, points
  )
  SELECT
    saved_run.id,
    market.id,
    snapshot.id,
    membership.user_id,
    membership.percentile_value,
    (snapshot.crowd_percentile * snapshot.eligible_prediction_count - membership.percentile_value)
      / (snapshot.eligible_prediction_count - 1),
    actual_percentile,
    abs(actual_percentile - (
      (snapshot.crowd_percentile * snapshot.eligible_prediction_count - membership.percentile_value)
        / (snapshot.eligible_prediction_count - 1)
    )) - abs(actual_percentile - membership.percentile_value)
  FROM public.steam_market_daily_snapshots AS snapshot
  JOIN public.steam_market_snapshot_predictions AS membership
    ON membership.snapshot_id = snapshot.id
  WHERE snapshot.market_id = market.id AND snapshot.eligible_prediction_count >= 2;

  UPDATE public.steam_forecast_markets
  SET
    status = 'resolved',
    resolution_attempt_count = 0,
    resolution_last_attempt_at = p_resolved_at,
    resolution_next_retry_at = NULL,
    resolution_last_error = NULL
  WHERE id = market.id;
  PERFORM public.rebuild_steam_leaderboard_stats();
  RETURN saved_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_steam_market_resolution_failure(
  p_market_id uuid,
  p_error text,
  p_next_retry_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.steam_is_internal_actor() THEN
    RAISE EXCEPTION 'administrator access required' USING ERRCODE = '42501';
  END IF;
  IF nullif(trim(p_error), '') IS NULL OR p_next_retry_at IS NULL THEN
    RAISE EXCEPTION 'error and retry timestamp are required' USING ERRCODE = '22023';
  END IF;

  UPDATE public.steam_forecast_markets
  SET
    resolution_attempt_count = resolution_attempt_count + 1,
    resolution_last_attempt_at = now(),
    resolution_next_retry_at = p_next_retry_at,
    resolution_last_error = left(trim(p_error), 1000)
  WHERE id = p_market_id AND status = 'locked';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'locked forecast market not found' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_steam_forecast_market(
  p_market_id uuid,
  p_reason text DEFAULT 'manual recalculation'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  market public.steam_forecast_markets%ROWTYPE;
  result public.steam_market_results%ROWTYPE;
  saved_run public.steam_score_runs%ROWTYPE;
  next_run_version integer;
  entry_count integer;
BEGIN
  IF NOT private.steam_is_internal_actor() THEN
    RAISE EXCEPTION 'administrator access required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO market FROM public.steam_forecast_markets WHERE id = p_market_id FOR UPDATE;
  SELECT * INTO result FROM public.steam_market_results
  WHERE market_id = p_market_id AND is_current = true;
  IF market.id IS NULL OR result.id IS NULL OR market.status <> 'resolved' THEN
    RAISE EXCEPTION 'resolved market result not found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.steam_score_runs SET is_current = false
  WHERE market_id = market.id AND is_current = true;
  SELECT coalesce(max(run_version), 0) + 1 INTO next_run_version
  FROM public.steam_score_runs WHERE market_id = market.id;
  INSERT INTO public.steam_score_runs (
    market_id, result_id, run_version, reason, created_by
  ) VALUES (market.id, result.id, next_run_version, p_reason, auth.uid())
  RETURNING * INTO saved_run;

  INSERT INTO public.steam_prediction_score_entries (
    score_run_id, market_id, snapshot_id, user_id, user_percentile,
    crowd_without_user_percentile, actual_percentile, points
  )
  SELECT saved_run.id, market.id, snapshot.id, membership.user_id,
    membership.percentile_value,
    (snapshot.crowd_percentile * snapshot.eligible_prediction_count - membership.percentile_value)
      / (snapshot.eligible_prediction_count - 1),
    result.actual_percentile_value,
    abs(result.actual_percentile_value - (
      (snapshot.crowd_percentile * snapshot.eligible_prediction_count - membership.percentile_value)
        / (snapshot.eligible_prediction_count - 1)
    )) - abs(result.actual_percentile_value - membership.percentile_value)
  FROM public.steam_market_daily_snapshots AS snapshot
  JOIN public.steam_market_snapshot_predictions AS membership ON membership.snapshot_id = snapshot.id
  WHERE snapshot.market_id = market.id AND snapshot.eligible_prediction_count >= 2;
  GET DIAGNOSTICS entry_count = ROW_COUNT;
  PERFORM public.rebuild_steam_leaderboard_stats();
  RETURN entry_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.void_steam_forecast_market(
  p_market_id uuid,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.steam_is_internal_actor() THEN
    RAISE EXCEPTION 'administrator access required' USING ERRCODE = '42501';
  END IF;
  IF nullif(trim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'void reason is required' USING ERRCODE = '22023';
  END IF;
  UPDATE public.steam_forecast_markets
  SET status = 'void', void_reason = p_reason, voided_at = now()
  WHERE id = p_market_id AND status <> 'void';
  UPDATE public.steam_score_runs SET is_current = false
  WHERE market_id = p_market_id AND is_current = true;
  PERFORM public.rebuild_steam_leaderboard_stats();
END;
$$;

CREATE OR REPLACE FUNCTION public.process_steam_market_cycle()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  market_count integer;
  locked_count integer;
BEGIN
  market_count := public.sync_steam_forecast_markets();
  locked_count := public.lock_due_steam_forecast_markets();
  RETURN jsonb_build_object('markets', market_count, 'locked', locked_count, 'processed_at', now());
END;
$$;

CREATE OR REPLACE FUNCTION public.get_steam_prediction_states(
  p_steam_app_ids bigint[] DEFAULT NULL
)
RETURNS TABLE (
  steam_app_id bigint,
  metric_type text,
  market_status text,
  lock_at timestamptz,
  resolve_after timestamptz,
  user_raw_value numeric,
  user_percentile_value numeric,
  actual_raw_value numeric,
  actual_percentile_value numeric,
  points numeric,
  scored_days bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    market.steam_app_id,
    market.metric_type,
    market.status,
    market.lock_at,
    market.resolve_after,
    version.raw_value,
    version.percentile_value,
    result.actual_raw_value,
    result.actual_percentile_value,
    coalesce(score.points, 0),
    coalesce(score.scored_days, 0)
  FROM public.steam_forecast_markets AS market
  LEFT JOIN public.steam_prediction_versions AS version
    ON version.market_id = market.id AND version.user_id = auth.uid() AND version.valid_to IS NULL
  LEFT JOIN public.steam_market_results AS result
    ON result.market_id = market.id AND result.is_current = true
  LEFT JOIN LATERAL (
    SELECT sum(entry.points) AS points, count(DISTINCT snapshot.snapshot_date) AS scored_days
    FROM public.steam_prediction_score_entries AS entry
    JOIN public.steam_score_runs AS run ON run.id = entry.score_run_id AND run.is_current = true
    JOIN public.steam_market_daily_snapshots AS snapshot ON snapshot.id = entry.snapshot_id
    WHERE entry.market_id = market.id AND entry.user_id = auth.uid()
  ) AS score ON true
  WHERE p_steam_app_ids IS NULL OR market.steam_app_id = ANY(p_steam_app_ids)
  ORDER BY market.steam_app_id, market.metric_type;
$$;

CREATE OR REPLACE FUNCTION public.get_steam_points_leaderboard(
  p_metric_type text DEFAULT 'all',
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  rank_position bigint,
  user_id uuid,
  username text,
  display_name text,
  avatar_id public.avatar_id,
  points numeric,
  scored_days integer,
  resolved_markets integer,
  is_current_user boolean,
  is_page_member boolean,
  total_rows bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_metric_type NOT IN ('all', 'first_weekend_ccu', 'first_month_reviews', 'full_price_us', 'launch_discount') THEN
    RAISE EXCEPTION 'unsupported leaderboard metric' USING ERRCODE = '22023';
  END IF;
  IF p_limit < 1 OR p_limit > 100 OR p_offset < 0 THEN
    RAISE EXCEPTION 'invalid pagination' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH total AS (
    SELECT count(*)::bigint AS value
    FROM public.steam_user_leaderboard_stats AS stats
    WHERE stats.metric_type = p_metric_type
  ), page AS (
    SELECT stats.* FROM public.steam_user_leaderboard_stats AS stats
    WHERE stats.metric_type = p_metric_type
    ORDER BY stats.rank_position
    LIMIT p_limit OFFSET p_offset
  ), viewer AS (
    SELECT stats.* FROM public.steam_user_leaderboard_stats AS stats
    WHERE stats.metric_type = p_metric_type AND stats.user_id = auth.uid()
  ), combined AS (
    SELECT page.*, true AS is_page_member FROM page
    UNION ALL
    SELECT viewer.*, false FROM viewer
    WHERE NOT EXISTS (SELECT 1 FROM page WHERE page.user_id = viewer.user_id)
  ), with_empty_viewer AS (
    SELECT * FROM combined
    UNION ALL
    SELECT auth.uid(), p_metric_type, 0::numeric, 0, 0,
      (SELECT value + 1 FROM total), now(), false
    WHERE auth.uid() IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM combined WHERE combined.user_id = auth.uid())
  )
  SELECT
    row.rank_position,
    row.user_id,
    profile.username,
    profile.display_name,
    profile.avatar_id,
    row.points,
    row.scored_days,
    row.resolved_markets,
    row.user_id = auth.uid(),
    row.is_page_member,
    total.value
  FROM with_empty_viewer AS row
  JOIN public.profiles AS profile ON profile.id = row.user_id
  CROSS JOIN total
  ORDER BY row.is_page_member DESC, row.rank_position;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_steam_resolution_queue()
RETURNS TABLE (
  market_id uuid,
  steam_app_id bigint,
  game_name text,
  metric_type text,
  resolve_after timestamptz,
  status text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.steam_is_internal_actor() THEN
    RAISE EXCEPTION 'administrator access required' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT market.id, market.steam_app_id, game.name, market.metric_type,
    market.resolve_after, market.status
  FROM public.steam_forecast_markets AS market
  JOIN public.steam_games AS game ON game.steam_app_id = market.steam_app_id
  WHERE market.status = 'locked'
    AND market.resolve_after <= now()
    AND game.lifecycle_status = 'released'
    AND (market.resolution_next_retry_at IS NULL OR market.resolution_next_retry_at <= now())
  ORDER BY market.resolve_after, market.steam_app_id, market.metric_type;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_steam_released_game_feed(
  p_lifecycle text,
  p_query text DEFAULT '',
  p_limit integer DEFAULT 12,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (steam_app_id bigint, total_rows bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_lifecycle NOT IN ('locked', 'completed') THEN
    RAISE EXCEPTION 'unsupported released game lifecycle' USING ERRCODE = '22023';
  END IF;
  IF p_limit < 1 OR p_limit > 50 OR p_offset < 0 THEN
    RAISE EXCEPTION 'invalid pagination' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH classified AS (
    SELECT
      game.steam_app_id,
      game.name,
      game.released_at,
      game.release_date,
      game.pre_release_rank,
      CASE
        WHEN count(market.id) > 0
          AND bool_and(market.status IN ('resolved', 'void')) THEN 'completed'
        ELSE 'locked'
      END AS market_lifecycle
    FROM public.steam_games AS game
    LEFT JOIN public.steam_forecast_markets AS market
      ON market.steam_app_id = game.steam_app_id
    WHERE game.lifecycle_status = 'released' AND game.pre_release_rank IS NOT NULL
    GROUP BY game.steam_app_id, game.name, game.released_at, game.release_date,
      game.pre_release_rank
  ), filtered AS (
    SELECT * FROM classified
    WHERE market_lifecycle = p_lifecycle
      AND (
        nullif(trim(p_query), '') IS NULL
        OR position(lower(trim(p_query)) IN lower(name)) > 0
      )
  )
  SELECT filtered.steam_app_id, count(*) OVER ()
  FROM filtered
  ORDER BY filtered.released_at DESC NULLS LAST,
    filtered.release_date DESC NULLS LAST,
    filtered.pre_release_rank ASC NULLS LAST,
    filtered.steam_app_id
  LIMIT p_limit OFFSET p_offset;
END;
$$;

REVOKE ALL ON TABLE public.steam_percentile_models FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.steam_scoring_config FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.steam_forecast_markets FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.steam_prediction_versions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.steam_market_daily_snapshots FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.steam_market_snapshot_predictions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.steam_market_results FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.steam_score_runs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.steam_prediction_score_entries FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.steam_user_leaderboard_stats FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.steam_ccu_observations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.steam_forecast_markets TO anon, authenticated;
GRANT SELECT ON TABLE public.steam_prediction_versions TO authenticated;
GRANT SELECT ON TABLE public.steam_market_results TO anon, authenticated;
GRANT SELECT ON TABLE public.steam_prediction_score_entries TO authenticated;
GRANT SELECT ON TABLE public.steam_user_leaderboard_stats TO anon, authenticated;
GRANT ALL ON TABLE public.steam_percentile_models TO service_role;
GRANT ALL ON TABLE public.steam_scoring_config TO service_role;
GRANT ALL ON TABLE public.steam_forecast_markets TO service_role;
GRANT ALL ON TABLE public.steam_prediction_versions TO service_role;
GRANT ALL ON TABLE public.steam_market_daily_snapshots TO service_role;
GRANT ALL ON TABLE public.steam_market_snapshot_predictions TO service_role;
GRANT ALL ON TABLE public.steam_market_results TO service_role;
GRANT ALL ON TABLE public.steam_score_runs TO service_role;
GRANT ALL ON TABLE public.steam_prediction_score_entries TO service_role;
GRANT ALL ON TABLE public.steam_user_leaderboard_stats TO service_role;
GRANT ALL ON TABLE public.steam_ccu_observations TO service_role;

DROP POLICY steam_bets_insert_own ON public.steam_bets;
REVOKE INSERT ON TABLE public.steam_bets FROM authenticated;

REVOKE ALL ON FUNCTION public.ensure_steam_points_system() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.steam_percentile_value(text, integer, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_steam_forecast_markets() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.lock_due_steam_forecast_markets() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_steam_prediction(bigint, text, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_steam_market_snapshots(timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rebuild_steam_leaderboard_stats() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resolve_steam_forecast_market(uuid, numeric, text, timestamptz, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.recalculate_steam_forecast_market(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.void_steam_forecast_market(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.process_steam_market_cycle() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_steam_prediction_states(bigint[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_steam_points_leaderboard(text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_steam_resolution_queue() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_steam_market_resolution_failure(uuid, text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_steam_released_game_feed(text, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_steam_points_system() TO service_role;
GRANT EXECUTE ON FUNCTION public.steam_percentile_value(text, integer, numeric) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_steam_forecast_markets() TO service_role;
GRANT EXECUTE ON FUNCTION public.lock_due_steam_forecast_markets() TO service_role;
GRANT EXECUTE ON FUNCTION public.submit_steam_prediction(bigint, text, numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_steam_market_snapshots(timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.rebuild_steam_leaderboard_stats() TO service_role;
GRANT EXECUTE ON FUNCTION public.resolve_steam_forecast_market(uuid, numeric, text, timestamptz, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.recalculate_steam_forecast_market(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.void_steam_forecast_market(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.process_steam_market_cycle() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_steam_prediction_states(bigint[]) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_steam_points_leaderboard(text, integer, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_steam_resolution_queue() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_steam_market_resolution_failure(uuid, text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_steam_released_game_feed(text, text, integer, integer) TO anon, authenticated, service_role;
