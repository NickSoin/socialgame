create schema if not exists "private";

create type "public"."avatar_id" as enum ('steam_blue', 'neon_purple', 'pixel_green', 'ember_red', 'golden_controller', 'cyber_cat');

create type "public"."coin_ledger_reason" as enum ('signup_bonus', 'prediction_stake', 'prediction_payout');

create type "public"."market_status" as enum ('open', 'resolved');

create type "public"."prediction_outcome" as enum ('yes', 'no');

drop trigger if exists "set_updated_at_content_blog_post_comments" on "public"."content_blog_post_comments";

drop trigger if exists "set_updated_at_content_blog_posts" on "public"."content_blog_posts";

drop trigger if exists "set_owner_id_on_insert" on "public"."private_items";

drop policy "content_blog_post_comments_delete_policy" on "public"."content_blog_post_comments";

drop policy "content_blog_post_comments_insert_policy" on "public"."content_blog_post_comments";

drop policy "content_blog_post_comments_select_policy" on "public"."content_blog_post_comments";

drop policy "content_blog_post_comments_update_policy" on "public"."content_blog_post_comments";

drop policy "content_blog_posts_delete_policy" on "public"."content_blog_posts";

drop policy "content_blog_posts_insert_policy" on "public"."content_blog_posts";

drop policy "content_blog_posts_select_policy" on "public"."content_blog_posts";

drop policy "content_blog_posts_update_policy" on "public"."content_blog_posts";

drop policy "delete_own_policy" on "public"."private_items";

drop policy "insert_auth_policy" on "public"."private_items";

drop policy "select_all_policy" on "public"."private_items";

drop policy "update_own_policy" on "public"."private_items";

revoke delete on table "public"."content_blog_post_comments" from "anon";

revoke insert on table "public"."content_blog_post_comments" from "anon";

revoke references on table "public"."content_blog_post_comments" from "anon";

revoke select on table "public"."content_blog_post_comments" from "anon";

revoke trigger on table "public"."content_blog_post_comments" from "anon";

revoke truncate on table "public"."content_blog_post_comments" from "anon";

revoke update on table "public"."content_blog_post_comments" from "anon";

revoke delete on table "public"."content_blog_post_comments" from "authenticated";

revoke insert on table "public"."content_blog_post_comments" from "authenticated";

revoke references on table "public"."content_blog_post_comments" from "authenticated";

revoke select on table "public"."content_blog_post_comments" from "authenticated";

revoke trigger on table "public"."content_blog_post_comments" from "authenticated";

revoke truncate on table "public"."content_blog_post_comments" from "authenticated";

revoke update on table "public"."content_blog_post_comments" from "authenticated";

revoke delete on table "public"."content_blog_post_comments" from "service_role";

revoke insert on table "public"."content_blog_post_comments" from "service_role";

revoke references on table "public"."content_blog_post_comments" from "service_role";

revoke select on table "public"."content_blog_post_comments" from "service_role";

revoke trigger on table "public"."content_blog_post_comments" from "service_role";

revoke truncate on table "public"."content_blog_post_comments" from "service_role";

revoke update on table "public"."content_blog_post_comments" from "service_role";

revoke delete on table "public"."content_blog_posts" from "anon";

revoke insert on table "public"."content_blog_posts" from "anon";

revoke references on table "public"."content_blog_posts" from "anon";

revoke select on table "public"."content_blog_posts" from "anon";

revoke trigger on table "public"."content_blog_posts" from "anon";

revoke truncate on table "public"."content_blog_posts" from "anon";

revoke update on table "public"."content_blog_posts" from "anon";

revoke delete on table "public"."content_blog_posts" from "authenticated";

revoke insert on table "public"."content_blog_posts" from "authenticated";

revoke references on table "public"."content_blog_posts" from "authenticated";

revoke select on table "public"."content_blog_posts" from "authenticated";

revoke trigger on table "public"."content_blog_posts" from "authenticated";

revoke truncate on table "public"."content_blog_posts" from "authenticated";

revoke update on table "public"."content_blog_posts" from "authenticated";

