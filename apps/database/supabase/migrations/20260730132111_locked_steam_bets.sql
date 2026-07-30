revoke delete on table "public"."forecast_targets" from "anon";

revoke insert on table "public"."forecast_targets" from "anon";

revoke references on table "public"."forecast_targets" from "anon";

revoke trigger on table "public"."forecast_targets" from "anon";

revoke truncate on table "public"."forecast_targets" from "anon";

revoke update on table "public"."forecast_targets" from "anon";

revoke delete on table "public"."forecast_targets" from "authenticated";

revoke insert on table "public"."forecast_targets" from "authenticated";

revoke references on table "public"."forecast_targets" from "authenticated";

revoke trigger on table "public"."forecast_targets" from "authenticated";

revoke truncate on table "public"."forecast_targets" from "authenticated";

revoke update on table "public"."forecast_targets" from "authenticated";

revoke delete on table "public"."numeric_predictions" from "anon";

revoke insert on table "public"."numeric_predictions" from "anon";

revoke references on table "public"."numeric_predictions" from "anon";

revoke select on table "public"."numeric_predictions" from "anon";

revoke trigger on table "public"."numeric_predictions" from "anon";

revoke truncate on table "public"."numeric_predictions" from "anon";

revoke update on table "public"."numeric_predictions" from "anon";

revoke delete on table "public"."numeric_predictions" from "authenticated";

revoke insert on table "public"."numeric_predictions" from "authenticated";

revoke references on table "public"."numeric_predictions" from "authenticated";

revoke trigger on table "public"."numeric_predictions" from "authenticated";

revoke truncate on table "public"."numeric_predictions" from "authenticated";

revoke update on table "public"."numeric_predictions" from "authenticated";


  create table "public"."steam_bets" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "steam_app_id" bigint not null,
    "target_key" text not null,
    "value" numeric not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."steam_bets" enable row level security;

CREATE UNIQUE INDEX steam_bets_pkey ON public.steam_bets USING btree (id);

CREATE INDEX steam_bets_user_created_idx ON public.steam_bets USING btree (user_id, created_at DESC);

CREATE UNIQUE INDEX steam_bets_user_game_target_key ON public.steam_bets USING btree (user_id, steam_app_id, target_key);

alter table "public"."steam_bets" add constraint "steam_bets_pkey" PRIMARY KEY using index "steam_bets_pkey";

alter table "public"."steam_bets" add constraint "steam_bets_app_id_check" CHECK ((steam_app_id > 0)) not valid;

alter table "public"."steam_bets" validate constraint "steam_bets_app_id_check";

alter table "public"."steam_bets" add constraint "steam_bets_target_key_check" CHECK ((target_key = ANY (ARRAY['first_weekend_ccu'::text, 'first_month_reviews'::text, 'full_price_us'::text]))) not valid;

alter table "public"."steam_bets" validate constraint "steam_bets_target_key_check";

alter table "public"."steam_bets" add constraint "steam_bets_user_game_target_key" UNIQUE using index "steam_bets_user_game_target_key";

alter table "public"."steam_bets" add constraint "steam_bets_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."steam_bets" validate constraint "steam_bets_user_id_fkey";

alter table "public"."steam_bets" add constraint "steam_bets_value_check" CHECK (((value >= (0)::numeric) AND (value <= (100000000)::numeric))) not valid;

alter table "public"."steam_bets" validate constraint "steam_bets_value_check";

grant insert on table "public"."steam_bets" to "authenticated";

grant select on table "public"."steam_bets" to "authenticated";

grant delete on table "public"."steam_bets" to "service_role";

grant insert on table "public"."steam_bets" to "service_role";

grant references on table "public"."steam_bets" to "service_role";

grant select on table "public"."steam_bets" to "service_role";

grant trigger on table "public"."steam_bets" to "service_role";

grant truncate on table "public"."steam_bets" to "service_role";

grant update on table "public"."steam_bets" to "service_role";


  create policy "steam_bets_insert_own"
  on "public"."steam_bets"
  as permissive
  for insert
  to authenticated
with check ((( SELECT auth.uid() AS uid) = user_id));



  create policy "steam_bets_read_own"
  on "public"."steam_bets"
  as permissive
  for select
  to authenticated
using ((( SELECT auth.uid() AS uid) = user_id));



