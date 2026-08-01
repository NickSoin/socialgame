alter table "public"."steam_forecast_markets" add column "resolution_attempt_count" integer not null default 0;

alter table "public"."steam_forecast_markets" add column "resolution_last_attempt_at" timestamp with time zone;

alter table "public"."steam_forecast_markets" add column "resolution_last_error" text;

alter table "public"."steam_forecast_markets" add column "resolution_next_retry_at" timestamp with time zone;

CREATE INDEX steam_forecast_markets_resolution_queue_idx ON public.steam_forecast_markets USING btree (resolve_after, resolution_next_retry_at) WHERE (status = 'locked'::text);

alter table "public"."steam_forecast_markets" add constraint "steam_forecast_markets_resolution_attempt_count_check" CHECK ((resolution_attempt_count >= 0)) not valid;

alter table "public"."steam_forecast_markets" validate constraint "steam_forecast_markets_resolution_attempt_count_check";

alter table "public"."steam_forecast_markets" add constraint "steam_forecast_markets_resolution_last_error_check" CHECK (((resolution_last_error IS NULL) OR (char_length(resolution_last_error) <= 1000))) not valid;

alter table "public"."steam_forecast_markets" validate constraint "steam_forecast_markets_resolution_last_error_check";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_steam_released_game_feed(p_lifecycle text, p_query text DEFAULT ''::text, p_limit integer DEFAULT 12, p_offset integer DEFAULT 0)
 RETURNS TABLE(steam_app_id bigint, total_rows bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
        WHEN count(market.id) = 3
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
$function$
;

CREATE OR REPLACE FUNCTION public.record_steam_market_resolution_failure(p_market_id uuid, p_error text, p_next_retry_at timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    VALUES ('first_weekend_ccu'), ('first_month_reviews'), ('full_price_us')
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
    AND market.status = 'open'
    AND (
      market.source_release_date IS DISTINCT FROM game.release_date
      OR market.lock_at IS DISTINCT FROM private.steam_metric_lock_at(game.release_date)
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

CREATE OR REPLACE FUNCTION public.get_steam_resolution_queue()
 RETURNS TABLE(market_id uuid, steam_app_id bigint, game_name text, metric_type text, resolve_after timestamp with time zone, status text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.resolve_steam_forecast_market(p_market_id uuid, p_actual_raw_value numeric, p_source_reference text, p_resolved_at timestamp with time zone DEFAULT now(), p_correction_note text DEFAULT NULL::text)
 RETURNS public.steam_market_results
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;