revoke delete on table "public"."content_blog_posts" from "service_role";

revoke insert on table "public"."content_blog_posts" from "service_role";

revoke references on table "public"."content_blog_posts" from "service_role";

revoke select on table "public"."content_blog_posts" from "service_role";

revoke trigger on table "public"."content_blog_posts" from "service_role";

revoke truncate on table "public"."content_blog_posts" from "service_role";

revoke update on table "public"."content_blog_posts" from "service_role";

revoke delete on table "public"."private_items" from "anon";

revoke insert on table "public"."private_items" from "anon";

revoke references on table "public"."private_items" from "anon";

revoke select on table "public"."private_items" from "anon";

revoke trigger on table "public"."private_items" from "anon";

revoke truncate on table "public"."private_items" from "anon";

revoke update on table "public"."private_items" from "anon";

revoke delete on table "public"."private_items" from "authenticated";

revoke insert on table "public"."private_items" from "authenticated";

revoke references on table "public"."private_items" from "authenticated";

revoke select on table "public"."private_items" from "authenticated";

revoke trigger on table "public"."private_items" from "authenticated";

revoke truncate on table "public"."private_items" from "authenticated";

revoke update on table "public"."private_items" from "authenticated";

revoke delete on table "public"."private_items" from "service_role";

revoke insert on table "public"."private_items" from "service_role";

revoke references on table "public"."private_items" from "service_role";

revoke select on table "public"."private_items" from "service_role";

revoke trigger on table "public"."private_items" from "service_role";

revoke truncate on table "public"."private_items" from "service_role";

revoke update on table "public"."private_items" from "service_role";

alter table "public"."content_blog_post_comments" drop constraint "content_blog_post_comments_author_id_fkey";

alter table "public"."content_blog_post_comments" drop constraint "content_blog_post_comments_blog_post_id_fkey";

alter table "public"."content_blog_posts" drop constraint "content_blog_posts_author_id_fkey";

alter table "public"."private_items" drop constraint "private_items_owner_id_fkey";

drop function if exists "public"."set_private_item_owner_id"();

drop function if exists "public"."set_updated_at"();

alter table "public"."content_blog_post_comments" drop constraint "content_blog_post_comments_pkey";

alter table "public"."content_blog_posts" drop constraint "content_blog_posts_pkey";

alter table "public"."private_items" drop constraint "private_items_pkey";

drop index if exists "public"."content_blog_post_comments_author_id_idx";

drop index if exists "public"."content_blog_post_comments_pkey";

drop index if exists "public"."content_blog_post_comments_post_id_idx";

drop index if exists "public"."content_blog_posts_author_id_idx";

drop index if exists "public"."content_blog_posts_pkey";

drop index if exists "public"."content_blog_posts_published_at_idx";

drop index if exists "public"."content_blog_posts_slug_key";

drop index if exists "public"."idx_private_items_created_at";

drop index if exists "public"."idx_private_items_id_created_at";

drop index if exists "public"."idx_private_items_owner_id";

drop index if exists "public"."private_items_pkey";

drop table "public"."content_blog_post_comments";

drop table "public"."content_blog_posts";

drop table "public"."private_items";


  create table "private"."admin_users" (
    "user_id" uuid not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "private"."admin_users" enable row level security;


  create table "public"."coin_ledger" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "user_id" uuid not null,
    "amount" bigint not null,
    "balance_after" bigint not null,
    "reason" public.coin_ledger_reason not null,
    "market_id" uuid,
    "prediction_id" uuid,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."coin_ledger" enable row level security;


  create table "public"."markets" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "slug" text not null,
    "steam_app_id" integer not null,
    "steam_title" text not null,
    "question" text not null,
    "description" text not null,
    "category" text not null,
    "status" public.market_status not null default 'open'::public.market_status,
    "yes_price_bps" integer not null,
    "total_volume" bigint not null default 0,
    "closes_at" timestamp with time zone not null,
    "resolved_outcome" public.prediction_outcome,
    "header_image_url" text not null,
    "created_at" timestamp with time zone not null default now(),
    "resolved_at" timestamp with time zone
      );


