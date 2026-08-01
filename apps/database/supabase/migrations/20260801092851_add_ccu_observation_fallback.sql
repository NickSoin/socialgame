
  create table "public"."steam_ccu_observations" (
    "id" bigint generated always as identity not null,
    "market_id" uuid not null,
    "observed_at" timestamp with time zone not null,
    "player_count" integer not null,
    "source_reference" text not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."steam_ccu_observations" enable row level security;

CREATE UNIQUE INDEX steam_ccu_observations_market_time_key ON public.steam_ccu_observations USING btree (market_id, observed_at);

CREATE INDEX steam_ccu_observations_peak_idx ON public.steam_ccu_observations USING btree (market_id, player_count DESC, observed_at);

CREATE UNIQUE INDEX steam_ccu_observations_pkey ON public.steam_ccu_observations USING btree (id);

alter table "public"."steam_ccu_observations" add constraint "steam_ccu_observations_pkey" PRIMARY KEY using index "steam_ccu_observations_pkey";

alter table "public"."steam_ccu_observations" add constraint "steam_ccu_observations_market_id_fkey" FOREIGN KEY (market_id) REFERENCES public.steam_forecast_markets(id) ON DELETE CASCADE not valid;

alter table "public"."steam_ccu_observations" validate constraint "steam_ccu_observations_market_id_fkey";

alter table "public"."steam_ccu_observations" add constraint "steam_ccu_observations_market_time_key" UNIQUE using index "steam_ccu_observations_market_time_key";

alter table "public"."steam_ccu_observations" add constraint "steam_ccu_observations_player_count_check" CHECK ((player_count >= 0)) not valid;

alter table "public"."steam_ccu_observations" validate constraint "steam_ccu_observations_player_count_check";

grant delete on table "public"."steam_ccu_observations" to "service_role";

grant insert on table "public"."steam_ccu_observations" to "service_role";

grant references on table "public"."steam_ccu_observations" to "service_role";

grant select on table "public"."steam_ccu_observations" to "service_role";

grant trigger on table "public"."steam_ccu_observations" to "service_role";

grant truncate on table "public"."steam_ccu_observations" to "service_role";

grant update on table "public"."steam_ccu_observations" to "service_role";


