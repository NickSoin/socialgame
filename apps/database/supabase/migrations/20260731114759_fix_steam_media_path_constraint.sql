alter table "public"."steam_game_media" drop constraint "steam_game_media_path_check";

alter table "public"."steam_game_media" add constraint "steam_game_media_path_check" CHECK ((storage_path ~ '^[1-9][0-9]*/screenshots/[12]-[a-f0-9]{12}\.webp$'::text)) not valid;

alter table "public"."steam_game_media" validate constraint "steam_game_media_path_check";


