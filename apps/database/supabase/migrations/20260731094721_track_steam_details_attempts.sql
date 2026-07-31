alter table "public"."steam_games" add column "steam_data_attempted_at" timestamp with time zone;

CREATE INDEX steam_games_details_refresh_idx ON public.steam_games USING btree (steam_data_attempted_at NULLS FIRST, wishlist_rank) WHERE ((lifecycle_status = 'upcoming'::text) AND (is_wishlisted = true));


