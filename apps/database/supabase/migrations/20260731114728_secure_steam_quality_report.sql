set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_steam_game_data_quality_report()
 RETURNS TABLE(total_games bigint, exact_release_count bigint, partial_release_count bigint, tba_release_count bigint, five_tags_count bigint, one_to_four_tags_count bigint, fallback_tags_count bigint, missing_tags_count bigint, two_screenshots_count bigint, one_screenshot_count bigint, media_unavailable_count bigint, media_pending_count bigint, media_failed_count bigint, stale_release_count bigint, stale_tag_count bigint, stale_media_count bigint, oldest_pending_at timestamp with time zone, most_recent_successful_run_at timestamp with time zone)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
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
$function$
;