alter table "public"."markets" enable row level security;


  create table "public"."predictions" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "user_id" uuid not null,
    "market_id" uuid not null,
    "outcome" public.prediction_outcome not null,
    "stake" integer not null,
    "price_bps" integer not null,
    "shares" bigint not null,
    "payout" bigint not null default 0,
    "is_correct" boolean,
    "created_at" timestamp with time zone not null default now(),
    "resolved_at" timestamp with time zone
      );


alter table "public"."predictions" enable row level security;


  create table "public"."profiles" (
    "id" uuid not null,
    "username" text not null,
    "display_name" text not null,
    "bio" text not null default ''::text,
    "avatar_id" public.avatar_id not null default 'steam_blue'::public.avatar_id,
    "links" jsonb not null default '{}'::jsonb,
    "coin_balance" bigint not null default 1000,
    "predictions_made" integer not null default 0,
    "predictions_resolved" integer not null default 0,
    "correct_predictions" integer not null default 0,
    "coins_wagered" bigint not null default 0,
    "coins_won" bigint not null default 0,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."profiles" enable row level security;

CREATE UNIQUE INDEX admin_users_pkey ON private.admin_users USING btree (user_id);

CREATE UNIQUE INDEX coin_ledger_pkey ON public.coin_ledger USING btree (id);

CREATE UNIQUE INDEX coin_ledger_prediction_reason_key ON public.coin_ledger USING btree (prediction_id, reason) WHERE (prediction_id IS NOT NULL);

CREATE INDEX coin_ledger_user_created_at_idx ON public.coin_ledger USING btree (user_id, created_at DESC);

CREATE UNIQUE INDEX markets_pkey ON public.markets USING btree (id);

CREATE UNIQUE INDEX markets_slug_key ON public.markets USING btree (slug);

CREATE INDEX markets_status_closes_at_idx ON public.markets USING btree (status, closes_at);

CREATE INDEX markets_steam_app_id_idx ON public.markets USING btree (steam_app_id);

CREATE INDEX predictions_market_id_idx ON public.predictions USING btree (market_id);

CREATE UNIQUE INDEX predictions_pkey ON public.predictions USING btree (id);

CREATE INDEX predictions_user_created_at_idx ON public.predictions USING btree (user_id, created_at DESC);

CREATE UNIQUE INDEX predictions_user_market_key ON public.predictions USING btree (user_id, market_id);

CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id);

CREATE UNIQUE INDEX profiles_username_key ON public.profiles USING btree (username);

alter table "private"."admin_users" add constraint "admin_users_pkey" PRIMARY KEY using index "admin_users_pkey";

alter table "public"."coin_ledger" add constraint "coin_ledger_pkey" PRIMARY KEY using index "coin_ledger_pkey";

alter table "public"."markets" add constraint "markets_pkey" PRIMARY KEY using index "markets_pkey";

alter table "public"."predictions" add constraint "predictions_pkey" PRIMARY KEY using index "predictions_pkey";

alter table "public"."profiles" add constraint "profiles_pkey" PRIMARY KEY using index "profiles_pkey";

alter table "private"."admin_users" add constraint "admin_users_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "private"."admin_users" validate constraint "admin_users_user_id_fkey";

alter table "public"."coin_ledger" add constraint "coin_ledger_amount_check" CHECK ((amount <> 0)) not valid;

alter table "public"."coin_ledger" validate constraint "coin_ledger_amount_check";

alter table "public"."coin_ledger" add constraint "coin_ledger_balance_after_check" CHECK ((balance_after >= 0)) not valid;

alter table "public"."coin_ledger" validate constraint "coin_ledger_balance_after_check";

alter table "public"."coin_ledger" add constraint "coin_ledger_reason_shape_check" CHECK ((((reason = 'signup_bonus'::public.coin_ledger_reason) AND (amount > 0) AND (market_id IS NULL) AND (prediction_id IS NULL)) OR ((reason = 'prediction_stake'::public.coin_ledger_reason) AND (amount < 0) AND (market_id IS NOT NULL) AND (prediction_id IS NOT NULL)) OR ((reason = 'prediction_payout'::public.coin_ledger_reason) AND (amount > 0) AND (market_id IS NOT NULL) AND (prediction_id IS NOT NULL)))) not valid;

