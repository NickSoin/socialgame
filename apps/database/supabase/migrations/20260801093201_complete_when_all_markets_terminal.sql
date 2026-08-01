revoke delete on table "public"."steam_ccu_observations" from "anon";

revoke insert on table "public"."steam_ccu_observations" from "anon";

revoke references on table "public"."steam_ccu_observations" from "anon";

revoke select on table "public"."steam_ccu_observations" from "anon";

revoke trigger on table "public"."steam_ccu_observations" from "anon";

revoke truncate on table "public"."steam_ccu_observations" from "anon";

revoke update on table "public"."steam_ccu_observations" from "anon";

revoke delete on table "public"."steam_ccu_observations" from "authenticated";

revoke insert on table "public"."steam_ccu_observations" from "authenticated";

revoke references on table "public"."steam_ccu_observations" from "authenticated";

revoke select on table "public"."steam_ccu_observations" from "authenticated";

revoke trigger on table "public"."steam_ccu_observations" from "authenticated";

revoke truncate on table "public"."steam_ccu_observations" from "authenticated";

revoke update on table "public"."steam_ccu_observations" from "authenticated";

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
$function$
;


