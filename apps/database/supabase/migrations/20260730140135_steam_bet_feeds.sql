alter table "public"."steam_bets" add column "game_name" text;

alter table "public"."steam_bets" add column "image_url" text;

alter table "public"."steam_bets" add column "release_date" text;

alter table "public"."steam_bets" add column "release_label" text;

CREATE INDEX steam_bets_app_created_idx ON public.steam_bets USING btree (steam_app_id, created_at DESC);

alter table "public"."steam_bets" add constraint "steam_bets_snapshot_check" CHECK ((((game_name IS NULL) AND (release_date IS NULL) AND (release_label IS NULL) AND (image_url IS NULL)) OR ((game_name IS NOT NULL) AND (release_date IS NOT NULL) AND (release_label IS NOT NULL) AND (image_url IS NOT NULL)))) not valid;

alter table "public"."steam_bets" validate constraint "steam_bets_snapshot_check";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_steam_bet_trends()
 RETURNS TABLE(steam_app_id bigint, bet_count bigint, game_name text, release_date text, release_label text, image_url text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT
    bet.steam_app_id,
    count(*) AS bet_count,
    max(bet.game_name) AS game_name,
    max(bet.release_date) AS release_date,
    max(bet.release_label) AS release_label,
    max(bet.image_url) AS image_url
  FROM public.steam_bets AS bet
  GROUP BY bet.steam_app_id
  ORDER BY count(*) DESC, max(bet.created_at) DESC;
$function$
;

revoke all on function public.get_steam_bet_trends() from public;
grant execute on function public.get_steam_bet_trends() to anon, authenticated, service_role;