alter table "public"."coin_ledger" validate constraint "coin_ledger_reason_shape_check";

alter table "public"."markets" add constraint "markets_category_length_check" CHECK (((char_length(btrim(category)) >= 2) AND (char_length(btrim(category)) <= 40))) not valid;

alter table "public"."markets" validate constraint "markets_category_length_check";

alter table "public"."markets" add constraint "markets_closes_after_creation_check" CHECK ((closes_at > created_at)) not valid;

alter table "public"."markets" validate constraint "markets_closes_after_creation_check";

alter table "public"."markets" add constraint "markets_description_length_check" CHECK (((char_length(description) >= 1) AND (char_length(description) <= 2000))) not valid;

alter table "public"."markets" validate constraint "markets_description_length_check";

alter table "public"."markets" add constraint "markets_header_image_url_check" CHECK ((header_image_url ~ '^https://'::text)) not valid;

alter table "public"."markets" validate constraint "markets_header_image_url_check";

alter table "public"."markets" add constraint "markets_question_length_check" CHECK (((char_length(btrim(question)) >= 10) AND (char_length(btrim(question)) <= 240))) not valid;

alter table "public"."markets" validate constraint "markets_question_length_check";

alter table "public"."markets" add constraint "markets_resolution_state_check" CHECK ((((status = 'open'::public.market_status) AND (resolved_outcome IS NULL) AND (resolved_at IS NULL)) OR ((status = 'resolved'::public.market_status) AND (resolved_outcome IS NOT NULL) AND (resolved_at IS NOT NULL)))) not valid;

alter table "public"."markets" validate constraint "markets_resolution_state_check";

alter table "public"."markets" add constraint "markets_slug_format_check" CHECK (((slug = lower(slug)) AND (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::text) AND ((char_length(slug) >= 3) AND (char_length(slug) <= 100)))) not valid;

alter table "public"."markets" validate constraint "markets_slug_format_check";

alter table "public"."markets" add constraint "markets_slug_key" UNIQUE using index "markets_slug_key";

alter table "public"."markets" add constraint "markets_steam_app_id_check" CHECK ((steam_app_id > 0)) not valid;

alter table "public"."markets" validate constraint "markets_steam_app_id_check";

alter table "public"."markets" add constraint "markets_steam_title_length_check" CHECK (((char_length(btrim(steam_title)) >= 1) AND (char_length(btrim(steam_title)) <= 120))) not valid;

alter table "public"."markets" validate constraint "markets_steam_title_length_check";

alter table "public"."markets" add constraint "markets_total_volume_check" CHECK ((total_volume >= 0)) not valid;

alter table "public"."markets" validate constraint "markets_total_volume_check";

alter table "public"."markets" add constraint "markets_yes_price_bps_check" CHECK (((yes_price_bps >= 100) AND (yes_price_bps <= 9900))) not valid;

alter table "public"."markets" validate constraint "markets_yes_price_bps_check";

alter table "public"."predictions" add constraint "predictions_market_id_fkey" FOREIGN KEY (market_id) REFERENCES public.markets(id) ON DELETE RESTRICT not valid;

alter table "public"."predictions" validate constraint "predictions_market_id_fkey";

alter table "public"."predictions" add constraint "predictions_payout_check" CHECK ((payout >= 0)) not valid;

alter table "public"."predictions" validate constraint "predictions_payout_check";

alter table "public"."predictions" add constraint "predictions_price_bps_check" CHECK (((price_bps >= 100) AND (price_bps <= 9900))) not valid;

alter table "public"."predictions" validate constraint "predictions_price_bps_check";

alter table "public"."predictions" add constraint "predictions_resolution_state_check" CHECK ((((is_correct IS NULL) AND (resolved_at IS NULL) AND (payout = 0)) OR ((is_correct IS NOT NULL) AND (resolved_at IS NOT NULL) AND ((is_correct AND (payout = shares)) OR ((NOT is_correct) AND (payout = 0)))))) not valid;

