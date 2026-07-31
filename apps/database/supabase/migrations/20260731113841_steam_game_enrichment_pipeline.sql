
  create table "public"."steam_enrichment_runs" (
    "id" uuid not null default gen_random_uuid(),
    "worker_id" text not null,
    "status" text not null default 'running'::text,
    "started_at" timestamp with time zone not null default now(),
    "finished_at" timestamp with time zone,
    "selected_count" integer not null default 0,
    "succeeded_count" integer not null default 0,
    "partial_count" integer not null default 0,
    "unavailable_count" integer not null default 0,
    "failed_count" integer not null default 0,
    "released_count" integer not null default 0,
    "uploaded_count" integer not null default 0,
    "skipped_unchanged_count" integer not null default 0,
    "still_pending_count" integer not null default 0,
    "error_message" text
      );


alter table "public"."steam_enrichment_runs" enable row level security;


  create table "public"."steam_game_enrichment_state" (
    "steam_app_id" bigint not null,
    "component" text not null,
    "status" text not null default 'pending'::text,
    "last_attempt_at" timestamp with time zone,
    "last_success_at" timestamp with time zone,
    "retry_after" timestamp with time zone,
    "consecutive_failures" integer not null default 0,
    "error_code" text,
    "error_message" text,
    "source_fingerprint" text,
    "source_payload" jsonb not null default '{}'::jsonb,
    "lease_owner" text,
    "lease_expires_at" timestamp with time zone,
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."steam_game_enrichment_state" enable row level security;


  create table "public"."steam_game_media" (
    "id" uuid not null default gen_random_uuid(),
    "steam_app_id" bigint not null,
    "kind" text not null,
    "position" smallint not null,
    "original_source_url" text not null,
    "storage_bucket" text not null,
    "storage_path" text not null,
    "mime_type" text not null,
    "byte_size" integer not null,
    "width" integer not null,
    "height" integer not null,
    "checksum_sha256" text not null,
    "encoder_quality" smallint not null,
    "source_updated_at" timestamp with time zone,
    "processed_at" timestamp with time zone not null default now(),
    "active" boolean not null default false,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."steam_game_media" enable row level security;


  create table "public"."steam_game_release_transitions" (
    "id" uuid not null default gen_random_uuid(),
    "steam_app_id" bigint not null,
    "previous_release_date" date,
    "next_release_date" date,
    "previous_release_text" text,
    "next_release_text" text,
    "previous_precision" text not null,
    "next_precision" text not null,
    "previous_coming_soon" boolean,
    "next_coming_soon" boolean,
    "observed_at" timestamp with time zone not null default now()
      );


alter table "public"."steam_game_release_transitions" enable row level security;

alter table "public"."steam_games" add column "media_updated_at" timestamp with time zone;

alter table "public"."steam_games" add column "release_metadata_updated_at" timestamp with time zone;

alter table "public"."steam_games" add column "release_precision" text not null default 'tba'::text;

alter table "public"."steam_games" add column "release_text" text;

alter table "public"."steam_games" add column "steam_coming_soon" boolean;

alter table "public"."steam_games" add column "tag_source" text not null default 'none'::text;

alter table "public"."steam_games" add column "tags_updated_at" timestamp with time zone;

CREATE UNIQUE INDEX steam_enrichment_runs_pkey ON public.steam_enrichment_runs USING btree (id);

CREATE INDEX steam_enrichment_runs_started_idx ON public.steam_enrichment_runs USING btree (started_at DESC);

CREATE INDEX steam_game_enrichment_retry_idx ON public.steam_game_enrichment_state USING btree (component, status, retry_after NULLS FIRST, lease_expires_at NULLS FIRST) WHERE (status = ANY (ARRAY['pending'::text, 'error'::text, 'partial'::text]));

CREATE UNIQUE INDEX steam_game_enrichment_state_pkey ON public.steam_game_enrichment_state USING btree (steam_app_id, component);

CREATE INDEX steam_game_media_active_catalog_idx ON public.steam_game_media USING btree (steam_app_id, "position") WHERE (active = true);

CREATE UNIQUE INDEX steam_game_media_active_position_idx ON public.steam_game_media USING btree (steam_app_id, kind, "position") WHERE (active = true);

CREATE UNIQUE INDEX steam_game_media_pkey ON public.steam_game_media USING btree (id);

CREATE UNIQUE INDEX steam_game_media_storage_path_key ON public.steam_game_media USING btree (storage_bucket, storage_path);

CREATE INDEX steam_game_release_transitions_game_idx ON public.steam_game_release_transitions USING btree (steam_app_id, observed_at DESC);

CREATE UNIQUE INDEX steam_game_release_transitions_pkey ON public.steam_game_release_transitions USING btree (id);

alter table "public"."steam_enrichment_runs" add constraint "steam_enrichment_runs_pkey" PRIMARY KEY using index "steam_enrichment_runs_pkey";

alter table "public"."steam_game_enrichment_state" add constraint "steam_game_enrichment_state_pkey" PRIMARY KEY using index "steam_game_enrichment_state_pkey";

alter table "public"."steam_game_media" add constraint "steam_game_media_pkey" PRIMARY KEY using index "steam_game_media_pkey";

alter table "public"."steam_game_release_transitions" add constraint "steam_game_release_transitions_pkey" PRIMARY KEY using index "steam_game_release_transitions_pkey";

alter table "public"."steam_enrichment_runs" add constraint "steam_enrichment_runs_completion_check" CHECK ((((status = 'running'::text) AND (finished_at IS NULL)) OR ((status <> 'running'::text) AND (finished_at IS NOT NULL)))) not valid;

alter table "public"."steam_enrichment_runs" validate constraint "steam_enrichment_runs_completion_check";

alter table "public"."steam_enrichment_runs" add constraint "steam_enrichment_runs_counts_check" CHECK (((selected_count >= 0) AND (succeeded_count >= 0) AND (partial_count >= 0) AND (unavailable_count >= 0) AND (failed_count >= 0) AND (released_count >= 0) AND (uploaded_count >= 0) AND (skipped_unchanged_count >= 0) AND (still_pending_count >= 0))) not valid;

alter table "public"."steam_enrichment_runs" validate constraint "steam_enrichment_runs_counts_check";

alter table "public"."steam_enrichment_runs" add constraint "steam_enrichment_runs_error_message_check" CHECK (((error_message IS NULL) OR (char_length(error_message) <= 1000))) not valid;

alter table "public"."steam_enrichment_runs" validate constraint "steam_enrichment_runs_error_message_check";

alter table "public"."steam_enrichment_runs" add constraint "steam_enrichment_runs_status_check" CHECK ((status = ANY (ARRAY['running'::text, 'success'::text, 'partial'::text, 'error'::text, 'already_running'::text]))) not valid;

alter table "public"."steam_enrichment_runs" validate constraint "steam_enrichment_runs_status_check";

alter table "public"."steam_game_enrichment_state" add constraint "steam_game_enrichment_state_component_check" CHECK ((component = ANY (ARRAY['release'::text, 'tags'::text, 'media'::text]))) not valid;

alter table "public"."steam_game_enrichment_state" validate constraint "steam_game_enrichment_state_component_check";

alter table "public"."steam_game_enrichment_state" add constraint "steam_game_enrichment_state_error_code_check" CHECK (((error_code IS NULL) OR ((char_length(error_code) >= 1) AND (char_length(error_code) <= 80)))) not valid;

alter table "public"."steam_game_enrichment_state" validate constraint "steam_game_enrichment_state_error_code_check";

alter table "public"."steam_game_enrichment_state" add constraint "steam_game_enrichment_state_error_message_check" CHECK (((error_message IS NULL) OR ((char_length(error_message) >= 1) AND (char_length(error_message) <= 500)))) not valid;

alter table "public"."steam_game_enrichment_state" validate constraint "steam_game_enrichment_state_error_message_check";

alter table "public"."steam_game_enrichment_state" add constraint "steam_game_enrichment_state_failure_check" CHECK ((consecutive_failures >= 0)) not valid;

alter table "public"."steam_game_enrichment_state" validate constraint "steam_game_enrichment_state_failure_check";

alter table "public"."steam_game_enrichment_state" add constraint "steam_game_enrichment_state_lease_check" CHECK ((((lease_owner IS NULL) AND (lease_expires_at IS NULL)) OR ((lease_owner IS NOT NULL) AND (lease_expires_at IS NOT NULL)))) not valid;

alter table "public"."steam_game_enrichment_state" validate constraint "steam_game_enrichment_state_lease_check";

alter table "public"."steam_game_enrichment_state" add constraint "steam_game_enrichment_state_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'complete'::text, 'partial'::text, 'not_available'::text, 'error'::text]))) not valid;

alter table "public"."steam_game_enrichment_state" validate constraint "steam_game_enrichment_state_status_check";

alter table "public"."steam_game_enrichment_state" add constraint "steam_game_enrichment_state_steam_app_id_fkey" FOREIGN KEY (steam_app_id) REFERENCES public.steam_games(steam_app_id) ON DELETE CASCADE not valid;

alter table "public"."steam_game_enrichment_state" validate constraint "steam_game_enrichment_state_steam_app_id_fkey";

alter table "public"."steam_game_media" add constraint "steam_game_media_bucket_check" CHECK ((storage_bucket = 'steam-game-media'::text)) not valid;

alter table "public"."steam_game_media" validate constraint "steam_game_media_bucket_check";

alter table "public"."steam_game_media" add constraint "steam_game_media_checksum_check" CHECK ((checksum_sha256 ~ '^[a-f0-9]{64}$'::text)) not valid;

alter table "public"."steam_game_media" validate constraint "steam_game_media_checksum_check";

alter table "public"."steam_game_media" add constraint "steam_game_media_dimensions_check" CHECK (((width > 0) AND (height > 0) AND (width <= 540))) not valid;

alter table "public"."steam_game_media" validate constraint "steam_game_media_dimensions_check";

alter table "public"."steam_game_media" add constraint "steam_game_media_kind_check" CHECK ((kind = 'screenshot'::text)) not valid;

alter table "public"."steam_game_media" validate constraint "steam_game_media_kind_check";

alter table "public"."steam_game_media" add constraint "steam_game_media_mime_check" CHECK ((mime_type = 'image/webp'::text)) not valid;

alter table "public"."steam_game_media" validate constraint "steam_game_media_mime_check";

alter table "public"."steam_game_media" add constraint "steam_game_media_path_check" CHECK ((storage_path ~ '^[1-9][0-9]*/screenshots/[12]-[a-f0-9]{12}\\.webp$'::text)) not valid;

alter table "public"."steam_game_media" validate constraint "steam_game_media_path_check";

alter table "public"."steam_game_media" add constraint "steam_game_media_position_check" CHECK ((("position" >= 1) AND ("position" <= 2))) not valid;

alter table "public"."steam_game_media" validate constraint "steam_game_media_position_check";

alter table "public"."steam_game_media" add constraint "steam_game_media_quality_check" CHECK (((encoder_quality >= 1) AND (encoder_quality <= 100))) not valid;

alter table "public"."steam_game_media" validate constraint "steam_game_media_quality_check";

alter table "public"."steam_game_media" add constraint "steam_game_media_size_check" CHECK (((byte_size >= 1) AND (byte_size <= 25600))) not valid;

alter table "public"."steam_game_media" validate constraint "steam_game_media_size_check";

alter table "public"."steam_game_media" add constraint "steam_game_media_source_url_check" CHECK ((original_source_url ~ '^https://'::text)) not valid;

alter table "public"."steam_game_media" validate constraint "steam_game_media_source_url_check";

alter table "public"."steam_game_media" add constraint "steam_game_media_steam_app_id_fkey" FOREIGN KEY (steam_app_id) REFERENCES public.steam_games(steam_app_id) ON DELETE CASCADE not valid;

alter table "public"."steam_game_media" validate constraint "steam_game_media_steam_app_id_fkey";

alter table "public"."steam_game_media" add constraint "steam_game_media_storage_path_key" UNIQUE using index "steam_game_media_storage_path_key";

alter table "public"."steam_game_release_transitions" add constraint "steam_game_release_transitions_next_precision_check" CHECK ((next_precision = ANY (ARRAY['exact'::text, 'month'::text, 'quarter'::text, 'year'::text, 'tba'::text]))) not valid;

alter table "public"."steam_game_release_transitions" validate constraint "steam_game_release_transitions_next_precision_check";

alter table "public"."steam_game_release_transitions" add constraint "steam_game_release_transitions_previous_precision_check" CHECK ((previous_precision = ANY (ARRAY['exact'::text, 'month'::text, 'quarter'::text, 'year'::text, 'tba'::text]))) not valid;

alter table "public"."steam_game_release_transitions" validate constraint "steam_game_release_transitions_previous_precision_check";

alter table "public"."steam_game_release_transitions" add constraint "steam_game_release_transitions_steam_app_id_fkey" FOREIGN KEY (steam_app_id) REFERENCES public.steam_games(steam_app_id) ON DELETE CASCADE not valid;

alter table "public"."steam_game_release_transitions" validate constraint "steam_game_release_transitions_steam_app_id_fkey";

alter table "public"."steam_games" add constraint "steam_games_release_exactness_check" CHECK (((release_precision <> 'exact'::text) OR (release_date IS NOT NULL))) not valid;

alter table "public"."steam_games" validate constraint "steam_games_release_exactness_check";

alter table "public"."steam_games" add constraint "steam_games_release_precision_check" CHECK ((release_precision = ANY (ARRAY['exact'::text, 'month'::text, 'quarter'::text, 'year'::text, 'tba'::text]))) not valid;

alter table "public"."steam_games" validate constraint "steam_games_release_precision_check";

alter table "public"."steam_games" add constraint "steam_games_release_text_check" CHECK (((release_text IS NULL) OR ((char_length(release_text) >= 1) AND (char_length(release_text) <= 120)))) not valid;

alter table "public"."steam_games" validate constraint "steam_games_release_text_check";

alter table "public"."steam_games" add constraint "steam_games_tag_source_check" CHECK ((tag_source = ANY (ARRAY['steam_store_tags'::text, 'appdetails_genres_fallback'::text, 'none'::text]))) not valid;

alter table "public"."steam_games" validate constraint "steam_games_tag_source_check";

alter table "public"."steam_games" add constraint "steam_games_tags_limit_check" CHECK ((cardinality(tags) <= 5)) not valid;

alter table "public"."steam_games" validate constraint "steam_games_tags_limit_check";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.claim_steam_media_jobs(p_limit integer, p_worker_id text, p_lease_seconds integer DEFAULT 900, p_app_id bigint DEFAULT NULL::bigint)
 RETURNS TABLE(steam_app_id bigint, source_payload jsonb, source_fingerprint text, consecutive_failures integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_steam_game_data_quality_report()
 RETURNS TABLE(total_games bigint, exact_release_count bigint, partial_release_count bigint, tba_release_count bigint, five_tags_count bigint, one_to_four_tags_count bigint, fallback_tags_count bigint, missing_tags_count bigint, two_screenshots_count bigint, one_screenshot_count bigint, media_unavailable_count bigint, media_pending_count bigint, media_failed_count bigint, stale_release_count bigint, stale_tag_count bigint, stale_media_count bigint, oldest_pending_at timestamp with time zone, most_recent_successful_run_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
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

CREATE OR REPLACE FUNCTION public.publish_steam_game_media(p_steam_app_id bigint, p_position smallint, p_original_source_url text, p_storage_bucket text, p_storage_path text, p_byte_size integer, p_width integer, p_height integer, p_checksum_sha256 text, p_encoder_quality smallint, p_source_updated_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(previous_storage_bucket text, previous_storage_path text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

grant delete on table "public"."steam_enrichment_runs" to "service_role";

grant insert on table "public"."steam_enrichment_runs" to "service_role";

grant references on table "public"."steam_enrichment_runs" to "service_role";

grant select on table "public"."steam_enrichment_runs" to "service_role";

grant trigger on table "public"."steam_enrichment_runs" to "service_role";

grant truncate on table "public"."steam_enrichment_runs" to "service_role";

grant update on table "public"."steam_enrichment_runs" to "service_role";

grant delete on table "public"."steam_game_enrichment_state" to "service_role";

grant insert on table "public"."steam_game_enrichment_state" to "service_role";

grant references on table "public"."steam_game_enrichment_state" to "service_role";

grant select on table "public"."steam_game_enrichment_state" to "service_role";

grant trigger on table "public"."steam_game_enrichment_state" to "service_role";

grant truncate on table "public"."steam_game_enrichment_state" to "service_role";

grant update on table "public"."steam_game_enrichment_state" to "service_role";

grant select on table "public"."steam_game_media" to "anon";

grant select on table "public"."steam_game_media" to "authenticated";

grant delete on table "public"."steam_game_media" to "service_role";

grant insert on table "public"."steam_game_media" to "service_role";

grant references on table "public"."steam_game_media" to "service_role";

grant select on table "public"."steam_game_media" to "service_role";

grant trigger on table "public"."steam_game_media" to "service_role";

grant truncate on table "public"."steam_game_media" to "service_role";

grant update on table "public"."steam_game_media" to "service_role";

grant delete on table "public"."steam_game_release_transitions" to "service_role";

grant insert on table "public"."steam_game_release_transitions" to "service_role";

grant references on table "public"."steam_game_release_transitions" to "service_role";

grant select on table "public"."steam_game_release_transitions" to "service_role";

grant trigger on table "public"."steam_game_release_transitions" to "service_role";

grant truncate on table "public"."steam_game_release_transitions" to "service_role";

grant update on table "public"."steam_game_release_transitions" to "service_role";


  create policy "steam_game_media_public_read"
  on "public"."steam_game_media"
  as permissive
  for select
  to anon, authenticated
using ((active = true));


CREATE TRIGGER steam_game_enrichment_state_set_updated_at BEFORE UPDATE ON public.steam_game_enrichment_state FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();


