revoke delete on table "public"."steam_catalog_exclusions" from "anon";

revoke insert on table "public"."steam_catalog_exclusions" from "anon";

revoke references on table "public"."steam_catalog_exclusions" from "anon";

revoke select on table "public"."steam_catalog_exclusions" from "anon";

revoke trigger on table "public"."steam_catalog_exclusions" from "anon";

revoke truncate on table "public"."steam_catalog_exclusions" from "anon";

revoke update on table "public"."steam_catalog_exclusions" from "anon";

revoke delete on table "public"."steam_catalog_exclusions" from "authenticated";

revoke insert on table "public"."steam_catalog_exclusions" from "authenticated";

revoke references on table "public"."steam_catalog_exclusions" from "authenticated";

revoke select on table "public"."steam_catalog_exclusions" from "authenticated";

revoke trigger on table "public"."steam_catalog_exclusions" from "authenticated";

revoke truncate on table "public"."steam_catalog_exclusions" from "authenticated";

revoke update on table "public"."steam_catalog_exclusions" from "authenticated";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.rebuild_steam_leaderboard_stats()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;