alter table "public"."predictions" validate constraint "predictions_resolution_state_check";

alter table "public"."predictions" add constraint "predictions_shares_check" CHECK ((shares > 0)) not valid;

alter table "public"."predictions" validate constraint "predictions_shares_check";

alter table "public"."predictions" add constraint "predictions_stake_check" CHECK (((stake >= 10) AND (stake <= 1000000))) not valid;

alter table "public"."predictions" validate constraint "predictions_stake_check";

alter table "public"."predictions" add constraint "predictions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."predictions" validate constraint "predictions_user_id_fkey";

alter table "public"."predictions" add constraint "predictions_user_market_key" UNIQUE using index "predictions_user_market_key";

alter table "public"."profiles" add constraint "profiles_bio_length_check" CHECK ((char_length(bio) <= 280)) not valid;

alter table "public"."profiles" validate constraint "profiles_bio_length_check";

alter table "public"."profiles" add constraint "profiles_coin_balance_check" CHECK ((coin_balance >= 0)) not valid;

alter table "public"."profiles" validate constraint "profiles_coin_balance_check";

alter table "public"."profiles" add constraint "profiles_coin_stats_check" CHECK (((coins_wagered >= 0) AND (coins_won >= 0))) not valid;

alter table "public"."profiles" validate constraint "profiles_coin_stats_check";

alter table "public"."profiles" add constraint "profiles_display_name_length_check" CHECK (((char_length(btrim(display_name)) >= 1) AND (char_length(btrim(display_name)) <= 50))) not valid;

alter table "public"."profiles" validate constraint "profiles_display_name_length_check";

alter table "public"."profiles" add constraint "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."profiles" validate constraint "profiles_id_fkey";

alter table "public"."profiles" add constraint "profiles_links_check" CHECK (((jsonb_typeof(links) = 'object'::text) AND (((((links - 'steam'::text) - 'twitch'::text) - 'youtube'::text) - 'website'::text) = '{}'::jsonb) AND (((links -> 'steam'::text) IS NULL) OR ((jsonb_typeof((links -> 'steam'::text)) = 'string'::text) AND ((char_length((links ->> 'steam'::text)) >= 8) AND (char_length((links ->> 'steam'::text)) <= 200)) AND ((links ->> 'steam'::text) ~ '^https://'::text))) AND (((links -> 'twitch'::text) IS NULL) OR ((jsonb_typeof((links -> 'twitch'::text)) = 'string'::text) AND ((char_length((links ->> 'twitch'::text)) >= 8) AND (char_length((links ->> 'twitch'::text)) <= 200)) AND ((links ->> 'twitch'::text) ~ '^https://'::text))) AND (((links -> 'youtube'::text) IS NULL) OR ((jsonb_typeof((links -> 'youtube'::text)) = 'string'::text) AND ((char_length((links ->> 'youtube'::text)) >= 8) AND (char_length((links ->> 'youtube'::text)) <= 200)) AND ((links ->> 'youtube'::text) ~ '^https://'::text))) AND (((links -> 'website'::text) IS NULL) OR ((jsonb_typeof((links -> 'website'::text)) = 'string'::text) AND ((char_length((links ->> 'website'::text)) >= 8) AND (char_length((links ->> 'website'::text)) <= 200)) AND ((links ->> 'website'::text) ~ '^https://'::text))))) not valid;

alter table "public"."profiles" validate constraint "profiles_links_check";

alter table "public"."profiles" add constraint "profiles_prediction_stats_check" CHECK (((predictions_made >= 0) AND (predictions_resolved >= 0) AND (correct_predictions >= 0) AND (correct_predictions <= predictions_resolved) AND (predictions_resolved <= predictions_made))) not valid;

alter table "public"."profiles" validate constraint "profiles_prediction_stats_check";

alter table "public"."profiles" add constraint "profiles_username_format_check" CHECK (((username = lower(username)) AND (username ~ '^[a-z0-9_]{3,24}$'::text))) not valid;

