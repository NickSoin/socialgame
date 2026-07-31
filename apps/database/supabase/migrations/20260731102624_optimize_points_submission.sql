set check_function_bodies = off;

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
  IF p_metric_type NOT IN ('first_weekend_ccu', 'first_month_reviews', 'full_price_us') THEN
    RAISE EXCEPTION 'unsupported forecast metric' USING ERRCODE = '22023';
  END IF;
  IF p_raw_value IS NULL OR p_raw_value < 0
    OR (p_metric_type = 'first_weekend_ccu' AND p_raw_value > 9999999)
    OR (p_metric_type = 'first_month_reviews' AND p_raw_value > 999999)
    OR (p_metric_type = 'full_price_us' AND p_raw_value > 10000)
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


