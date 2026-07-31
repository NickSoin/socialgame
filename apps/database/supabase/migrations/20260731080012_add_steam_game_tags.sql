alter table "public"."steam_games" add column "tags" text[] not null default '{}'::text[];