alter table "public"."profiles" validate constraint "profiles_username_format_check";

alter table "public"."profiles" add constraint "profiles_username_key" UNIQUE using index "profiles_username_key";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION private.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  generated_username text;
  generated_display_name text;
BEGIN
  generated_username := 'player_' || pg_catalog.substr(
    pg_catalog.replace(NEW.id::text, '-', ''),
    1,
    12
  );

  generated_display_name := pg_catalog.left(
    COALESCE(
      NULLIF(pg_catalog.btrim(NEW.raw_user_meta_data ->> 'display_name'), ''),
      NULLIF(pg_catalog.btrim(NEW.raw_user_meta_data ->> 'full_name'), ''),
      'Steam Predictor'
    ),
    50
  );

  INSERT INTO public.profiles (
    id,
    username,
    display_name,
    coin_balance
  )
  VALUES (
    NEW.id,
    generated_username,
    generated_display_name,
    1000
  );

  INSERT INTO public.coin_ledger (
    user_id,
    amount,
    balance_after,
    reason
  )
  VALUES (
    NEW.id,
    1000,
    1000,
    'signup_bonus'
  );

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION private.is_admin(candidate_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM private.admin_users
    WHERE user_id = candidate_user_id
  );
$function$
;

CREATE OR REPLACE FUNCTION private.reject_coin_ledger_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  RAISE EXCEPTION 'coin ledger entries are immutable'
    USING ERRCODE = '42501';
END;
$function$
;

CREATE OR REPLACE FUNCTION private.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  NEW.updated_at := pg_catalog.now();
  RETURN NEW;
END;
$function$
;

create or replace view "public"."leaderboard" as  SELECT profile.id,
    profile.username,
    profile.display_name,
    profile.avatar_id,
    profile.coin_balance,
    profile.predictions_made,
    profile.predictions_resolved,
    profile.correct_predictions,
    profile.coins_wagered,
    profile.coins_won,
        CASE
            WHEN (profile.predictions_resolved = 0) THEN 0
            ELSE ((((profile.correct_predictions)::bigint * 10000) / profile.predictions_resolved))::integer
        END AS accuracy_bps,
    dense_rank() OVER (ORDER BY profile.coin_balance DESC, profile.correct_predictions DESC, profile.created_at) AS coin_rank,
    dense_rank() OVER (ORDER BY
        CASE
            WHEN (profile.predictions_resolved = 0) THEN (0)::numeric
            ELSE ((profile.correct_predictions)::numeric / (profile.predictions_resolved)::numeric)
        END DESC, profile.correct_predictions DESC, profile.predictions_resolved DESC, profile.coin_balance DESC) AS accuracy_rank
   FROM public.profiles profile;


