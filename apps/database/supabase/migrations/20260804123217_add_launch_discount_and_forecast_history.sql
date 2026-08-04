alter table "public"."steam_bets" drop constraint "steam_bets_target_key_check";

alter table "public"."steam_forecast_markets" drop constraint "steam_forecast_markets_metric_check";

alter table "public"."steam_percentile_models" drop constraint "steam_percentile_models_metric_check";

alter table "public"."steam_user_leaderboard_stats" drop constraint "steam_user_leaderboard_stats_metric_check";

alter table "public"."steam_games" add column "average_forecast_history" jsonb not null default '{}'::jsonb;

alter table "public"."steam_games" add constraint "steam_games_average_forecast_history_check" CHECK ((jsonb_typeof(average_forecast_history) = 'object'::text)) not valid;

alter table "public"."steam_games" validate constraint "steam_games_average_forecast_history_check";

alter table "public"."steam_bets" add constraint "steam_bets_target_key_check" CHECK ((target_key = ANY (ARRAY['first_weekend_ccu'::text, 'first_month_reviews'::text, 'full_price_us'::text, 'launch_discount'::text]))) not valid;

alter table "public"."steam_bets" validate constraint "steam_bets_target_key_check";

alter table "public"."steam_forecast_markets" add constraint "steam_forecast_markets_metric_check" CHECK ((metric_type = ANY (ARRAY['first_weekend_ccu'::text, 'first_month_reviews'::text, 'full_price_us'::text, 'launch_discount'::text]))) not valid;

alter table "public"."steam_forecast_markets" validate constraint "steam_forecast_markets_metric_check";

alter table "public"."steam_percentile_models" add constraint "steam_percentile_models_metric_check" CHECK ((metric_type = ANY (ARRAY['first_weekend_ccu'::text, 'first_month_reviews'::text, 'full_price_us'::text, 'launch_discount'::text]))) not valid;

alter table "public"."steam_percentile_models" validate constraint "steam_percentile_models_metric_check";

alter table "public"."steam_user_leaderboard_stats" add constraint "steam_user_leaderboard_stats_metric_check" CHECK ((metric_type = ANY (ARRAY['all'::text, 'first_weekend_ccu'::text, 'first_month_reviews'::text, 'full_price_us'::text, 'launch_discount'::text]))) not valid;

alter table "public"."steam_user_leaderboard_stats" validate constraint "steam_user_leaderboard_stats_metric_check";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION private.steam_metric_resolve_after(p_metric_type text, p_release_date date)
 RETURNS timestamp with time zone
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.create_steam_market_snapshots(p_snapshot_at timestamp with time zone DEFAULT date_trunc('day'::text, now()))
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.ensure_steam_points_system()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_steam_points_leaderboard(p_metric_type text DEFAULT 'all'::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0)
 RETURNS TABLE(rank_position bigint, user_id uuid, username text, display_name text, avatar_id public.avatar_id, points numeric, scored_days integer, resolved_markets integer, is_current_user boolean, is_page_member boolean, total_rows bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.submit_steam_prediction(p_steam_app_id bigint, p_metric_type text, p_raw_value numeric)
 RETURNS TABLE(steam_app_id bigint, metric_type text, raw_value numeric, percentile_value numeric, market_status text, lock_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;


