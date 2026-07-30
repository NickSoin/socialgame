drop policy "steam_bets_insert_own" on "public"."steam_bets";

alter table "public"."steam_games" add column "is_popular_upcoming" boolean not null default false;

alter table "public"."steam_games" add column "popular_upcoming_position" integer;

alter table "public"."steam_games" add column "steam_data_updated_at" timestamp with time zone;

CREATE INDEX steam_games_popular_release_rank_idx ON public.steam_games USING btree (release_date, wishlist_rank, popular_upcoming_position) WHERE ((lifecycle_status = 'upcoming'::text) AND (is_wishlisted = true) AND (is_popular_upcoming = true));

alter table "public"."steam_games" add constraint "steam_games_popular_position_check" CHECK ((((is_popular_upcoming = false) AND (popular_upcoming_position IS NULL)) OR ((is_popular_upcoming = true) AND ((popular_upcoming_position >= 1) AND (popular_upcoming_position <= 200))))) not valid;

alter table "public"."steam_games" validate constraint "steam_games_popular_position_check";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_steam_bet_summaries()
 RETURNS TABLE(steam_app_id bigint, target_key text, average_value numeric, prediction_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_steam_bet_trends()
 RETURNS TABLE(steam_app_id bigint, bet_count bigint, game_name text, release_date text, release_label text, image_url text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;


  create policy "steam_bets_insert_own"
  on "public"."steam_bets"
  as permissive
  for insert
  to authenticated
with check (((( SELECT auth.uid() AS uid) = user_id) AND (EXISTS ( SELECT 1
   FROM public.steam_games game
  WHERE ((game.steam_app_id = steam_bets.steam_app_id) AND (game.lifecycle_status = 'upcoming'::text) AND (game.is_wishlisted = true))))));