CREATE OR REPLACE FUNCTION public.place_prediction(p_market_id uuid, p_outcome text, p_stake integer)
 RETURNS public.predictions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  caller_id uuid := auth.uid();
  chosen_outcome public.prediction_outcome;
  selected_market public.markets%ROWTYPE;
  current_profile public.profiles%ROWTYPE;
  outcome_price_bps integer;
  calculated_shares bigint;
  created_prediction public.predictions%ROWTYPE;
  new_balance bigint;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  CASE pg_catalog.lower(pg_catalog.btrim(p_outcome))
    WHEN 'yes' THEN chosen_outcome := 'yes';
    WHEN 'no' THEN chosen_outcome := 'no';
    ELSE
      RAISE EXCEPTION 'outcome must be yes or no' USING ERRCODE = '22023';
  END CASE;

  IF p_stake IS NULL OR p_stake NOT BETWEEN 10 AND 1000000 THEN
    RAISE EXCEPTION 'stake must be between 10 and 1000000 coins'
      USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO selected_market
  FROM public.markets
  WHERE id = p_market_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'market not found' USING ERRCODE = 'P0002';
  END IF;

  IF selected_market.status <> 'open' OR selected_market.closes_at <= pg_catalog.now() THEN
    RAISE EXCEPTION 'market is closed' USING ERRCODE = '55000';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.predictions
    WHERE user_id = caller_id AND market_id = p_market_id
  ) THEN
    RAISE EXCEPTION 'a prediction already exists for this market'
      USING ERRCODE = '23505';
  END IF;

  SELECT *
  INTO current_profile
  FROM public.profiles
  WHERE id = caller_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile not found' USING ERRCODE = 'P0002';
  END IF;

  IF current_profile.coin_balance < p_stake THEN
    RAISE EXCEPTION 'insufficient coin balance' USING ERRCODE = '22003';
  END IF;

  outcome_price_bps := CASE chosen_outcome
    WHEN 'yes' THEN selected_market.yes_price_bps
    WHEN 'no' THEN 10000 - selected_market.yes_price_bps
  END;

  calculated_shares := (p_stake::bigint * 10000) / outcome_price_bps;
  new_balance := current_profile.coin_balance - p_stake;

  INSERT INTO public.predictions (
    user_id,
    market_id,
    outcome,
    stake,
    price_bps,
    shares
  )
  VALUES (
    caller_id,
    p_market_id,
    chosen_outcome,
    p_stake,
    outcome_price_bps,
    calculated_shares
  )
  RETURNING * INTO created_prediction;

  UPDATE public.profiles
  SET
    coin_balance = new_balance,
    predictions_made = predictions_made + 1,
    coins_wagered = coins_wagered + p_stake
  WHERE id = caller_id;

  UPDATE public.markets
  SET total_volume = total_volume + p_stake
  WHERE id = p_market_id;

  INSERT INTO public.coin_ledger (
    user_id,
    amount,
    balance_after,
    reason,
    market_id,
    prediction_id
  )
  VALUES (
    caller_id,
    -p_stake,
    new_balance,
    'prediction_stake',
    p_market_id,
    created_prediction.id
  );

  RETURN created_prediction;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.resolve_market(p_market_id uuid, p_outcome text)
 RETURNS public.markets
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  caller_id uuid := auth.uid();
  chosen_resolution public.prediction_outcome;
  selected_market public.markets%ROWTYPE;
BEGIN
  IF caller_id IS NULL OR NOT private.is_admin(caller_id) THEN
    RAISE EXCEPTION 'admin access required' USING ERRCODE = '42501';
  END IF;

  CASE pg_catalog.lower(pg_catalog.btrim(p_outcome))
    WHEN 'yes' THEN chosen_resolution := 'yes';
    WHEN 'no' THEN chosen_resolution := 'no';
    ELSE
      RAISE EXCEPTION 'outcome must be yes or no' USING ERRCODE = '22023';
  END CASE;

  SELECT *
  INTO selected_market
  FROM public.markets
  WHERE id = p_market_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'market not found' USING ERRCODE = 'P0002';
  END IF;

  IF selected_market.status = 'resolved' THEN
    IF selected_market.resolved_outcome = chosen_resolution THEN
      RETURN selected_market;
    END IF;

    RAISE EXCEPTION 'market was already resolved with another outcome'
      USING ERRCODE = '55000';
  END IF;

  IF selected_market.closes_at > pg_catalog.now() THEN
    RAISE EXCEPTION 'market has not closed yet' USING ERRCODE = '55000';
  END IF;

  UPDATE public.profiles AS profile
  SET
    coin_balance = profile.coin_balance + result.payout,
    predictions_resolved = profile.predictions_resolved + 1,
    correct_predictions = profile.correct_predictions + CASE WHEN result.is_correct THEN 1 ELSE 0 END,
    coins_won = profile.coins_won + result.payout
  FROM (
    SELECT
      prediction.user_id,
      prediction.outcome = chosen_resolution AS is_correct,
      CASE
        WHEN prediction.outcome = chosen_resolution THEN prediction.shares
        ELSE 0
      END AS payout
    FROM public.predictions AS prediction
    WHERE prediction.market_id = p_market_id
      AND prediction.resolved_at IS NULL
  ) AS result
  WHERE profile.id = result.user_id;

  UPDATE public.predictions AS prediction
  SET
    is_correct = prediction.outcome = chosen_resolution,
    payout = CASE
      WHEN prediction.outcome = chosen_resolution THEN prediction.shares
      ELSE 0
    END,
    resolved_at = pg_catalog.now()
  WHERE prediction.market_id = p_market_id
    AND prediction.resolved_at IS NULL;

  INSERT INTO public.coin_ledger (
    user_id,
    amount,
    balance_after,
    reason,
    market_id,
    prediction_id
  )
  SELECT
    prediction.user_id,
    prediction.payout,
    profile.coin_balance,
    'prediction_payout',
    prediction.market_id,
    prediction.id
  FROM public.predictions AS prediction
  JOIN public.profiles AS profile ON profile.id = prediction.user_id
  WHERE prediction.market_id = p_market_id
    AND prediction.is_correct
    AND prediction.payout > 0;

  UPDATE public.markets
  SET
    status = 'resolved',
    resolved_outcome = chosen_resolution,
    resolved_at = pg_catalog.now()
  WHERE id = p_market_id
  RETURNING * INTO selected_market;

  RETURN selected_market;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_own_profile(p_username text, p_display_name text, p_bio text, p_avatar_id text, p_links jsonb)
 RETURNS public.profiles
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  caller_id uuid := auth.uid();
  updated_profile public.profiles%ROWTYPE;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles
  SET
    username = pg_catalog.lower(pg_catalog.btrim(p_username)),
    display_name = pg_catalog.btrim(p_display_name),
    bio = COALESCE(p_bio, ''),
    avatar_id = p_avatar_id::public.avatar_id,
    links = COALESCE(p_links, '{}'::jsonb)
  WHERE id = caller_id
  RETURNING * INTO updated_profile;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile not found' USING ERRCODE = 'P0002';
  END IF;

  RETURN updated_profile;
