alter table "public"."steam_game_enrichment_state" drop constraint "steam_game_enrichment_state_component_check";

alter table "public"."steam_games" add column "follower_count" bigint;

alter table "public"."steam_games" add column "followers_updated_at" timestamp with time zone;

alter table "public"."steam_games" add constraint "steam_games_follower_count_check" CHECK (((follower_count IS NULL) OR (follower_count >= 0))) not valid;

alter table "public"."steam_games" validate constraint "steam_games_follower_count_check";

alter table "public"."steam_game_enrichment_state" add constraint "steam_game_enrichment_state_component_check" CHECK ((component = ANY (ARRAY['release'::text, 'tags'::text, 'media'::text, 'followers'::text]))) not valid;

alter table "public"."steam_game_enrichment_state" validate constraint "steam_game_enrichment_state_component_check";