END;
$function$
;

grant select on table "public"."coin_ledger" to "authenticated";

grant insert on table "public"."coin_ledger" to "service_role";

grant select on table "public"."coin_ledger" to "service_role";

grant select on table "public"."markets" to "anon";

grant select on table "public"."markets" to "authenticated";

grant delete on table "public"."markets" to "service_role";

grant insert on table "public"."markets" to "service_role";

grant references on table "public"."markets" to "service_role";

grant select on table "public"."markets" to "service_role";

grant trigger on table "public"."markets" to "service_role";

grant truncate on table "public"."markets" to "service_role";

grant update on table "public"."markets" to "service_role";

grant select on table "public"."predictions" to "authenticated";

grant delete on table "public"."predictions" to "service_role";

grant insert on table "public"."predictions" to "service_role";

grant references on table "public"."predictions" to "service_role";

grant select on table "public"."predictions" to "service_role";

grant trigger on table "public"."predictions" to "service_role";

grant truncate on table "public"."predictions" to "service_role";

grant update on table "public"."predictions" to "service_role";

grant select on table "public"."profiles" to "anon";

grant select on table "public"."profiles" to "authenticated";

grant delete on table "public"."profiles" to "service_role";

grant insert on table "public"."profiles" to "service_role";

grant references on table "public"."profiles" to "service_role";

grant select on table "public"."profiles" to "service_role";

grant trigger on table "public"."profiles" to "service_role";

grant truncate on table "public"."profiles" to "service_role";

grant update on table "public"."profiles" to "service_role";


  create policy "coin_ledger_read_own"
  on "public"."coin_ledger"
  as permissive
  for select
  to authenticated
using ((( SELECT auth.uid() AS uid) = user_id));



  create policy "markets_public_read"
  on "public"."markets"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "predictions_read_own"
  on "public"."predictions"
  as permissive
  for select
  to authenticated
using ((( SELECT auth.uid() AS uid) = user_id));



  create policy "profiles_public_read"
  on "public"."profiles"
  as permissive
  for select
  to anon, authenticated
using (true);


CREATE TRIGGER coin_ledger_reject_update_delete BEFORE DELETE OR UPDATE ON public.coin_ledger FOR EACH ROW EXECUTE FUNCTION private.reject_coin_ledger_mutation();

CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION private.handle_new_user();


