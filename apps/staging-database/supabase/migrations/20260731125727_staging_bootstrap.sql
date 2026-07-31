create extension if not exists "pg_cron" with schema "pg_catalog";

create schema if not exists "private";

create type "public"."avatar_id" as enum ('steam_blue', 'neon_purple', 'pixel_green', 'ember_red', 'golden_controller', 'cyber_cat');

create type "public"."coin_ledger_reason" as enum ('signup_bonus', 'prediction_stake', 'prediction_payout');

create type "public"."market_status" as enum ('open', 'resolved');

create type "public"."prediction_outcome" as enum ('yes', 'no');

create type "public"."simulation_market_status" as enum ('open', 'locked', 'resolved', 'void');

create type "public"."simulation_status" as enum ('draft', 'running', 'paused', 'archived');

create type "public"."staging_assignment_status" as enum ('pending', 'claimed', 'revoked');

create type "public"."staging_user_role" as enum ('user', 'game_designer');


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


  create table "public"."forecast_targets" (
    "id" uuid not null default gen_random_uuid(),
    "market_id" uuid not null,
    "key" text not null,
    "label" text not null,
    "unit" text not null,
    "min_value" numeric not null default 0,
    "max_value" numeric,
    "step" numeric not null default 1,
    "display_order" smallint not null default 0,
    "status" public.market_status not null default 'open'::public.market_status,
    "closes_at" timestamp with time zone not null,
    "resolved_value" numeric,
    "resolved_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."forecast_targets" enable row level security;


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


  create table "public"."numeric_predictions" (
    "id" uuid not null default gen_random_uuid(),
    "target_id" uuid not null,
    "user_id" uuid not null,
    "value" numeric not null,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."numeric_predictions" enable row level security;


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


  create table "public"."simulation_checkpoints" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "simulation_id" uuid not null,
    "name" text not null,
    "simulation_time" timestamp with time zone not null,
    "state" jsonb not null,
    "created_by" uuid not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."simulation_checkpoints" enable row level security;


  create table "public"."simulation_events" (
    "id" bigint generated always as identity not null,
    "simulation_id" uuid not null,
    "event_type" text not null,
    "event_at" timestamp with time zone not null,
    "actor_user_id" uuid,
    "player_id" uuid,
    "market_id" uuid,
    "payload" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."simulation_events" enable row level security;


  create table "public"."simulation_forecast_versions" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "simulation_id" uuid not null,
    "market_id" uuid not null,
    "player_id" uuid not null,
    "raw_value" numeric not null,
    "percentile_value" numeric not null,
    "valid_from" timestamp with time zone not null,
    "valid_to" timestamp with time zone,
    "source" text not null default 'manual'::text,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."simulation_forecast_versions" enable row level security;


  create table "public"."simulation_games" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "simulation_id" uuid not null,
    "steam_app_id" bigint,
    "name" text not null,
    "release_at" timestamp with time zone,
    "hero_url" text,
    "tags" text[] not null default '{}'::text[],
    "scenario_values" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."simulation_games" enable row level security;


  create table "public"."simulation_markets" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "simulation_id" uuid not null,
    "game_id" uuid not null,
    "metric_type" text not null,
    "status" public.simulation_market_status not null default 'open'::public.simulation_market_status,
    "lock_at" timestamp with time zone,
    "resolve_after" timestamp with time zone,
    "percentile_model_version" integer not null default 1,
    "void_reason" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."simulation_markets" enable row level security;


  create table "public"."simulation_players" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "simulation_id" uuid not null,
    "username" text not null,
    "display_name" text not null,
    "behavior" text not null default 'random'::text,
    "skill" numeric not null default 0.5,
    "metadata" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."simulation_players" enable row level security;


  create table "public"."simulation_results" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "simulation_id" uuid not null,
    "market_id" uuid not null,
    "result_version" integer not null,
    "actual_raw_value" numeric not null,
    "actual_percentile_value" numeric not null,
    "source_reference" text not null,
    "resolved_at" timestamp with time zone not null,
    "correction_note" text,
    "is_current" boolean not null default true,
    "created_by" uuid not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."simulation_results" enable row level security;


  create table "public"."simulation_scheduled_forecasts" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "simulation_id" uuid not null,
    "market_id" uuid not null,
    "player_id" uuid not null,
    "raw_value" numeric not null,
    "percentile_value" numeric not null,
    "scheduled_at" timestamp with time zone not null,
    "processed_at" timestamp with time zone,
    "source" text not null default 'bot'::text,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."simulation_scheduled_forecasts" enable row level security;


  create table "public"."simulation_score_entries" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "simulation_id" uuid not null,
    "score_run_id" uuid not null,
    "market_id" uuid not null,
    "snapshot_id" uuid not null,
    "player_id" uuid not null,
    "user_percentile" numeric not null,
    "crowd_without_user_percentile" numeric not null,
    "actual_percentile" numeric not null,
    "user_error" numeric not null,
    "crowd_error" numeric not null,
    "points" numeric not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."simulation_score_entries" enable row level security;


  create table "public"."simulation_score_runs" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "simulation_id" uuid not null,
    "market_id" uuid not null,
    "result_id" uuid not null,
    "run_version" integer not null,
    "reason" text not null,
    "formula_key" text not null default 'canonical'::text,
    "is_current" boolean not null default true,
    "created_by" uuid not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."simulation_score_runs" enable row level security;


  create table "public"."simulation_snapshot_predictions" (
    "simulation_id" uuid not null,
    "snapshot_id" uuid not null,
    "forecast_version_id" uuid not null,
    "player_id" uuid not null,
    "raw_value" numeric not null,
    "percentile_value" numeric not null
      );


alter table "public"."simulation_snapshot_predictions" enable row level security;


  create table "public"."simulation_snapshots" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "simulation_id" uuid not null,
    "market_id" uuid not null,
    "snapshot_at" timestamp with time zone not null,
    "eligible_prediction_count" integer not null default 0,
    "crowd_percentile" numeric,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."simulation_snapshots" enable row level security;


  create table "public"."simulations" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "name" text not null,
    "description" text not null default ''::text,
    "preset_key" text,
    "status" public.simulation_status not null default 'draft'::public.simulation_status,
    "simulation_time" timestamp with time zone not null,
    "started_at" timestamp with time zone,
    "archived_at" timestamp with time zone,
    "random_seed" bigint not null,
    "config" jsonb not null default '{}'::jsonb,
    "created_by" uuid not null,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."simulations" enable row level security;


  create table "public"."staging_pending_role_assignments" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "email" text not null,
    "role" public.staging_user_role not null,
    "status" public.staging_assignment_status not null default 'pending'::public.staging_assignment_status,
    "requested_by" uuid,
    "requested_at" timestamp with time zone not null default now(),
    "claimed_by" uuid,
    "claimed_at" timestamp with time zone,
    "revoked_by" uuid,
    "revoked_at" timestamp with time zone
      );


alter table "public"."staging_pending_role_assignments" enable row level security;


  create table "public"."staging_role_audit_log" (
    "id" bigint generated always as identity not null,
    "actor_user_id" uuid,
    "actor_email" text,
    "action" text not null,
    "target_user_id" uuid,
    "target_email" text,
    "previous_role" public.staging_user_role,
    "new_role" public.staging_user_role,
    "metadata" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."staging_role_audit_log" enable row level security;


  create table "public"."staging_user_roles" (
    "user_id" uuid not null,
    "role" public.staging_user_role not null default 'user'::public.staging_user_role,
    "granted_by" uuid,
    "granted_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."staging_user_roles" enable row level security;


  create table "public"."steam_bets" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "steam_app_id" bigint not null,
    "target_key" text not null,
    "value" numeric not null,
    "game_name" text,
    "release_date" text,
    "release_label" text,
    "image_url" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "percentile_value" numeric,
    "percentile_model_version" integer
      );


alter table "public"."steam_bets" enable row level security;


  create table "public"."steam_catalog_sync_runs" (
    "id" uuid not null default gen_random_uuid(),
    "source_updated_at" timestamp with time zone not null,
    "status" text not null default 'running'::text,
    "current_count" integer not null default 0,
    "released_count" integer not null default 0,
    "started_at" timestamp with time zone not null default now(),
    "finished_at" timestamp with time zone,
    "error_message" text
      );


alter table "public"."steam_catalog_sync_runs" enable row level security;


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


  create table "public"."steam_forecast_markets" (
    "id" uuid not null default gen_random_uuid(),
    "steam_app_id" bigint not null,
    "metric_type" text not null,
    "status" text not null default 'open'::text,
    "lock_at" timestamp with time zone,
    "resolve_after" timestamp with time zone,
    "source_release_date" date,
    "percentile_model_id" uuid not null,
    "percentile_model_version" integer not null,
    "scoring_start_at" timestamp with time zone not null,
    "void_reason" text,
    "voided_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."steam_forecast_markets" enable row level security;


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


  create table "public"."steam_games" (
    "steam_app_id" bigint not null,
    "name" text not null,
    "image_url" text not null,
    "release_date" date,
    "release_label" text not null default 'TBA'::text,
    "lifecycle_status" text not null default 'upcoming'::text,
    "wishlist_rank" integer,
    "wishlist_estimate" text,
    "pre_release_rank" integer,
    "is_wishlisted" boolean not null default true,
    "source" text not null default 'steam_wishlist_rank_v2'::text,
    "source_updated_at" timestamp with time zone not null,
    "first_seen_at" timestamp with time zone not null default now(),
    "last_seen_at" timestamp with time zone not null default now(),
    "released_at" timestamp with time zone,
    "updated_at" timestamp with time zone not null default now(),
    "is_popular_upcoming" boolean not null default false,
    "popular_upcoming_position" integer,
    "steam_data_updated_at" timestamp with time zone,
    "steam_data_attempted_at" timestamp with time zone,
    "tags" text[] not null default '{}'::text[],
    "release_text" text,
    "release_precision" text not null default 'tba'::text,
    "steam_coming_soon" boolean,
    "release_metadata_updated_at" timestamp with time zone,
    "tag_source" text not null default 'none'::text,
    "tags_updated_at" timestamp with time zone,
    "media_updated_at" timestamp with time zone
      );


alter table "public"."steam_games" enable row level security;


  create table "public"."steam_market_daily_snapshots" (
    "id" uuid not null default gen_random_uuid(),
    "market_id" uuid not null,
    "snapshot_date" date not null,
    "snapshot_at" timestamp with time zone not null,
    "eligible_prediction_count" integer not null default 0,
    "crowd_percentile" numeric,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."steam_market_daily_snapshots" enable row level security;


  create table "public"."steam_market_results" (
    "id" uuid not null default gen_random_uuid(),
    "market_id" uuid not null,
    "result_version" integer not null,
    "actual_raw_value" numeric not null,
    "actual_percentile_value" numeric not null,
    "source_reference" text not null,
    "resolved_at" timestamp with time zone not null,
    "correction_note" text,
    "is_current" boolean not null default true,
    "created_by" uuid,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."steam_market_results" enable row level security;


  create table "public"."steam_market_snapshot_predictions" (
    "snapshot_id" uuid not null,
    "prediction_version_id" uuid not null,
    "user_id" uuid not null,
    "raw_value" numeric not null,
    "percentile_value" numeric not null
      );


alter table "public"."steam_market_snapshot_predictions" enable row level security;


  create table "public"."steam_percentile_models" (
    "id" uuid not null default gen_random_uuid(),
    "metric_type" text not null,
    "model_version" integer not null,
    "dataset_reference" text not null,
    "sample_size" integer not null,
    "reference_values" numeric[] not null,
    "is_active" boolean not null default false,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."steam_percentile_models" enable row level security;


  create table "public"."steam_prediction_score_entries" (
    "id" uuid not null default gen_random_uuid(),
    "score_run_id" uuid not null,
    "market_id" uuid not null,
    "snapshot_id" uuid not null,
    "user_id" uuid not null,
    "user_percentile" numeric not null,
    "crowd_without_user_percentile" numeric not null,
    "actual_percentile" numeric not null,
    "points" numeric not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."steam_prediction_score_entries" enable row level security;


  create table "public"."steam_prediction_versions" (
    "id" uuid not null default gen_random_uuid(),
    "market_id" uuid not null,
    "user_id" uuid not null,
    "raw_value" numeric not null,
    "percentile_value" numeric not null,
    "percentile_model_version" integer not null,
    "valid_from" timestamp with time zone not null default now(),
    "valid_to" timestamp with time zone,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."steam_prediction_versions" enable row level security;


  create table "public"."steam_score_runs" (
    "id" uuid not null default gen_random_uuid(),
    "market_id" uuid not null,
    "result_id" uuid not null,
    "run_version" integer not null,
    "reason" text not null,
    "is_current" boolean not null default true,
    "created_by" uuid,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."steam_score_runs" enable row level security;


  create table "public"."steam_scoring_config" (
    "singleton" boolean not null default true,
    "scoring_start_at" timestamp with time zone not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."steam_scoring_config" enable row level security;


  create table "public"."steam_user_leaderboard_stats" (
    "user_id" uuid not null,
    "metric_type" text not null,
    "points" numeric not null default 0,
    "scored_days" integer not null default 0,
    "resolved_markets" integer not null default 0,
    "rank_position" bigint not null,
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."steam_user_leaderboard_stats" enable row level security;

CREATE UNIQUE INDEX admin_users_pkey ON private.admin_users USING btree (user_id);

CREATE UNIQUE INDEX coin_ledger_pkey ON public.coin_ledger USING btree (id);

CREATE UNIQUE INDEX coin_ledger_prediction_reason_key ON public.coin_ledger USING btree (prediction_id, reason) WHERE (prediction_id IS NOT NULL);

CREATE INDEX coin_ledger_user_created_at_idx ON public.coin_ledger USING btree (user_id, created_at DESC);

CREATE UNIQUE INDEX forecast_targets_market_key_key ON public.forecast_targets USING btree (market_id, key);

CREATE INDEX forecast_targets_market_order_idx ON public.forecast_targets USING btree (market_id, status, display_order);

CREATE UNIQUE INDEX forecast_targets_pkey ON public.forecast_targets USING btree (id);

CREATE UNIQUE INDEX markets_pkey ON public.markets USING btree (id);

CREATE UNIQUE INDEX markets_slug_key ON public.markets USING btree (slug);

CREATE INDEX markets_status_closes_at_idx ON public.markets USING btree (status, closes_at);

CREATE INDEX markets_steam_app_id_idx ON public.markets USING btree (steam_app_id);

CREATE UNIQUE INDEX numeric_predictions_pkey ON public.numeric_predictions USING btree (id);

CREATE INDEX numeric_predictions_target_idx ON public.numeric_predictions USING btree (target_id);

CREATE UNIQUE INDEX numeric_predictions_user_target_key ON public.numeric_predictions USING btree (user_id, target_id);

CREATE INDEX numeric_predictions_user_updated_idx ON public.numeric_predictions USING btree (user_id, updated_at DESC);

CREATE INDEX predictions_market_id_idx ON public.predictions USING btree (market_id);

CREATE UNIQUE INDEX predictions_pkey ON public.predictions USING btree (id);

CREATE INDEX predictions_user_created_at_idx ON public.predictions USING btree (user_id, created_at DESC);

CREATE UNIQUE INDEX predictions_user_market_key ON public.predictions USING btree (user_id, market_id);

CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id);

CREATE UNIQUE INDEX profiles_username_key ON public.profiles USING btree (username);

CREATE UNIQUE INDEX simulation_checkpoints_pkey ON public.simulation_checkpoints USING btree (id);

CREATE INDEX simulation_checkpoints_simulation_idx ON public.simulation_checkpoints USING btree (simulation_id, created_at DESC);

CREATE UNIQUE INDEX simulation_events_pkey ON public.simulation_events USING btree (id);

CREATE INDEX simulation_events_timeline_idx ON public.simulation_events USING btree (simulation_id, event_at DESC, id DESC);

CREATE UNIQUE INDEX simulation_forecast_versions_active_idx ON public.simulation_forecast_versions USING btree (simulation_id, market_id, player_id) WHERE (valid_to IS NULL);

CREATE INDEX simulation_forecast_versions_history_idx ON public.simulation_forecast_versions USING btree (simulation_id, market_id, player_id, valid_from DESC);

CREATE UNIQUE INDEX simulation_forecast_versions_pkey ON public.simulation_forecast_versions USING btree (id);

CREATE UNIQUE INDEX simulation_games_pkey ON public.simulation_games USING btree (id);

CREATE INDEX simulation_games_simulation_idx ON public.simulation_games USING btree (simulation_id, release_at);

CREATE UNIQUE INDEX simulation_games_unique_name ON public.simulation_games USING btree (simulation_id, name);

CREATE UNIQUE INDEX simulation_markets_pkey ON public.simulation_markets USING btree (id);

CREATE INDEX simulation_markets_simulation_status_idx ON public.simulation_markets USING btree (simulation_id, status, lock_at);

CREATE UNIQUE INDEX simulation_markets_unique_metric ON public.simulation_markets USING btree (simulation_id, game_id, metric_type);

CREATE UNIQUE INDEX simulation_players_pkey ON public.simulation_players USING btree (id);

CREATE INDEX simulation_players_simulation_idx ON public.simulation_players USING btree (simulation_id);

CREATE UNIQUE INDEX simulation_players_unique_username ON public.simulation_players USING btree (simulation_id, username);

CREATE UNIQUE INDEX simulation_results_current_idx ON public.simulation_results USING btree (simulation_id, market_id) WHERE (is_current = true);

CREATE UNIQUE INDEX simulation_results_pkey ON public.simulation_results USING btree (id);

CREATE UNIQUE INDEX simulation_results_unique_version ON public.simulation_results USING btree (simulation_id, market_id, result_version);

CREATE INDEX simulation_scheduled_due_idx ON public.simulation_scheduled_forecasts USING btree (simulation_id, scheduled_at) WHERE (processed_at IS NULL);

CREATE UNIQUE INDEX simulation_scheduled_forecasts_pkey ON public.simulation_scheduled_forecasts USING btree (id);

CREATE UNIQUE INDEX simulation_scheduled_unique_event ON public.simulation_scheduled_forecasts USING btree (simulation_id, market_id, player_id, scheduled_at);

CREATE UNIQUE INDEX simulation_score_entries_pkey ON public.simulation_score_entries USING btree (id);

CREATE INDEX simulation_score_entries_player_idx ON public.simulation_score_entries USING btree (simulation_id, player_id, market_id);

CREATE UNIQUE INDEX simulation_score_entries_unique_score ON public.simulation_score_entries USING btree (score_run_id, snapshot_id, player_id);

CREATE UNIQUE INDEX simulation_score_runs_current_idx ON public.simulation_score_runs USING btree (simulation_id, market_id, formula_key) WHERE (is_current = true);

CREATE UNIQUE INDEX simulation_score_runs_pkey ON public.simulation_score_runs USING btree (id);

CREATE UNIQUE INDEX simulation_score_runs_unique_version ON public.simulation_score_runs USING btree (simulation_id, market_id, formula_key, run_version);

CREATE UNIQUE INDEX simulation_snapshot_predictions_pkey ON public.simulation_snapshot_predictions USING btree (snapshot_id, player_id);

CREATE UNIQUE INDEX simulation_snapshots_pkey ON public.simulation_snapshots USING btree (id);

CREATE INDEX simulation_snapshots_simulation_idx ON public.simulation_snapshots USING btree (simulation_id, snapshot_at DESC);

CREATE UNIQUE INDEX simulation_snapshots_unique_time ON public.simulation_snapshots USING btree (simulation_id, market_id, snapshot_at);

CREATE UNIQUE INDEX simulations_pkey ON public.simulations USING btree (id);

CREATE INDEX simulations_status_updated_idx ON public.simulations USING btree (status, updated_at DESC);

CREATE UNIQUE INDEX staging_pending_role_assignment_active_email_idx ON public.staging_pending_role_assignments USING btree (email) WHERE (status = 'pending'::public.staging_assignment_status);

CREATE UNIQUE INDEX staging_pending_role_assignments_pkey ON public.staging_pending_role_assignments USING btree (id);

CREATE INDEX staging_role_audit_created_idx ON public.staging_role_audit_log USING btree (created_at DESC);

CREATE UNIQUE INDEX staging_role_audit_log_pkey ON public.staging_role_audit_log USING btree (id);

CREATE INDEX staging_role_audit_target_idx ON public.staging_role_audit_log USING btree (target_user_id, created_at DESC);

CREATE UNIQUE INDEX staging_user_roles_pkey ON public.staging_user_roles USING btree (user_id);

CREATE INDEX steam_bets_app_created_idx ON public.steam_bets USING btree (steam_app_id, created_at DESC);

CREATE UNIQUE INDEX steam_bets_pkey ON public.steam_bets USING btree (id);

CREATE INDEX steam_bets_user_created_idx ON public.steam_bets USING btree (user_id, created_at DESC);

CREATE UNIQUE INDEX steam_bets_user_game_target_key ON public.steam_bets USING btree (user_id, steam_app_id, target_key);

CREATE UNIQUE INDEX steam_catalog_sync_runs_pkey ON public.steam_catalog_sync_runs USING btree (id);

CREATE UNIQUE INDEX steam_catalog_sync_runs_source_updated_at_key ON public.steam_catalog_sync_runs USING btree (source_updated_at);

CREATE INDEX steam_catalog_sync_runs_started_idx ON public.steam_catalog_sync_runs USING btree (started_at DESC);

CREATE UNIQUE INDEX steam_enrichment_runs_pkey ON public.steam_enrichment_runs USING btree (id);

CREATE INDEX steam_enrichment_runs_started_idx ON public.steam_enrichment_runs USING btree (started_at DESC);

CREATE UNIQUE INDEX steam_forecast_markets_game_metric_key ON public.steam_forecast_markets USING btree (steam_app_id, metric_type);

CREATE UNIQUE INDEX steam_forecast_markets_pkey ON public.steam_forecast_markets USING btree (id);

CREATE INDEX steam_game_enrichment_retry_idx ON public.steam_game_enrichment_state USING btree (component, status, retry_after NULLS FIRST, lease_expires_at NULLS FIRST) WHERE (status = ANY (ARRAY['pending'::text, 'error'::text, 'partial'::text]));

CREATE UNIQUE INDEX steam_game_enrichment_state_pkey ON public.steam_game_enrichment_state USING btree (steam_app_id, component);

CREATE INDEX steam_game_media_active_catalog_idx ON public.steam_game_media USING btree (steam_app_id, "position") WHERE (active = true);

CREATE UNIQUE INDEX steam_game_media_active_position_idx ON public.steam_game_media USING btree (steam_app_id, kind, "position") WHERE (active = true);

CREATE UNIQUE INDEX steam_game_media_pkey ON public.steam_game_media USING btree (id);

CREATE UNIQUE INDEX steam_game_media_storage_path_key ON public.steam_game_media USING btree (storage_bucket, storage_path);

CREATE INDEX steam_game_release_transitions_game_idx ON public.steam_game_release_transitions USING btree (steam_app_id, observed_at DESC);

CREATE UNIQUE INDEX steam_game_release_transitions_pkey ON public.steam_game_release_transitions USING btree (id);

CREATE INDEX steam_games_current_rank_idx ON public.steam_games USING btree (lifecycle_status, is_wishlisted, wishlist_rank) WHERE ((lifecycle_status = 'upcoming'::text) AND (is_wishlisted = true));

CREATE INDEX steam_games_details_refresh_idx ON public.steam_games USING btree (steam_data_attempted_at NULLS FIRST, wishlist_rank) WHERE ((lifecycle_status = 'upcoming'::text) AND (is_wishlisted = true));

CREATE INDEX steam_games_name_search_idx ON public.steam_games USING btree (lower(name) text_pattern_ops);

CREATE UNIQUE INDEX steam_games_pkey ON public.steam_games USING btree (steam_app_id);

CREATE INDEX steam_games_popular_release_rank_idx ON public.steam_games USING btree (release_date, wishlist_rank, popular_upcoming_position) WHERE ((lifecycle_status = 'upcoming'::text) AND (is_wishlisted = true) AND (is_popular_upcoming = true));

CREATE INDEX steam_games_source_updated_idx ON public.steam_games USING btree (source_updated_at DESC);

CREATE UNIQUE INDEX steam_market_daily_snapshots_key ON public.steam_market_daily_snapshots USING btree (market_id, snapshot_date);

CREATE UNIQUE INDEX steam_market_daily_snapshots_pkey ON public.steam_market_daily_snapshots USING btree (id);

CREATE UNIQUE INDEX steam_market_results_current_idx ON public.steam_market_results USING btree (market_id) WHERE (is_current = true);

CREATE UNIQUE INDEX steam_market_results_pkey ON public.steam_market_results USING btree (id);

CREATE UNIQUE INDEX steam_market_results_version_key ON public.steam_market_results USING btree (market_id, result_version);

CREATE UNIQUE INDEX steam_market_snapshot_predictions_pkey ON public.steam_market_snapshot_predictions USING btree (snapshot_id, user_id);

CREATE UNIQUE INDEX steam_percentile_models_active_idx ON public.steam_percentile_models USING btree (metric_type) WHERE (is_active = true);

CREATE UNIQUE INDEX steam_percentile_models_metric_version_key ON public.steam_percentile_models USING btree (metric_type, model_version);

CREATE UNIQUE INDEX steam_percentile_models_pkey ON public.steam_percentile_models USING btree (id);

CREATE UNIQUE INDEX steam_prediction_score_entries_key ON public.steam_prediction_score_entries USING btree (score_run_id, snapshot_id, user_id);

CREATE UNIQUE INDEX steam_prediction_score_entries_pkey ON public.steam_prediction_score_entries USING btree (id);

CREATE INDEX steam_prediction_score_entries_user_idx ON public.steam_prediction_score_entries USING btree (user_id, market_id);

CREATE UNIQUE INDEX steam_prediction_versions_active_idx ON public.steam_prediction_versions USING btree (market_id, user_id) WHERE (valid_to IS NULL);

CREATE INDEX steam_prediction_versions_history_idx ON public.steam_prediction_versions USING btree (market_id, user_id, valid_from DESC);

CREATE UNIQUE INDEX steam_prediction_versions_pkey ON public.steam_prediction_versions USING btree (id);

CREATE UNIQUE INDEX steam_score_runs_current_idx ON public.steam_score_runs USING btree (market_id) WHERE (is_current = true);

CREATE UNIQUE INDEX steam_score_runs_pkey ON public.steam_score_runs USING btree (id);

CREATE UNIQUE INDEX steam_score_runs_version_key ON public.steam_score_runs USING btree (market_id, run_version);

CREATE UNIQUE INDEX steam_scoring_config_pkey ON public.steam_scoring_config USING btree (singleton);

CREATE UNIQUE INDEX steam_user_leaderboard_stats_pkey ON public.steam_user_leaderboard_stats USING btree (user_id, metric_type);

CREATE INDEX steam_user_leaderboard_stats_rank_idx ON public.steam_user_leaderboard_stats USING btree (metric_type, rank_position);

alter table "private"."admin_users" add constraint "admin_users_pkey" PRIMARY KEY using index "admin_users_pkey";

alter table "public"."coin_ledger" add constraint "coin_ledger_pkey" PRIMARY KEY using index "coin_ledger_pkey";

alter table "public"."forecast_targets" add constraint "forecast_targets_pkey" PRIMARY KEY using index "forecast_targets_pkey";

alter table "public"."markets" add constraint "markets_pkey" PRIMARY KEY using index "markets_pkey";

alter table "public"."numeric_predictions" add constraint "numeric_predictions_pkey" PRIMARY KEY using index "numeric_predictions_pkey";

alter table "public"."predictions" add constraint "predictions_pkey" PRIMARY KEY using index "predictions_pkey";

alter table "public"."profiles" add constraint "profiles_pkey" PRIMARY KEY using index "profiles_pkey";

alter table "public"."simulation_checkpoints" add constraint "simulation_checkpoints_pkey" PRIMARY KEY using index "simulation_checkpoints_pkey";

alter table "public"."simulation_events" add constraint "simulation_events_pkey" PRIMARY KEY using index "simulation_events_pkey";

alter table "public"."simulation_forecast_versions" add constraint "simulation_forecast_versions_pkey" PRIMARY KEY using index "simulation_forecast_versions_pkey";

alter table "public"."simulation_games" add constraint "simulation_games_pkey" PRIMARY KEY using index "simulation_games_pkey";

alter table "public"."simulation_markets" add constraint "simulation_markets_pkey" PRIMARY KEY using index "simulation_markets_pkey";

alter table "public"."simulation_players" add constraint "simulation_players_pkey" PRIMARY KEY using index "simulation_players_pkey";

alter table "public"."simulation_results" add constraint "simulation_results_pkey" PRIMARY KEY using index "simulation_results_pkey";

alter table "public"."simulation_scheduled_forecasts" add constraint "simulation_scheduled_forecasts_pkey" PRIMARY KEY using index "simulation_scheduled_forecasts_pkey";

alter table "public"."simulation_score_entries" add constraint "simulation_score_entries_pkey" PRIMARY KEY using index "simulation_score_entries_pkey";

alter table "public"."simulation_score_runs" add constraint "simulation_score_runs_pkey" PRIMARY KEY using index "simulation_score_runs_pkey";

alter table "public"."simulation_snapshot_predictions" add constraint "simulation_snapshot_predictions_pkey" PRIMARY KEY using index "simulation_snapshot_predictions_pkey";

alter table "public"."simulation_snapshots" add constraint "simulation_snapshots_pkey" PRIMARY KEY using index "simulation_snapshots_pkey";

alter table "public"."simulations" add constraint "simulations_pkey" PRIMARY KEY using index "simulations_pkey";

alter table "public"."staging_pending_role_assignments" add constraint "staging_pending_role_assignments_pkey" PRIMARY KEY using index "staging_pending_role_assignments_pkey";

alter table "public"."staging_role_audit_log" add constraint "staging_role_audit_log_pkey" PRIMARY KEY using index "staging_role_audit_log_pkey";

alter table "public"."staging_user_roles" add constraint "staging_user_roles_pkey" PRIMARY KEY using index "staging_user_roles_pkey";

alter table "public"."steam_bets" add constraint "steam_bets_pkey" PRIMARY KEY using index "steam_bets_pkey";

alter table "public"."steam_catalog_sync_runs" add constraint "steam_catalog_sync_runs_pkey" PRIMARY KEY using index "steam_catalog_sync_runs_pkey";

alter table "public"."steam_enrichment_runs" add constraint "steam_enrichment_runs_pkey" PRIMARY KEY using index "steam_enrichment_runs_pkey";

alter table "public"."steam_forecast_markets" add constraint "steam_forecast_markets_pkey" PRIMARY KEY using index "steam_forecast_markets_pkey";

alter table "public"."steam_game_enrichment_state" add constraint "steam_game_enrichment_state_pkey" PRIMARY KEY using index "steam_game_enrichment_state_pkey";

alter table "public"."steam_game_media" add constraint "steam_game_media_pkey" PRIMARY KEY using index "steam_game_media_pkey";

alter table "public"."steam_game_release_transitions" add constraint "steam_game_release_transitions_pkey" PRIMARY KEY using index "steam_game_release_transitions_pkey";

alter table "public"."steam_games" add constraint "steam_games_pkey" PRIMARY KEY using index "steam_games_pkey";

alter table "public"."steam_market_daily_snapshots" add constraint "steam_market_daily_snapshots_pkey" PRIMARY KEY using index "steam_market_daily_snapshots_pkey";

alter table "public"."steam_market_results" add constraint "steam_market_results_pkey" PRIMARY KEY using index "steam_market_results_pkey";

alter table "public"."steam_market_snapshot_predictions" add constraint "steam_market_snapshot_predictions_pkey" PRIMARY KEY using index "steam_market_snapshot_predictions_pkey";

alter table "public"."steam_percentile_models" add constraint "steam_percentile_models_pkey" PRIMARY KEY using index "steam_percentile_models_pkey";

alter table "public"."steam_prediction_score_entries" add constraint "steam_prediction_score_entries_pkey" PRIMARY KEY using index "steam_prediction_score_entries_pkey";

alter table "public"."steam_prediction_versions" add constraint "steam_prediction_versions_pkey" PRIMARY KEY using index "steam_prediction_versions_pkey";

alter table "public"."steam_score_runs" add constraint "steam_score_runs_pkey" PRIMARY KEY using index "steam_score_runs_pkey";

alter table "public"."steam_scoring_config" add constraint "steam_scoring_config_pkey" PRIMARY KEY using index "steam_scoring_config_pkey";

alter table "public"."steam_user_leaderboard_stats" add constraint "steam_user_leaderboard_stats_pkey" PRIMARY KEY using index "steam_user_leaderboard_stats_pkey";

alter table "private"."admin_users" add constraint "admin_users_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "private"."admin_users" validate constraint "admin_users_user_id_fkey";

alter table "public"."coin_ledger" add constraint "coin_ledger_amount_check" CHECK ((amount <> 0)) not valid;

alter table "public"."coin_ledger" validate constraint "coin_ledger_amount_check";

alter table "public"."coin_ledger" add constraint "coin_ledger_balance_after_check" CHECK ((balance_after >= 0)) not valid;

alter table "public"."coin_ledger" validate constraint "coin_ledger_balance_after_check";

alter table "public"."coin_ledger" add constraint "coin_ledger_reason_shape_check" CHECK ((((reason = 'signup_bonus'::public.coin_ledger_reason) AND (amount > 0) AND (market_id IS NULL) AND (prediction_id IS NULL)) OR ((reason = 'prediction_stake'::public.coin_ledger_reason) AND (amount < 0) AND (market_id IS NOT NULL) AND (prediction_id IS NOT NULL)) OR ((reason = 'prediction_payout'::public.coin_ledger_reason) AND (amount > 0) AND (market_id IS NOT NULL) AND (prediction_id IS NOT NULL)))) not valid;

alter table "public"."coin_ledger" validate constraint "coin_ledger_reason_shape_check";

alter table "public"."forecast_targets" add constraint "forecast_targets_key_check" CHECK ((key ~ '^[a-z0-9_]+$'::text)) not valid;

alter table "public"."forecast_targets" validate constraint "forecast_targets_key_check";

alter table "public"."forecast_targets" add constraint "forecast_targets_label_check" CHECK (((char_length(label) >= 1) AND (char_length(label) <= 80))) not valid;

alter table "public"."forecast_targets" validate constraint "forecast_targets_label_check";

alter table "public"."forecast_targets" add constraint "forecast_targets_market_id_fkey" FOREIGN KEY (market_id) REFERENCES public.markets(id) ON DELETE CASCADE not valid;

alter table "public"."forecast_targets" validate constraint "forecast_targets_market_id_fkey";

alter table "public"."forecast_targets" add constraint "forecast_targets_market_key_key" UNIQUE using index "forecast_targets_market_key_key";

alter table "public"."forecast_targets" add constraint "forecast_targets_range_check" CHECK (((step > (0)::numeric) AND ((max_value IS NULL) OR (max_value > min_value)))) not valid;

alter table "public"."forecast_targets" validate constraint "forecast_targets_range_check";

alter table "public"."forecast_targets" add constraint "forecast_targets_resolution_check" CHECK ((((status = 'open'::public.market_status) AND (resolved_value IS NULL) AND (resolved_at IS NULL)) OR ((status = 'resolved'::public.market_status) AND (resolved_value IS NOT NULL) AND (resolved_at IS NOT NULL)))) not valid;

alter table "public"."forecast_targets" validate constraint "forecast_targets_resolution_check";

alter table "public"."forecast_targets" add constraint "forecast_targets_unit_check" CHECK ((unit = ANY (ARRAY['players'::text, 'reviews'::text, 'usd'::text, 'score'::text]))) not valid;

alter table "public"."forecast_targets" validate constraint "forecast_targets_unit_check";

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

alter table "public"."numeric_predictions" add constraint "numeric_predictions_target_id_fkey" FOREIGN KEY (target_id) REFERENCES public.forecast_targets(id) ON DELETE CASCADE not valid;

alter table "public"."numeric_predictions" validate constraint "numeric_predictions_target_id_fkey";

alter table "public"."numeric_predictions" add constraint "numeric_predictions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."numeric_predictions" validate constraint "numeric_predictions_user_id_fkey";

alter table "public"."numeric_predictions" add constraint "numeric_predictions_user_target_key" UNIQUE using index "numeric_predictions_user_target_key";

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

alter table "public"."simulation_checkpoints" add constraint "simulation_checkpoints_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE RESTRICT not valid;

alter table "public"."simulation_checkpoints" validate constraint "simulation_checkpoints_created_by_fkey";

alter table "public"."simulation_checkpoints" add constraint "simulation_checkpoints_name_check" CHECK (((char_length(btrim(name)) >= 1) AND (char_length(btrim(name)) <= 100))) not valid;

alter table "public"."simulation_checkpoints" validate constraint "simulation_checkpoints_name_check";

alter table "public"."simulation_checkpoints" add constraint "simulation_checkpoints_simulation_id_fkey" FOREIGN KEY (simulation_id) REFERENCES public.simulations(id) ON DELETE CASCADE not valid;

alter table "public"."simulation_checkpoints" validate constraint "simulation_checkpoints_simulation_id_fkey";

alter table "public"."simulation_checkpoints" add constraint "simulation_checkpoints_state_check" CHECK ((jsonb_typeof(state) = 'object'::text)) not valid;

alter table "public"."simulation_checkpoints" validate constraint "simulation_checkpoints_state_check";

alter table "public"."simulation_events" add constraint "simulation_events_payload_check" CHECK ((jsonb_typeof(payload) = 'object'::text)) not valid;

alter table "public"."simulation_events" validate constraint "simulation_events_payload_check";

alter table "public"."simulation_events" add constraint "simulation_events_simulation_id_fkey" FOREIGN KEY (simulation_id) REFERENCES public.simulations(id) ON DELETE CASCADE not valid;

alter table "public"."simulation_events" validate constraint "simulation_events_simulation_id_fkey";

alter table "public"."simulation_forecast_versions" add constraint "simulation_forecast_versions_market_id_fkey" FOREIGN KEY (market_id) REFERENCES public.simulation_markets(id) ON DELETE CASCADE not valid;

alter table "public"."simulation_forecast_versions" validate constraint "simulation_forecast_versions_market_id_fkey";

alter table "public"."simulation_forecast_versions" add constraint "simulation_forecast_versions_player_id_fkey" FOREIGN KEY (player_id) REFERENCES public.simulation_players(id) ON DELETE CASCADE not valid;

alter table "public"."simulation_forecast_versions" validate constraint "simulation_forecast_versions_player_id_fkey";

alter table "public"."simulation_forecast_versions" add constraint "simulation_forecast_versions_simulation_id_fkey" FOREIGN KEY (simulation_id) REFERENCES public.simulations(id) ON DELETE CASCADE not valid;

alter table "public"."simulation_forecast_versions" validate constraint "simulation_forecast_versions_simulation_id_fkey";

alter table "public"."simulation_forecast_versions" add constraint "simulation_forecasts_percentile_check" CHECK (((percentile_value >= (0)::numeric) AND (percentile_value <= (100)::numeric))) not valid;

alter table "public"."simulation_forecast_versions" validate constraint "simulation_forecasts_percentile_check";

alter table "public"."simulation_forecast_versions" add constraint "simulation_forecasts_raw_check" CHECK ((raw_value >= (0)::numeric)) not valid;

alter table "public"."simulation_forecast_versions" validate constraint "simulation_forecasts_raw_check";

alter table "public"."simulation_forecast_versions" add constraint "simulation_forecasts_validity_check" CHECK (((valid_to IS NULL) OR (valid_to >= valid_from))) not valid;

alter table "public"."simulation_forecast_versions" validate constraint "simulation_forecasts_validity_check";

alter table "public"."simulation_games" add constraint "simulation_games_name_check" CHECK (((char_length(btrim(name)) >= 1) AND (char_length(btrim(name)) <= 160))) not valid;

alter table "public"."simulation_games" validate constraint "simulation_games_name_check";

alter table "public"."simulation_games" add constraint "simulation_games_simulation_id_fkey" FOREIGN KEY (simulation_id) REFERENCES public.simulations(id) ON DELETE CASCADE not valid;

alter table "public"."simulation_games" validate constraint "simulation_games_simulation_id_fkey";

alter table "public"."simulation_games" add constraint "simulation_games_tags_check" CHECK ((cardinality(tags) <= 10)) not valid;

alter table "public"."simulation_games" validate constraint "simulation_games_tags_check";

alter table "public"."simulation_games" add constraint "simulation_games_unique_name" UNIQUE using index "simulation_games_unique_name";

alter table "public"."simulation_games" add constraint "simulation_games_values_check" CHECK ((jsonb_typeof(scenario_values) = 'object'::text)) not valid;

alter table "public"."simulation_games" validate constraint "simulation_games_values_check";

alter table "public"."simulation_markets" add constraint "simulation_markets_game_id_fkey" FOREIGN KEY (game_id) REFERENCES public.simulation_games(id) ON DELETE CASCADE not valid;

alter table "public"."simulation_markets" validate constraint "simulation_markets_game_id_fkey";

alter table "public"."simulation_markets" add constraint "simulation_markets_metric_check" CHECK ((metric_type = ANY (ARRAY['first_weekend_ccu'::text, 'first_month_reviews'::text, 'full_price_us'::text]))) not valid;

alter table "public"."simulation_markets" validate constraint "simulation_markets_metric_check";

alter table "public"."simulation_markets" add constraint "simulation_markets_simulation_id_fkey" FOREIGN KEY (simulation_id) REFERENCES public.simulations(id) ON DELETE CASCADE not valid;

alter table "public"."simulation_markets" validate constraint "simulation_markets_simulation_id_fkey";

alter table "public"."simulation_markets" add constraint "simulation_markets_unique_metric" UNIQUE using index "simulation_markets_unique_metric";

alter table "public"."simulation_markets" add constraint "simulation_markets_void_check" CHECK ((((status = 'void'::public.simulation_market_status) AND (NULLIF(btrim(void_reason), ''::text) IS NOT NULL)) OR (status <> 'void'::public.simulation_market_status))) not valid;

alter table "public"."simulation_markets" validate constraint "simulation_markets_void_check";

alter table "public"."simulation_players" add constraint "simulation_players_behavior_check" CHECK ((behavior = ANY (ARRAY['follower'::text, 'contrarian'::text, 'expert'::text, 'late'::text, 'random'::text, 'outlier'::text]))) not valid;

alter table "public"."simulation_players" validate constraint "simulation_players_behavior_check";

alter table "public"."simulation_players" add constraint "simulation_players_metadata_check" CHECK ((jsonb_typeof(metadata) = 'object'::text)) not valid;

alter table "public"."simulation_players" validate constraint "simulation_players_metadata_check";

alter table "public"."simulation_players" add constraint "simulation_players_simulation_id_fkey" FOREIGN KEY (simulation_id) REFERENCES public.simulations(id) ON DELETE CASCADE not valid;

alter table "public"."simulation_players" validate constraint "simulation_players_simulation_id_fkey";

alter table "public"."simulation_players" add constraint "simulation_players_skill_check" CHECK (((skill >= (0)::numeric) AND (skill <= (1)::numeric))) not valid;

alter table "public"."simulation_players" validate constraint "simulation_players_skill_check";

alter table "public"."simulation_players" add constraint "simulation_players_unique_username" UNIQUE using index "simulation_players_unique_username";

alter table "public"."simulation_players" add constraint "simulation_players_username_check" CHECK (((username = lower(username)) AND (username ~ '^[a-z0-9_]{3,32}$'::text))) not valid;

alter table "public"."simulation_players" validate constraint "simulation_players_username_check";

alter table "public"."simulation_results" add constraint "simulation_results_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE RESTRICT not valid;

alter table "public"."simulation_results" validate constraint "simulation_results_created_by_fkey";

alter table "public"."simulation_results" add constraint "simulation_results_market_id_fkey" FOREIGN KEY (market_id) REFERENCES public.simulation_markets(id) ON DELETE CASCADE not valid;

alter table "public"."simulation_results" validate constraint "simulation_results_market_id_fkey";

alter table "public"."simulation_results" add constraint "simulation_results_percentile_check" CHECK (((actual_percentile_value >= (0)::numeric) AND (actual_percentile_value <= (100)::numeric))) not valid;

alter table "public"."simulation_results" validate constraint "simulation_results_percentile_check";

alter table "public"."simulation_results" add constraint "simulation_results_raw_check" CHECK ((actual_raw_value >= (0)::numeric)) not valid;

alter table "public"."simulation_results" validate constraint "simulation_results_raw_check";

alter table "public"."simulation_results" add constraint "simulation_results_simulation_id_fkey" FOREIGN KEY (simulation_id) REFERENCES public.simulations(id) ON DELETE CASCADE not valid;

alter table "public"."simulation_results" validate constraint "simulation_results_simulation_id_fkey";

alter table "public"."simulation_results" add constraint "simulation_results_unique_version" UNIQUE using index "simulation_results_unique_version";

alter table "public"."simulation_scheduled_forecasts" add constraint "simulation_scheduled_forecasts_market_id_fkey" FOREIGN KEY (market_id) REFERENCES public.simulation_markets(id) ON DELETE CASCADE not valid;

alter table "public"."simulation_scheduled_forecasts" validate constraint "simulation_scheduled_forecasts_market_id_fkey";

alter table "public"."simulation_scheduled_forecasts" add constraint "simulation_scheduled_forecasts_player_id_fkey" FOREIGN KEY (player_id) REFERENCES public.simulation_players(id) ON DELETE CASCADE not valid;

alter table "public"."simulation_scheduled_forecasts" validate constraint "simulation_scheduled_forecasts_player_id_fkey";

alter table "public"."simulation_scheduled_forecasts" add constraint "simulation_scheduled_forecasts_simulation_id_fkey" FOREIGN KEY (simulation_id) REFERENCES public.simulations(id) ON DELETE CASCADE not valid;

alter table "public"."simulation_scheduled_forecasts" validate constraint "simulation_scheduled_forecasts_simulation_id_fkey";

alter table "public"."simulation_scheduled_forecasts" add constraint "simulation_scheduled_percentile_check" CHECK (((percentile_value >= (0)::numeric) AND (percentile_value <= (100)::numeric))) not valid;

alter table "public"."simulation_scheduled_forecasts" validate constraint "simulation_scheduled_percentile_check";

alter table "public"."simulation_scheduled_forecasts" add constraint "simulation_scheduled_raw_check" CHECK ((raw_value >= (0)::numeric)) not valid;

alter table "public"."simulation_scheduled_forecasts" validate constraint "simulation_scheduled_raw_check";

alter table "public"."simulation_scheduled_forecasts" add constraint "simulation_scheduled_unique_event" UNIQUE using index "simulation_scheduled_unique_event";

alter table "public"."simulation_score_entries" add constraint "simulation_score_entries_market_id_fkey" FOREIGN KEY (market_id) REFERENCES public.simulation_markets(id) ON DELETE CASCADE not valid;

alter table "public"."simulation_score_entries" validate constraint "simulation_score_entries_market_id_fkey";

alter table "public"."simulation_score_entries" add constraint "simulation_score_entries_percentiles_check" CHECK ((((user_percentile >= (0)::numeric) AND (user_percentile <= (100)::numeric)) AND ((crowd_without_user_percentile >= (0)::numeric) AND (crowd_without_user_percentile <= (100)::numeric)) AND ((actual_percentile >= (0)::numeric) AND (actual_percentile <= (100)::numeric)))) not valid;

alter table "public"."simulation_score_entries" validate constraint "simulation_score_entries_percentiles_check";

alter table "public"."simulation_score_entries" add constraint "simulation_score_entries_player_id_fkey" FOREIGN KEY (player_id) REFERENCES public.simulation_players(id) ON DELETE CASCADE not valid;

alter table "public"."simulation_score_entries" validate constraint "simulation_score_entries_player_id_fkey";

alter table "public"."simulation_score_entries" add constraint "simulation_score_entries_score_run_id_fkey" FOREIGN KEY (score_run_id) REFERENCES public.simulation_score_runs(id) ON DELETE CASCADE not valid;

alter table "public"."simulation_score_entries" validate constraint "simulation_score_entries_score_run_id_fkey";

alter table "public"."simulation_score_entries" add constraint "simulation_score_entries_simulation_id_fkey" FOREIGN KEY (simulation_id) REFERENCES public.simulations(id) ON DELETE CASCADE not valid;

alter table "public"."simulation_score_entries" validate constraint "simulation_score_entries_simulation_id_fkey";

alter table "public"."simulation_score_entries" add constraint "simulation_score_entries_snapshot_id_fkey" FOREIGN KEY (snapshot_id) REFERENCES public.simulation_snapshots(id) ON DELETE CASCADE not valid;

alter table "public"."simulation_score_entries" validate constraint "simulation_score_entries_snapshot_id_fkey";

alter table "public"."simulation_score_entries" add constraint "simulation_score_entries_unique_score" UNIQUE using index "simulation_score_entries_unique_score";

alter table "public"."simulation_score_runs" add constraint "simulation_score_runs_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE RESTRICT not valid;

alter table "public"."simulation_score_runs" validate constraint "simulation_score_runs_created_by_fkey";

alter table "public"."simulation_score_runs" add constraint "simulation_score_runs_market_id_fkey" FOREIGN KEY (market_id) REFERENCES public.simulation_markets(id) ON DELETE CASCADE not valid;

alter table "public"."simulation_score_runs" validate constraint "simulation_score_runs_market_id_fkey";

alter table "public"."simulation_score_runs" add constraint "simulation_score_runs_result_id_fkey" FOREIGN KEY (result_id) REFERENCES public.simulation_results(id) ON DELETE RESTRICT not valid;

alter table "public"."simulation_score_runs" validate constraint "simulation_score_runs_result_id_fkey";

alter table "public"."simulation_score_runs" add constraint "simulation_score_runs_simulation_id_fkey" FOREIGN KEY (simulation_id) REFERENCES public.simulations(id) ON DELETE CASCADE not valid;

alter table "public"."simulation_score_runs" validate constraint "simulation_score_runs_simulation_id_fkey";

alter table "public"."simulation_score_runs" add constraint "simulation_score_runs_unique_version" UNIQUE using index "simulation_score_runs_unique_version";

alter table "public"."simulation_snapshot_predictions" add constraint "simulation_snapshot_prediction_percentile_check" CHECK (((percentile_value >= (0)::numeric) AND (percentile_value <= (100)::numeric))) not valid;

alter table "public"."simulation_snapshot_predictions" validate constraint "simulation_snapshot_prediction_percentile_check";

alter table "public"."simulation_snapshot_predictions" add constraint "simulation_snapshot_predictions_forecast_version_id_fkey" FOREIGN KEY (forecast_version_id) REFERENCES public.simulation_forecast_versions(id) ON DELETE RESTRICT not valid;

alter table "public"."simulation_snapshot_predictions" validate constraint "simulation_snapshot_predictions_forecast_version_id_fkey";

alter table "public"."simulation_snapshot_predictions" add constraint "simulation_snapshot_predictions_player_id_fkey" FOREIGN KEY (player_id) REFERENCES public.simulation_players(id) ON DELETE CASCADE not valid;

alter table "public"."simulation_snapshot_predictions" validate constraint "simulation_snapshot_predictions_player_id_fkey";

alter table "public"."simulation_snapshot_predictions" add constraint "simulation_snapshot_predictions_simulation_id_fkey" FOREIGN KEY (simulation_id) REFERENCES public.simulations(id) ON DELETE CASCADE not valid;

alter table "public"."simulation_snapshot_predictions" validate constraint "simulation_snapshot_predictions_simulation_id_fkey";

alter table "public"."simulation_snapshot_predictions" add constraint "simulation_snapshot_predictions_snapshot_id_fkey" FOREIGN KEY (snapshot_id) REFERENCES public.simulation_snapshots(id) ON DELETE CASCADE not valid;

alter table "public"."simulation_snapshot_predictions" validate constraint "simulation_snapshot_predictions_snapshot_id_fkey";

alter table "public"."simulation_snapshots" add constraint "simulation_snapshots_count_check" CHECK ((eligible_prediction_count >= 0)) not valid;

alter table "public"."simulation_snapshots" validate constraint "simulation_snapshots_count_check";

alter table "public"."simulation_snapshots" add constraint "simulation_snapshots_market_id_fkey" FOREIGN KEY (market_id) REFERENCES public.simulation_markets(id) ON DELETE CASCADE not valid;

alter table "public"."simulation_snapshots" validate constraint "simulation_snapshots_market_id_fkey";

alter table "public"."simulation_snapshots" add constraint "simulation_snapshots_percentile_check" CHECK (((crowd_percentile IS NULL) OR ((crowd_percentile >= (0)::numeric) AND (crowd_percentile <= (100)::numeric)))) not valid;

alter table "public"."simulation_snapshots" validate constraint "simulation_snapshots_percentile_check";

alter table "public"."simulation_snapshots" add constraint "simulation_snapshots_simulation_id_fkey" FOREIGN KEY (simulation_id) REFERENCES public.simulations(id) ON DELETE CASCADE not valid;

alter table "public"."simulation_snapshots" validate constraint "simulation_snapshots_simulation_id_fkey";

alter table "public"."simulation_snapshots" add constraint "simulation_snapshots_unique_time" UNIQUE using index "simulation_snapshots_unique_time";

alter table "public"."simulations" add constraint "simulations_config_check" CHECK ((jsonb_typeof(config) = 'object'::text)) not valid;

alter table "public"."simulations" validate constraint "simulations_config_check";

alter table "public"."simulations" add constraint "simulations_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE RESTRICT not valid;

alter table "public"."simulations" validate constraint "simulations_created_by_fkey";

alter table "public"."simulations" add constraint "simulations_description_check" CHECK ((char_length(description) <= 1000)) not valid;

alter table "public"."simulations" validate constraint "simulations_description_check";

alter table "public"."simulations" add constraint "simulations_name_check" CHECK (((char_length(btrim(name)) >= 1) AND (char_length(btrim(name)) <= 100))) not valid;

alter table "public"."simulations" validate constraint "simulations_name_check";

alter table "public"."simulations" add constraint "simulations_status_dates_check" CHECK (((status <> 'archived'::public.simulation_status) OR (archived_at IS NOT NULL))) not valid;

alter table "public"."simulations" validate constraint "simulations_status_dates_check";

alter table "public"."staging_pending_role_assignments" add constraint "staging_pending_email_normalized_check" CHECK (((email = lower(btrim(email))) AND (email ~ '^[^@[:space:]]+@[^@[:space:]]+$'::text))) not valid;

alter table "public"."staging_pending_role_assignments" validate constraint "staging_pending_email_normalized_check";

alter table "public"."staging_pending_role_assignments" add constraint "staging_pending_role_assignments_claimed_by_fkey" FOREIGN KEY (claimed_by) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."staging_pending_role_assignments" validate constraint "staging_pending_role_assignments_claimed_by_fkey";

alter table "public"."staging_pending_role_assignments" add constraint "staging_pending_role_assignments_requested_by_fkey" FOREIGN KEY (requested_by) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."staging_pending_role_assignments" validate constraint "staging_pending_role_assignments_requested_by_fkey";

alter table "public"."staging_pending_role_assignments" add constraint "staging_pending_role_assignments_revoked_by_fkey" FOREIGN KEY (revoked_by) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."staging_pending_role_assignments" validate constraint "staging_pending_role_assignments_revoked_by_fkey";

alter table "public"."staging_pending_role_assignments" add constraint "staging_pending_role_check" CHECK ((role = 'game_designer'::public.staging_user_role)) not valid;

alter table "public"."staging_pending_role_assignments" validate constraint "staging_pending_role_check";

alter table "public"."staging_pending_role_assignments" add constraint "staging_pending_state_check" CHECK ((((status = 'pending'::public.staging_assignment_status) AND (claimed_by IS NULL) AND (claimed_at IS NULL) AND (revoked_by IS NULL) AND (revoked_at IS NULL)) OR ((status = 'claimed'::public.staging_assignment_status) AND (claimed_by IS NOT NULL) AND (claimed_at IS NOT NULL) AND (revoked_by IS NULL) AND (revoked_at IS NULL)) OR ((status = 'revoked'::public.staging_assignment_status) AND (revoked_by IS NOT NULL) AND (revoked_at IS NOT NULL)))) not valid;

alter table "public"."staging_pending_role_assignments" validate constraint "staging_pending_state_check";

alter table "public"."staging_role_audit_log" add constraint "staging_role_audit_action_check" CHECK ((action = ANY (ARRAY['role_granted'::text, 'role_revoked'::text, 'assignment_created'::text, 'assignment_claimed'::text, 'assignment_revoked'::text, 'access_denied'::text]))) not valid;

alter table "public"."staging_role_audit_log" validate constraint "staging_role_audit_action_check";

alter table "public"."staging_role_audit_log" add constraint "staging_role_audit_metadata_check" CHECK ((jsonb_typeof(metadata) = 'object'::text)) not valid;

alter table "public"."staging_role_audit_log" validate constraint "staging_role_audit_metadata_check";

alter table "public"."staging_user_roles" add constraint "staging_user_roles_granted_by_fkey" FOREIGN KEY (granted_by) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."staging_user_roles" validate constraint "staging_user_roles_granted_by_fkey";

alter table "public"."staging_user_roles" add constraint "staging_user_roles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."staging_user_roles" validate constraint "staging_user_roles_user_id_fkey";

alter table "public"."steam_bets" add constraint "steam_bets_app_id_check" CHECK ((steam_app_id > 0)) not valid;

alter table "public"."steam_bets" validate constraint "steam_bets_app_id_check";

alter table "public"."steam_bets" add constraint "steam_bets_snapshot_check" CHECK ((((game_name IS NULL) AND (release_date IS NULL) AND (release_label IS NULL) AND (image_url IS NULL)) OR ((game_name IS NOT NULL) AND (release_date IS NOT NULL) AND (release_label IS NOT NULL) AND (image_url IS NOT NULL)))) not valid;

alter table "public"."steam_bets" validate constraint "steam_bets_snapshot_check";

alter table "public"."steam_bets" add constraint "steam_bets_target_key_check" CHECK ((target_key = ANY (ARRAY['first_weekend_ccu'::text, 'first_month_reviews'::text, 'full_price_us'::text]))) not valid;

alter table "public"."steam_bets" validate constraint "steam_bets_target_key_check";

alter table "public"."steam_bets" add constraint "steam_bets_user_game_target_key" UNIQUE using index "steam_bets_user_game_target_key";

alter table "public"."steam_bets" add constraint "steam_bets_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."steam_bets" validate constraint "steam_bets_user_id_fkey";

alter table "public"."steam_bets" add constraint "steam_bets_value_check" CHECK (((value >= (0)::numeric) AND (value <= (100000000)::numeric))) not valid;

alter table "public"."steam_bets" validate constraint "steam_bets_value_check";

alter table "public"."steam_catalog_sync_runs" add constraint "steam_catalog_sync_runs_completion_check" CHECK ((((status = 'running'::text) AND (finished_at IS NULL)) OR ((status = ANY (ARRAY['success'::text, 'error'::text])) AND (finished_at IS NOT NULL)))) not valid;

alter table "public"."steam_catalog_sync_runs" validate constraint "steam_catalog_sync_runs_completion_check";

alter table "public"."steam_catalog_sync_runs" add constraint "steam_catalog_sync_runs_counts_check" CHECK (((current_count >= 0) AND (released_count >= 0))) not valid;

alter table "public"."steam_catalog_sync_runs" validate constraint "steam_catalog_sync_runs_counts_check";

alter table "public"."steam_catalog_sync_runs" add constraint "steam_catalog_sync_runs_source_updated_at_key" UNIQUE using index "steam_catalog_sync_runs_source_updated_at_key";

alter table "public"."steam_catalog_sync_runs" add constraint "steam_catalog_sync_runs_status_check" CHECK ((status = ANY (ARRAY['running'::text, 'success'::text, 'error'::text]))) not valid;

alter table "public"."steam_catalog_sync_runs" validate constraint "steam_catalog_sync_runs_status_check";

alter table "public"."steam_enrichment_runs" add constraint "steam_enrichment_runs_completion_check" CHECK ((((status = 'running'::text) AND (finished_at IS NULL)) OR ((status <> 'running'::text) AND (finished_at IS NOT NULL)))) not valid;

alter table "public"."steam_enrichment_runs" validate constraint "steam_enrichment_runs_completion_check";

alter table "public"."steam_enrichment_runs" add constraint "steam_enrichment_runs_counts_check" CHECK (((selected_count >= 0) AND (succeeded_count >= 0) AND (partial_count >= 0) AND (unavailable_count >= 0) AND (failed_count >= 0) AND (released_count >= 0) AND (uploaded_count >= 0) AND (skipped_unchanged_count >= 0) AND (still_pending_count >= 0))) not valid;

alter table "public"."steam_enrichment_runs" validate constraint "steam_enrichment_runs_counts_check";

alter table "public"."steam_enrichment_runs" add constraint "steam_enrichment_runs_error_message_check" CHECK (((error_message IS NULL) OR (char_length(error_message) <= 1000))) not valid;

alter table "public"."steam_enrichment_runs" validate constraint "steam_enrichment_runs_error_message_check";

alter table "public"."steam_enrichment_runs" add constraint "steam_enrichment_runs_status_check" CHECK ((status = ANY (ARRAY['running'::text, 'success'::text, 'partial'::text, 'error'::text, 'already_running'::text]))) not valid;

alter table "public"."steam_enrichment_runs" validate constraint "steam_enrichment_runs_status_check";

alter table "public"."steam_forecast_markets" add constraint "steam_forecast_markets_game_metric_key" UNIQUE using index "steam_forecast_markets_game_metric_key";

alter table "public"."steam_forecast_markets" add constraint "steam_forecast_markets_metric_check" CHECK ((metric_type = ANY (ARRAY['first_weekend_ccu'::text, 'first_month_reviews'::text, 'full_price_us'::text]))) not valid;

alter table "public"."steam_forecast_markets" validate constraint "steam_forecast_markets_metric_check";

alter table "public"."steam_forecast_markets" add constraint "steam_forecast_markets_percentile_model_id_fkey" FOREIGN KEY (percentile_model_id) REFERENCES public.steam_percentile_models(id) ON DELETE RESTRICT not valid;

alter table "public"."steam_forecast_markets" validate constraint "steam_forecast_markets_percentile_model_id_fkey";

alter table "public"."steam_forecast_markets" add constraint "steam_forecast_markets_status_check" CHECK ((status = ANY (ARRAY['open'::text, 'locked'::text, 'resolved'::text, 'void'::text]))) not valid;

alter table "public"."steam_forecast_markets" validate constraint "steam_forecast_markets_status_check";

alter table "public"."steam_forecast_markets" add constraint "steam_forecast_markets_steam_app_id_fkey" FOREIGN KEY (steam_app_id) REFERENCES public.steam_games(steam_app_id) ON DELETE RESTRICT not valid;

alter table "public"."steam_forecast_markets" validate constraint "steam_forecast_markets_steam_app_id_fkey";

alter table "public"."steam_forecast_markets" add constraint "steam_forecast_markets_void_check" CHECK ((((status = 'void'::text) AND (void_reason IS NOT NULL) AND (voided_at IS NOT NULL)) OR (status <> 'void'::text))) not valid;

alter table "public"."steam_forecast_markets" validate constraint "steam_forecast_markets_void_check";

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

alter table "public"."steam_game_media" add constraint "steam_game_media_path_check" CHECK ((storage_path ~ '^[1-9][0-9]*/screenshots/[12]-[a-f0-9]{12}[.]webp$'::text)) not valid;

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

alter table "public"."steam_games" add constraint "steam_games_app_id_check" CHECK ((steam_app_id > 0)) not valid;

alter table "public"."steam_games" validate constraint "steam_games_app_id_check";

alter table "public"."steam_games" add constraint "steam_games_image_url_check" CHECK ((image_url ~ '^https://'::text)) not valid;

alter table "public"."steam_games" validate constraint "steam_games_image_url_check";

alter table "public"."steam_games" add constraint "steam_games_lifecycle_check" CHECK ((lifecycle_status = ANY (ARRAY['upcoming'::text, 'released'::text]))) not valid;

alter table "public"."steam_games" validate constraint "steam_games_lifecycle_check";

alter table "public"."steam_games" add constraint "steam_games_name_check" CHECK (((char_length(name) >= 1) AND (char_length(name) <= 250))) not valid;

alter table "public"."steam_games" validate constraint "steam_games_name_check";

alter table "public"."steam_games" add constraint "steam_games_popular_position_check" CHECK ((((is_popular_upcoming = false) AND (popular_upcoming_position IS NULL)) OR ((is_popular_upcoming = true) AND ((popular_upcoming_position >= 1) AND (popular_upcoming_position <= 200))))) not valid;

alter table "public"."steam_games" validate constraint "steam_games_popular_position_check";

alter table "public"."steam_games" add constraint "steam_games_pre_release_rank_check" CHECK (((pre_release_rank IS NULL) OR ((pre_release_rank >= 1) AND (pre_release_rank <= 10000)))) not valid;

alter table "public"."steam_games" validate constraint "steam_games_pre_release_rank_check";

alter table "public"."steam_games" add constraint "steam_games_release_exactness_check" CHECK (((release_precision <> 'exact'::text) OR (release_date IS NOT NULL))) not valid;

alter table "public"."steam_games" validate constraint "steam_games_release_exactness_check";

alter table "public"."steam_games" add constraint "steam_games_release_label_check" CHECK (((char_length(release_label) >= 1) AND (char_length(release_label) <= 80))) not valid;

alter table "public"."steam_games" validate constraint "steam_games_release_label_check";

alter table "public"."steam_games" add constraint "steam_games_release_precision_check" CHECK ((release_precision = ANY (ARRAY['exact'::text, 'month'::text, 'quarter'::text, 'year'::text, 'tba'::text]))) not valid;

alter table "public"."steam_games" validate constraint "steam_games_release_precision_check";

alter table "public"."steam_games" add constraint "steam_games_release_state_check" CHECK ((((lifecycle_status = 'upcoming'::text) AND (released_at IS NULL)) OR ((lifecycle_status = 'released'::text) AND (released_at IS NOT NULL)))) not valid;

alter table "public"."steam_games" validate constraint "steam_games_release_state_check";

alter table "public"."steam_games" add constraint "steam_games_release_text_check" CHECK (((release_text IS NULL) OR ((char_length(release_text) >= 1) AND (char_length(release_text) <= 120)))) not valid;

alter table "public"."steam_games" validate constraint "steam_games_release_text_check";

alter table "public"."steam_games" add constraint "steam_games_tag_source_check" CHECK ((tag_source = ANY (ARRAY['steam_store_tags'::text, 'appdetails_genres_fallback'::text, 'none'::text]))) not valid;

alter table "public"."steam_games" validate constraint "steam_games_tag_source_check";

alter table "public"."steam_games" add constraint "steam_games_tags_limit_check" CHECK ((cardinality(tags) <= 5)) not valid;

alter table "public"."steam_games" validate constraint "steam_games_tags_limit_check";

alter table "public"."steam_games" add constraint "steam_games_wishlist_rank_check" CHECK (((wishlist_rank IS NULL) OR ((wishlist_rank >= 1) AND (wishlist_rank <= 10000)))) not valid;

alter table "public"."steam_games" validate constraint "steam_games_wishlist_rank_check";

alter table "public"."steam_market_daily_snapshots" add constraint "steam_market_daily_snapshots_count_check" CHECK ((eligible_prediction_count >= 0)) not valid;

alter table "public"."steam_market_daily_snapshots" validate constraint "steam_market_daily_snapshots_count_check";

alter table "public"."steam_market_daily_snapshots" add constraint "steam_market_daily_snapshots_key" UNIQUE using index "steam_market_daily_snapshots_key";

alter table "public"."steam_market_daily_snapshots" add constraint "steam_market_daily_snapshots_market_id_fkey" FOREIGN KEY (market_id) REFERENCES public.steam_forecast_markets(id) ON DELETE CASCADE not valid;

alter table "public"."steam_market_daily_snapshots" validate constraint "steam_market_daily_snapshots_market_id_fkey";

alter table "public"."steam_market_daily_snapshots" add constraint "steam_market_daily_snapshots_midnight_check" CHECK ((snapshot_at = (date_trunc('day'::text, (snapshot_at AT TIME ZONE 'UTC'::text)) AT TIME ZONE 'UTC'::text))) not valid;

alter table "public"."steam_market_daily_snapshots" validate constraint "steam_market_daily_snapshots_midnight_check";

alter table "public"."steam_market_daily_snapshots" add constraint "steam_market_daily_snapshots_percentile_check" CHECK (((crowd_percentile IS NULL) OR ((crowd_percentile >= (0)::numeric) AND (crowd_percentile <= (100)::numeric)))) not valid;

alter table "public"."steam_market_daily_snapshots" validate constraint "steam_market_daily_snapshots_percentile_check";

alter table "public"."steam_market_results" add constraint "steam_market_results_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL not valid;

alter table "public"."steam_market_results" validate constraint "steam_market_results_created_by_fkey";

alter table "public"."steam_market_results" add constraint "steam_market_results_market_id_fkey" FOREIGN KEY (market_id) REFERENCES public.steam_forecast_markets(id) ON DELETE CASCADE not valid;

alter table "public"."steam_market_results" validate constraint "steam_market_results_market_id_fkey";

alter table "public"."steam_market_results" add constraint "steam_market_results_percentile_check" CHECK (((actual_percentile_value >= (0)::numeric) AND (actual_percentile_value <= (100)::numeric))) not valid;

alter table "public"."steam_market_results" validate constraint "steam_market_results_percentile_check";

alter table "public"."steam_market_results" add constraint "steam_market_results_raw_check" CHECK ((actual_raw_value >= (0)::numeric)) not valid;

alter table "public"."steam_market_results" validate constraint "steam_market_results_raw_check";

alter table "public"."steam_market_results" add constraint "steam_market_results_version_key" UNIQUE using index "steam_market_results_version_key";

alter table "public"."steam_market_snapshot_predictions" add constraint "steam_market_snapshot_predictions_percentile_check" CHECK (((percentile_value >= (0)::numeric) AND (percentile_value <= (100)::numeric))) not valid;

alter table "public"."steam_market_snapshot_predictions" validate constraint "steam_market_snapshot_predictions_percentile_check";

alter table "public"."steam_market_snapshot_predictions" add constraint "steam_market_snapshot_predictions_prediction_version_id_fkey" FOREIGN KEY (prediction_version_id) REFERENCES public.steam_prediction_versions(id) ON DELETE RESTRICT not valid;

alter table "public"."steam_market_snapshot_predictions" validate constraint "steam_market_snapshot_predictions_prediction_version_id_fkey";

alter table "public"."steam_market_snapshot_predictions" add constraint "steam_market_snapshot_predictions_snapshot_id_fkey" FOREIGN KEY (snapshot_id) REFERENCES public.steam_market_daily_snapshots(id) ON DELETE CASCADE not valid;

alter table "public"."steam_market_snapshot_predictions" validate constraint "steam_market_snapshot_predictions_snapshot_id_fkey";

alter table "public"."steam_market_snapshot_predictions" add constraint "steam_market_snapshot_predictions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."steam_market_snapshot_predictions" validate constraint "steam_market_snapshot_predictions_user_id_fkey";

alter table "public"."steam_percentile_models" add constraint "steam_percentile_models_metric_check" CHECK ((metric_type = ANY (ARRAY['first_weekend_ccu'::text, 'first_month_reviews'::text, 'full_price_us'::text]))) not valid;

alter table "public"."steam_percentile_models" validate constraint "steam_percentile_models_metric_check";

alter table "public"."steam_percentile_models" add constraint "steam_percentile_models_metric_version_key" UNIQUE using index "steam_percentile_models_metric_version_key";

alter table "public"."steam_percentile_models" add constraint "steam_percentile_models_values_check" CHECK (((sample_size = cardinality(reference_values)) AND (sample_size >= 10))) not valid;

alter table "public"."steam_percentile_models" validate constraint "steam_percentile_models_values_check";

alter table "public"."steam_percentile_models" add constraint "steam_percentile_models_version_check" CHECK ((model_version > 0)) not valid;

alter table "public"."steam_percentile_models" validate constraint "steam_percentile_models_version_check";

alter table "public"."steam_prediction_score_entries" add constraint "steam_prediction_score_entries_actual_percentile_check" CHECK (((actual_percentile >= (0)::numeric) AND (actual_percentile <= (100)::numeric))) not valid;

alter table "public"."steam_prediction_score_entries" validate constraint "steam_prediction_score_entries_actual_percentile_check";

alter table "public"."steam_prediction_score_entries" add constraint "steam_prediction_score_entries_crowd_percentile_check" CHECK (((crowd_without_user_percentile >= (0)::numeric) AND (crowd_without_user_percentile <= (100)::numeric))) not valid;

alter table "public"."steam_prediction_score_entries" validate constraint "steam_prediction_score_entries_crowd_percentile_check";

alter table "public"."steam_prediction_score_entries" add constraint "steam_prediction_score_entries_key" UNIQUE using index "steam_prediction_score_entries_key";

alter table "public"."steam_prediction_score_entries" add constraint "steam_prediction_score_entries_market_id_fkey" FOREIGN KEY (market_id) REFERENCES public.steam_forecast_markets(id) ON DELETE CASCADE not valid;

alter table "public"."steam_prediction_score_entries" validate constraint "steam_prediction_score_entries_market_id_fkey";

alter table "public"."steam_prediction_score_entries" add constraint "steam_prediction_score_entries_score_run_id_fkey" FOREIGN KEY (score_run_id) REFERENCES public.steam_score_runs(id) ON DELETE CASCADE not valid;

alter table "public"."steam_prediction_score_entries" validate constraint "steam_prediction_score_entries_score_run_id_fkey";

alter table "public"."steam_prediction_score_entries" add constraint "steam_prediction_score_entries_snapshot_id_fkey" FOREIGN KEY (snapshot_id) REFERENCES public.steam_market_daily_snapshots(id) ON DELETE CASCADE not valid;

alter table "public"."steam_prediction_score_entries" validate constraint "steam_prediction_score_entries_snapshot_id_fkey";

alter table "public"."steam_prediction_score_entries" add constraint "steam_prediction_score_entries_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."steam_prediction_score_entries" validate constraint "steam_prediction_score_entries_user_id_fkey";

alter table "public"."steam_prediction_score_entries" add constraint "steam_prediction_score_entries_user_percentile_check" CHECK (((user_percentile >= (0)::numeric) AND (user_percentile <= (100)::numeric))) not valid;

alter table "public"."steam_prediction_score_entries" validate constraint "steam_prediction_score_entries_user_percentile_check";

alter table "public"."steam_prediction_versions" add constraint "steam_prediction_versions_market_id_fkey" FOREIGN KEY (market_id) REFERENCES public.steam_forecast_markets(id) ON DELETE CASCADE not valid;

alter table "public"."steam_prediction_versions" validate constraint "steam_prediction_versions_market_id_fkey";

alter table "public"."steam_prediction_versions" add constraint "steam_prediction_versions_percentile_check" CHECK (((percentile_value >= (0)::numeric) AND (percentile_value <= (100)::numeric))) not valid;

alter table "public"."steam_prediction_versions" validate constraint "steam_prediction_versions_percentile_check";

alter table "public"."steam_prediction_versions" add constraint "steam_prediction_versions_raw_check" CHECK ((raw_value >= (0)::numeric)) not valid;

alter table "public"."steam_prediction_versions" validate constraint "steam_prediction_versions_raw_check";

alter table "public"."steam_prediction_versions" add constraint "steam_prediction_versions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."steam_prediction_versions" validate constraint "steam_prediction_versions_user_id_fkey";

alter table "public"."steam_prediction_versions" add constraint "steam_prediction_versions_validity_check" CHECK (((valid_to IS NULL) OR (valid_to >= valid_from))) not valid;

alter table "public"."steam_prediction_versions" validate constraint "steam_prediction_versions_validity_check";

alter table "public"."steam_score_runs" add constraint "steam_score_runs_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL not valid;

alter table "public"."steam_score_runs" validate constraint "steam_score_runs_created_by_fkey";

alter table "public"."steam_score_runs" add constraint "steam_score_runs_market_id_fkey" FOREIGN KEY (market_id) REFERENCES public.steam_forecast_markets(id) ON DELETE CASCADE not valid;

alter table "public"."steam_score_runs" validate constraint "steam_score_runs_market_id_fkey";

alter table "public"."steam_score_runs" add constraint "steam_score_runs_result_id_fkey" FOREIGN KEY (result_id) REFERENCES public.steam_market_results(id) ON DELETE RESTRICT not valid;

alter table "public"."steam_score_runs" validate constraint "steam_score_runs_result_id_fkey";

alter table "public"."steam_score_runs" add constraint "steam_score_runs_version_key" UNIQUE using index "steam_score_runs_version_key";

alter table "public"."steam_scoring_config" add constraint "steam_scoring_config_singleton_check" CHECK ((singleton = true)) not valid;

alter table "public"."steam_scoring_config" validate constraint "steam_scoring_config_singleton_check";

alter table "public"."steam_user_leaderboard_stats" add constraint "steam_user_leaderboard_stats_counts_check" CHECK (((scored_days >= 0) AND (resolved_markets >= 0) AND (rank_position > 0))) not valid;

alter table "public"."steam_user_leaderboard_stats" validate constraint "steam_user_leaderboard_stats_counts_check";

alter table "public"."steam_user_leaderboard_stats" add constraint "steam_user_leaderboard_stats_metric_check" CHECK ((metric_type = ANY (ARRAY['all'::text, 'first_weekend_ccu'::text, 'first_month_reviews'::text, 'full_price_us'::text]))) not valid;

alter table "public"."steam_user_leaderboard_stats" validate constraint "steam_user_leaderboard_stats_metric_check";

alter table "public"."steam_user_leaderboard_stats" add constraint "steam_user_leaderboard_stats_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."steam_user_leaderboard_stats" validate constraint "steam_user_leaderboard_stats_user_id_fkey";

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

CREATE OR REPLACE FUNCTION private.reject_staging_append_only_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  RAISE EXCEPTION 'staging audit and event rows are append-only'
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

CREATE OR REPLACE FUNCTION private.staging_canonical_points(p_user_percentile numeric, p_crowd_without_user_percentile numeric, p_actual_percentile numeric)
 RETURNS numeric
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  SELECT abs(p_actual_percentile - p_crowd_without_user_percentile)
       - abs(p_actual_percentile - p_user_percentile);
$function$
;

CREATE OR REPLACE FUNCTION private.steam_is_internal_actor()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT coalesce(auth.role() = 'service_role', false)
    OR coalesce(private.is_admin(auth.uid()), false);
$function$
;

CREATE OR REPLACE FUNCTION private.steam_metric_lock_at(p_release_date date)
 RETURNS timestamp with time zone
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  SELECT CASE WHEN p_release_date IS NULL THEN NULL
    ELSE p_release_date::timestamp AT TIME ZONE 'UTC'
  END;
$function$
;

CREATE OR REPLACE FUNCTION private.steam_metric_resolve_after(p_metric_type text, p_release_date date)
 RETURNS timestamp with time zone
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  SELECT CASE
    WHEN p_release_date IS NULL THEN NULL
    WHEN p_metric_type = 'full_price_us'
      THEN p_release_date::timestamp AT TIME ZONE 'UTC'
    WHEN p_metric_type = 'first_weekend_ccu'
      THEN (date_trunc('week', p_release_date::timestamp) + interval '7 days') AT TIME ZONE 'UTC'
    WHEN p_metric_type = 'first_month_reviews'
      THEN (p_release_date::timestamp + interval '30 days') AT TIME ZONE 'UTC'
    ELSE NULL
  END;
$function$
;

CREATE OR REPLACE FUNCTION private.sync_staging_user_role()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  pending_assignment public.staging_pending_role_assignments%ROWTYPE;
BEGIN
  INSERT INTO public.staging_user_roles(user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id) DO NOTHING;

  IF NEW.email_confirmed_at IS NULL OR NEW.email IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO pending_assignment
  FROM public.staging_pending_role_assignments
  WHERE email = lower(btrim(NEW.email)) AND status = 'pending'
  ORDER BY requested_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    UPDATE public.staging_user_roles
    SET role = pending_assignment.role,
        granted_by = pending_assignment.requested_by,
        granted_at = now()
    WHERE user_id = NEW.id;

    UPDATE public.staging_pending_role_assignments
    SET status = 'claimed', claimed_by = NEW.id, claimed_at = now()
    WHERE id = pending_assignment.id;

    INSERT INTO public.staging_role_audit_log(
      actor_user_id, action, target_user_id, target_email,
      previous_role, new_role, metadata
    ) VALUES (
      pending_assignment.requested_by, 'assignment_claimed', NEW.id,
      lower(btrim(NEW.email)), 'user', pending_assignment.role,
      jsonb_build_object('assignment_id', pending_assignment.id, 'source', 'verified_signup')
    );
  END IF;

  RETURN NEW;
END;
$function$
;

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

CREATE OR REPLACE FUNCTION public.create_steam_market_snapshots(p_snapshot_at timestamp with time zone DEFAULT date_trunc('day'::text, now()))
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  normalized_at timestamptz := date_trunc('day', p_snapshot_at AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  inserted_count integer;
BEGIN
  IF p_snapshot_at IS DISTINCT FROM normalized_at THEN
    RAISE EXCEPTION 'snapshot time must be 00:00 UTC' USING ERRCODE = '22023';
  END IF;
  IF normalized_at > now() THEN
    RAISE EXCEPTION 'future snapshots are not allowed' USING ERRCODE = '22023';
  END IF;

  PERFORM public.ensure_steam_points_system();

  INSERT INTO public.steam_market_daily_snapshots (
    market_id, snapshot_date, snapshot_at
  )
  SELECT market.id, normalized_at::date, normalized_at
  FROM public.steam_forecast_markets AS market
  WHERE market.status <> 'void'
    AND normalized_at >= date_trunc('day', market.scoring_start_at AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
    AND (market.lock_at IS NULL OR normalized_at < market.lock_at)
  ON CONFLICT (market_id, snapshot_date) DO NOTHING;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  INSERT INTO public.steam_market_snapshot_predictions (
    snapshot_id, prediction_version_id, user_id, raw_value, percentile_value
  )
  SELECT snapshot.id, version.id, version.user_id, version.raw_value, version.percentile_value
  FROM public.steam_market_daily_snapshots AS snapshot
  JOIN public.steam_prediction_versions AS version
    ON version.market_id = snapshot.market_id
    AND version.valid_from <= snapshot.snapshot_at
    AND (version.valid_to IS NULL OR version.valid_to > snapshot.snapshot_at)
  WHERE snapshot.snapshot_at = normalized_at
  ON CONFLICT (snapshot_id, user_id) DO NOTHING;

  UPDATE public.steam_market_daily_snapshots AS snapshot
  SET
    eligible_prediction_count = aggregate.prediction_count,
    crowd_percentile = aggregate.crowd_percentile
  FROM (
    SELECT membership.snapshot_id,
      count(*)::integer AS prediction_count,
      avg(membership.percentile_value) AS crowd_percentile
    FROM public.steam_market_snapshot_predictions AS membership
    GROUP BY membership.snapshot_id
  ) AS aggregate
  WHERE snapshot.id = aggregate.snapshot_id AND snapshot.snapshot_at = normalized_at;

  RETURN inserted_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.ensure_steam_points_system()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  scoring_start timestamptz;
BEGIN
  INSERT INTO public.steam_scoring_config (singleton, scoring_start_at)
  VALUES (true, now())
  ON CONFLICT (singleton) DO NOTHING;

  INSERT INTO public.steam_percentile_models (
    metric_type, model_version, dataset_reference, sample_size, reference_values, is_active
  ) VALUES
    (
      'first_weekend_ccu', 1, 'mvp_fixture_v1: replace only with a versioned audited dataset', 25,
      ARRAY[0,25,50,100,200,350,500,750,1000,1500,2500,4000,6500,10000,16000,25000,40000,65000,100000,175000,300000,600000,1000000,3000000,10000000]::numeric[], true
    ),
    (
      'first_month_reviews', 1, 'mvp_fixture_v1: replace only with a versioned audited dataset', 25,
      ARRAY[0,2,5,10,20,35,50,80,120,180,275,400,650,1000,1600,2500,4000,6500,10000,18000,30000,60000,120000,300000,1000000]::numeric[], true
    ),
    (
      'full_price_us', 1, 'mvp_fixture_v1: replace only with a versioned audited dataset', 25,
      ARRAY[0,0.99,1.99,2.99,3.99,4.99,5.99,7.99,9.99,11.99,12.99,14.99,17.99,19.99,24.99,29.99,34.99,39.99,44.99,49.99,59.99,69.99,79.99,89.99,99.99]::numeric[], true
    )
  ON CONFLICT (metric_type, model_version) DO NOTHING;

  SELECT config.scoring_start_at INTO scoring_start
  FROM public.steam_scoring_config AS config
  WHERE config.singleton = true;

  INSERT INTO public.steam_forecast_markets (
    steam_app_id,
    metric_type,
    lock_at,
    resolve_after,
    source_release_date,
    percentile_model_id,
    percentile_model_version,
    scoring_start_at
  )
  SELECT
    game.steam_app_id,
    metric.metric_type,
    private.steam_metric_lock_at(game.release_date),
    private.steam_metric_resolve_after(metric.metric_type, game.release_date),
    game.release_date,
    model.id,
    model.model_version,
    scoring_start
  FROM public.steam_games AS game
  CROSS JOIN (
    VALUES ('first_weekend_ccu'), ('first_month_reviews'), ('full_price_us')
  ) AS metric(metric_type)
  JOIN public.steam_percentile_models AS model
    ON model.metric_type = metric.metric_type AND model.is_active = true
  WHERE game.lifecycle_status = 'upcoming' AND game.is_wishlisted = true
  ON CONFLICT (steam_app_id, metric_type) DO NOTHING;

  UPDATE public.steam_forecast_markets AS market
  SET
    lock_at = private.steam_metric_lock_at(game.release_date),
    resolve_after = private.steam_metric_resolve_after(market.metric_type, game.release_date),
    source_release_date = game.release_date
  FROM public.steam_games AS game
  WHERE game.steam_app_id = market.steam_app_id
    AND market.status = 'open'
    AND (
      market.source_release_date IS DISTINCT FROM game.release_date
      OR market.lock_at IS DISTINCT FROM private.steam_metric_lock_at(game.release_date)
    );

  UPDATE public.steam_forecast_markets AS market
  SET status = 'void', void_reason = 'Game left the TopWishlisted catalog', voided_at = now()
  FROM public.steam_games AS game
  WHERE game.steam_app_id = market.steam_app_id
    AND market.status = 'open'
    AND game.is_wishlisted = false;

  UPDATE public.steam_bets AS bet
  SET
    percentile_value = public.steam_percentile_value(
      market.metric_type,
      market.percentile_model_version,
      bet.value
    ),
    percentile_model_version = market.percentile_model_version
  FROM public.steam_forecast_markets AS market
  WHERE market.steam_app_id = bet.steam_app_id
    AND market.metric_type = bet.target_key
    AND (bet.percentile_value IS NULL OR bet.percentile_model_version IS NULL);

  INSERT INTO public.steam_prediction_versions (
    market_id, user_id, raw_value, percentile_value, percentile_model_version, valid_from
  )
  SELECT
    market.id,
    bet.user_id,
    bet.value,
    bet.percentile_value,
    bet.percentile_model_version,
    market.scoring_start_at
  FROM public.steam_bets AS bet
  JOIN public.steam_forecast_markets AS market
    ON market.steam_app_id = bet.steam_app_id AND market.metric_type = bet.target_key
  WHERE bet.percentile_value IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.steam_prediction_versions AS version
      WHERE version.market_id = market.id AND version.user_id = bet.user_id
    );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_forecast_leaderboard(p_period text DEFAULT 'week'::text)
 RETURNS TABLE(rank bigint, profile_id uuid, username text, display_name text, avatar_id public.avatar_id, accuracy numeric, prediction_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  WITH scored AS (
    SELECT
      prediction.user_id,
      greatest(
        0::numeric,
        100 - abs(prediction.value - target.resolved_value)
          / greatest(abs(target.resolved_value), 1) * 100
      ) AS score
    FROM public.numeric_predictions AS prediction
    JOIN public.forecast_targets AS target ON target.id = prediction.target_id
    WHERE target.status = 'resolved'
      AND target.resolved_at >= CASE p_period
        WHEN 'day' THEN now() - interval '1 day'
        WHEN 'month' THEN now() - interval '1 month'
        ELSE now() - interval '1 week'
      END
  ), totals AS (
    SELECT
      scored.user_id,
      avg(scored.score) AS accuracy,
      count(*) AS prediction_count
    FROM scored
    GROUP BY scored.user_id
  ), ranked AS (
    SELECT
      row_number() OVER (
        ORDER BY totals.accuracy DESC, totals.prediction_count DESC, profile.created_at ASC
      ) AS rank,
      profile.id AS profile_id,
      profile.username,
      profile.display_name,
      profile.avatar_id,
      totals.accuracy,
      totals.prediction_count
    FROM totals
    JOIN public.profiles AS profile ON profile.id = totals.user_id
  )
  SELECT * FROM ranked ORDER BY rank LIMIT 50;
$function$
;

CREATE OR REPLACE FUNCTION public.get_forecast_summaries(p_market_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(target_id uuid, raw_average numeric, weighted_average numeric, prediction_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  WITH reputation AS (
    SELECT
      prediction.user_id,
      avg(
        greatest(
          0::numeric,
          1 - abs(prediction.value - target.resolved_value)
            / greatest(abs(target.resolved_value), 1)
        )
      ) AS accuracy
    FROM public.numeric_predictions AS prediction
    JOIN public.forecast_targets AS target ON target.id = prediction.target_id
    WHERE target.status = 'resolved'
    GROUP BY prediction.user_id
  )
  SELECT
    target.id,
    avg(prediction.value),
    sum(prediction.value * (1 + coalesce(reputation.accuracy, 0) * 2))
      / nullif(sum(1 + coalesce(reputation.accuracy, 0) * 2), 0),
    count(prediction.id)
  FROM public.forecast_targets AS target
  LEFT JOIN public.numeric_predictions AS prediction ON prediction.target_id = target.id
  LEFT JOIN reputation ON reputation.user_id = prediction.user_id
  WHERE target.status = 'open'
    AND (p_market_ids IS NULL OR target.market_id = ANY(p_market_ids))
  GROUP BY target.id;
$function$
;

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

CREATE OR REPLACE FUNCTION public.get_steam_game_data_quality_report()
 RETURNS TABLE(total_games bigint, exact_release_count bigint, partial_release_count bigint, tba_release_count bigint, five_tags_count bigint, one_to_four_tags_count bigint, fallback_tags_count bigint, missing_tags_count bigint, two_screenshots_count bigint, one_screenshot_count bigint, media_unavailable_count bigint, media_pending_count bigint, media_failed_count bigint, stale_release_count bigint, stale_tag_count bigint, stale_media_count bigint, oldest_pending_at timestamp with time zone, most_recent_successful_run_at timestamp with time zone)
 LANGUAGE sql
 STABLE
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

CREATE OR REPLACE FUNCTION public.get_steam_points_leaderboard(p_metric_type text DEFAULT 'all'::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0)
 RETURNS TABLE(rank_position bigint, user_id uuid, username text, display_name text, avatar_id public.avatar_id, points numeric, scored_days integer, resolved_markets integer, is_current_user boolean, is_page_member boolean, total_rows bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF p_metric_type NOT IN ('all', 'first_weekend_ccu', 'first_month_reviews', 'full_price_us') THEN
    RAISE EXCEPTION 'unsupported leaderboard metric' USING ERRCODE = '22023';
  END IF;
  IF p_limit < 1 OR p_limit > 100 OR p_offset < 0 THEN
    RAISE EXCEPTION 'invalid pagination' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH total AS (
    SELECT count(*)::bigint AS value
    FROM public.steam_user_leaderboard_stats AS stats
    WHERE stats.metric_type = p_metric_type
  ), page AS (
    SELECT stats.* FROM public.steam_user_leaderboard_stats AS stats
    WHERE stats.metric_type = p_metric_type
    ORDER BY stats.rank_position
    LIMIT p_limit OFFSET p_offset
  ), viewer AS (
    SELECT stats.* FROM public.steam_user_leaderboard_stats AS stats
    WHERE stats.metric_type = p_metric_type AND stats.user_id = auth.uid()
  ), combined AS (
    SELECT page.*, true AS is_page_member FROM page
    UNION ALL
    SELECT viewer.*, false FROM viewer
    WHERE NOT EXISTS (SELECT 1 FROM page WHERE page.user_id = viewer.user_id)
  ), with_empty_viewer AS (
    SELECT * FROM combined
    UNION ALL
    SELECT auth.uid(), p_metric_type, 0::numeric, 0, 0,
      (SELECT value + 1 FROM total), now(), false
    WHERE auth.uid() IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM combined WHERE combined.user_id = auth.uid())
  )
  SELECT
    row.rank_position,
    row.user_id,
    profile.username,
    profile.display_name,
    profile.avatar_id,
    row.points,
    row.scored_days,
    row.resolved_markets,
    row.user_id = auth.uid(),
    row.is_page_member,
    total.value
  FROM with_empty_viewer AS row
  JOIN public.profiles AS profile ON profile.id = row.user_id
  CROSS JOIN total
  ORDER BY row.is_page_member DESC, row.rank_position;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_steam_prediction_states(p_steam_app_ids bigint[] DEFAULT NULL::bigint[])
 RETURNS TABLE(steam_app_id bigint, metric_type text, market_status text, lock_at timestamp with time zone, resolve_after timestamp with time zone, user_raw_value numeric, user_percentile_value numeric, actual_raw_value numeric, actual_percentile_value numeric, points numeric, scored_days bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT
    market.steam_app_id,
    market.metric_type,
    market.status,
    market.lock_at,
    market.resolve_after,
    version.raw_value,
    version.percentile_value,
    result.actual_raw_value,
    result.actual_percentile_value,
    coalesce(score.points, 0),
    coalesce(score.scored_days, 0)
  FROM public.steam_forecast_markets AS market
  LEFT JOIN public.steam_prediction_versions AS version
    ON version.market_id = market.id AND version.user_id = auth.uid() AND version.valid_to IS NULL
  LEFT JOIN public.steam_market_results AS result
    ON result.market_id = market.id AND result.is_current = true
  LEFT JOIN LATERAL (
    SELECT sum(entry.points) AS points, count(DISTINCT snapshot.snapshot_date) AS scored_days
    FROM public.steam_prediction_score_entries AS entry
    JOIN public.steam_score_runs AS run ON run.id = entry.score_run_id AND run.is_current = true
    JOIN public.steam_market_daily_snapshots AS snapshot ON snapshot.id = entry.snapshot_id
    WHERE entry.market_id = market.id AND entry.user_id = auth.uid()
  ) AS score ON true
  WHERE p_steam_app_ids IS NULL OR market.steam_app_id = ANY(p_steam_app_ids)
  ORDER BY market.steam_app_id, market.metric_type;
$function$
;

CREATE OR REPLACE FUNCTION public.get_steam_resolution_queue()
 RETURNS TABLE(market_id uuid, steam_app_id bigint, game_name text, metric_type text, resolve_after timestamp with time zone, status text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NOT private.steam_is_internal_actor() THEN
    RAISE EXCEPTION 'administrator access required' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT market.id, market.steam_app_id, game.name, market.metric_type,
    market.resolve_after, market.status
  FROM public.steam_forecast_markets AS market
  JOIN public.steam_games AS game ON game.steam_app_id = market.steam_app_id
  WHERE market.status = 'locked' AND market.resolve_after <= now()
  ORDER BY market.resolve_after, market.steam_app_id, market.metric_type;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_current_user_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT COALESCE(private.is_admin(auth.uid()), false);
$function$
;

create or replace view "public"."leaderboard" as  SELECT id,
    username,
    display_name,
    avatar_id,
    coin_balance,
    predictions_made,
    predictions_resolved,
    correct_predictions,
    coins_wagered,
    coins_won,
        CASE
            WHEN (predictions_resolved = 0) THEN 0
            ELSE ((((correct_predictions)::bigint * 10000) / predictions_resolved))::integer
        END AS accuracy_bps,
    dense_rank() OVER (ORDER BY coin_balance DESC, correct_predictions DESC, created_at) AS coin_rank,
    dense_rank() OVER (ORDER BY
        CASE
            WHEN (predictions_resolved = 0) THEN (0)::numeric
            ELSE ((correct_predictions)::numeric / (predictions_resolved)::numeric)
        END DESC, correct_predictions DESC, predictions_resolved DESC, coin_balance DESC) AS accuracy_rank
   FROM public.profiles profile;


CREATE OR REPLACE FUNCTION public.lock_due_steam_forecast_markets()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  locked_count integer;
BEGIN
  UPDATE public.steam_forecast_markets
  SET status = 'locked'
  WHERE status = 'open' AND lock_at IS NOT NULL AND lock_at <= now();
  GET DIAGNOSTICS locked_count = ROW_COUNT;
  RETURN locked_count;
END;
$function$
;

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

CREATE OR REPLACE FUNCTION public.process_steam_market_cycle()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  market_count integer;
  locked_count integer;
BEGIN
  market_count := public.sync_steam_forecast_markets();
  locked_count := public.lock_due_steam_forecast_markets();
  RETURN jsonb_build_object('markets', market_count, 'locked', locked_count, 'processed_at', now());
END;
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

CREATE OR REPLACE FUNCTION public.rebuild_steam_leaderboard_stats()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  rebuilt_count integer;
BEGIN
  DELETE FROM public.steam_user_leaderboard_stats;

  WITH current_entries AS (
    SELECT entry.*, market.metric_type, snapshot.snapshot_date
    FROM public.steam_prediction_score_entries AS entry
    JOIN public.steam_score_runs AS run
      ON run.id = entry.score_run_id AND run.is_current = true
    JOIN public.steam_forecast_markets AS market ON market.id = entry.market_id
    JOIN public.steam_market_daily_snapshots AS snapshot ON snapshot.id = entry.snapshot_id
    WHERE market.status = 'resolved'
  ), grouped AS (
    SELECT user_id, metric_type, sum(points) AS points,
      count(DISTINCT snapshot_date)::integer AS scored_days,
      count(DISTINCT market_id)::integer AS resolved_markets
    FROM current_entries GROUP BY user_id, metric_type
    UNION ALL
    SELECT user_id, 'all', sum(points), count(DISTINCT snapshot_date)::integer,
      count(DISTINCT market_id)::integer
    FROM current_entries GROUP BY user_id
  ), ranked AS (
    SELECT grouped.*,
      row_number() OVER (
        PARTITION BY grouped.metric_type
        ORDER BY grouped.points DESC, grouped.scored_days DESC,
          grouped.resolved_markets DESC, profile.created_at ASC, grouped.user_id ASC
      ) AS rank_position
    FROM grouped
    JOIN public.profiles AS profile ON profile.id = grouped.user_id
  )
  INSERT INTO public.steam_user_leaderboard_stats (
    user_id, metric_type, points, scored_days, resolved_markets, rank_position
  )
  SELECT user_id, metric_type, points, scored_days, resolved_markets, rank_position
  FROM ranked;

  GET DIAGNOSTICS rebuilt_count = ROW_COUNT;
  RETURN rebuilt_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.recalculate_steam_forecast_market(p_market_id uuid, p_reason text DEFAULT 'manual recalculation'::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  market public.steam_forecast_markets%ROWTYPE;
  result public.steam_market_results%ROWTYPE;
  saved_run public.steam_score_runs%ROWTYPE;
  next_run_version integer;
  entry_count integer;
BEGIN
  IF NOT private.steam_is_internal_actor() THEN
    RAISE EXCEPTION 'administrator access required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO market FROM public.steam_forecast_markets WHERE id = p_market_id FOR UPDATE;
  SELECT * INTO result FROM public.steam_market_results
  WHERE market_id = p_market_id AND is_current = true;
  IF market.id IS NULL OR result.id IS NULL OR market.status <> 'resolved' THEN
    RAISE EXCEPTION 'resolved market result not found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.steam_score_runs SET is_current = false
  WHERE market_id = market.id AND is_current = true;
  SELECT coalesce(max(run_version), 0) + 1 INTO next_run_version
  FROM public.steam_score_runs WHERE market_id = market.id;
  INSERT INTO public.steam_score_runs (
    market_id, result_id, run_version, reason, created_by
  ) VALUES (market.id, result.id, next_run_version, p_reason, auth.uid())
  RETURNING * INTO saved_run;

  INSERT INTO public.steam_prediction_score_entries (
    score_run_id, market_id, snapshot_id, user_id, user_percentile,
    crowd_without_user_percentile, actual_percentile, points
  )
  SELECT saved_run.id, market.id, snapshot.id, membership.user_id,
    membership.percentile_value,
    (snapshot.crowd_percentile * snapshot.eligible_prediction_count - membership.percentile_value)
      / (snapshot.eligible_prediction_count - 1),
    result.actual_percentile_value,
    abs(result.actual_percentile_value - (
      (snapshot.crowd_percentile * snapshot.eligible_prediction_count - membership.percentile_value)
        / (snapshot.eligible_prediction_count - 1)
    )) - abs(result.actual_percentile_value - membership.percentile_value)
  FROM public.steam_market_daily_snapshots AS snapshot
  JOIN public.steam_market_snapshot_predictions AS membership ON membership.snapshot_id = snapshot.id
  WHERE snapshot.market_id = market.id AND snapshot.eligible_prediction_count >= 2;
  GET DIAGNOSTICS entry_count = ROW_COUNT;
  PERFORM public.rebuild_steam_leaderboard_stats();
  RETURN entry_count;
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

CREATE OR REPLACE FUNCTION public.resolve_steam_forecast_market(p_market_id uuid, p_actual_raw_value numeric, p_source_reference text, p_resolved_at timestamp with time zone DEFAULT now(), p_correction_note text DEFAULT NULL::text)
 RETURNS public.steam_market_results
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  market public.steam_forecast_markets%ROWTYPE;
  current_result public.steam_market_results%ROWTYPE;
  saved_result public.steam_market_results%ROWTYPE;
  saved_run public.steam_score_runs%ROWTYPE;
  actual_percentile numeric;
  next_result_version integer;
  next_run_version integer;
BEGIN
  IF NOT private.steam_is_internal_actor() THEN
    RAISE EXCEPTION 'administrator access required' USING ERRCODE = '42501';
  END IF;
  IF p_actual_raw_value IS NULL OR p_actual_raw_value < 0 OR nullif(trim(p_source_reference), '') IS NULL THEN
    RAISE EXCEPTION 'actual value and source are required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO market FROM public.steam_forecast_markets WHERE id = p_market_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'forecast market not found' USING ERRCODE = 'P0002'; END IF;
  IF market.status = 'void' OR market.status = 'open' THEN
    RAISE EXCEPTION 'only locked or resolved markets can be resolved' USING ERRCODE = '22023';
  END IF;

  actual_percentile := public.steam_percentile_value(
    market.metric_type, market.percentile_model_version, p_actual_raw_value
  );
  SELECT * INTO current_result FROM public.steam_market_results
  WHERE market_id = market.id AND is_current = true FOR UPDATE;

  IF FOUND
    AND current_result.actual_raw_value = p_actual_raw_value
    AND current_result.source_reference = p_source_reference
  THEN
    RETURN current_result;
  END IF;

  UPDATE public.steam_market_results SET is_current = false
  WHERE market_id = market.id AND is_current = true;
  SELECT coalesce(max(result_version), 0) + 1 INTO next_result_version
  FROM public.steam_market_results WHERE market_id = market.id;
  INSERT INTO public.steam_market_results (
    market_id, result_version, actual_raw_value, actual_percentile_value,
    source_reference, resolved_at, correction_note, created_by
  ) VALUES (
    market.id, next_result_version, p_actual_raw_value, actual_percentile,
    p_source_reference, p_resolved_at, p_correction_note, auth.uid()
  ) RETURNING * INTO saved_result;

  UPDATE public.steam_score_runs SET is_current = false
  WHERE market_id = market.id AND is_current = true;
  SELECT coalesce(max(run_version), 0) + 1 INTO next_run_version
  FROM public.steam_score_runs WHERE market_id = market.id;
  INSERT INTO public.steam_score_runs (
    market_id, result_id, run_version, reason, created_by
  ) VALUES (
    market.id, saved_result.id, next_run_version,
    CASE WHEN next_run_version = 1 THEN 'initial resolution' ELSE 'result correction' END,
    auth.uid()
  ) RETURNING * INTO saved_run;

  INSERT INTO public.steam_prediction_score_entries (
    score_run_id, market_id, snapshot_id, user_id, user_percentile,
    crowd_without_user_percentile, actual_percentile, points
  )
  SELECT
    saved_run.id,
    market.id,
    snapshot.id,
    membership.user_id,
    membership.percentile_value,
    (snapshot.crowd_percentile * snapshot.eligible_prediction_count - membership.percentile_value)
      / (snapshot.eligible_prediction_count - 1),
    actual_percentile,
    abs(actual_percentile - (
      (snapshot.crowd_percentile * snapshot.eligible_prediction_count - membership.percentile_value)
        / (snapshot.eligible_prediction_count - 1)
    )) - abs(actual_percentile - membership.percentile_value)
  FROM public.steam_market_daily_snapshots AS snapshot
  JOIN public.steam_market_snapshot_predictions AS membership
    ON membership.snapshot_id = snapshot.id
  WHERE snapshot.market_id = market.id AND snapshot.eligible_prediction_count >= 2;

  UPDATE public.steam_forecast_markets SET status = 'resolved' WHERE id = market.id;
  PERFORM public.rebuild_steam_leaderboard_stats();
  RETURN saved_result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.steam_percentile_value(p_metric_type text, p_model_version integer, p_raw_value numeric)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  reference numeric[];
  below_count integer;
  equal_count integer;
BEGIN
  IF p_raw_value IS NULL OR p_raw_value < 0 THEN
    RAISE EXCEPTION 'forecast value must be zero or greater' USING ERRCODE = '22003';
  END IF;

  SELECT model.reference_values INTO reference
  FROM public.steam_percentile_models AS model
  WHERE model.metric_type = p_metric_type AND model.model_version = p_model_version;

  IF reference IS NULL THEN
    RAISE EXCEPTION 'percentile model not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT
    count(*) FILTER (WHERE item < p_raw_value),
    count(*) FILTER (WHERE item = p_raw_value)
  INTO below_count, equal_count
  FROM unnest(reference) AS item;

  RETURN round((below_count + equal_count * 0.5) * 100.0 / cardinality(reference), 4);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.submit_steam_prediction(p_steam_app_id bigint, p_metric_type text, p_raw_value numeric)
 RETURNS TABLE(steam_app_id bigint, metric_type text, raw_value numeric, percentile_value numeric, market_status text, lock_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  current_user_id uuid := auth.uid();
  market public.steam_forecast_markets%ROWTYPE;
  game public.steam_games%ROWTYPE;
  calculated_percentile numeric;
  saved_at timestamptz := clock_timestamp();
  current_version public.steam_prediction_versions%ROWTYPE;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;
  IF p_metric_type NOT IN ('first_weekend_ccu', 'first_month_reviews', 'full_price_us') THEN
    RAISE EXCEPTION 'unsupported forecast metric' USING ERRCODE = '22023';
  END IF;
  IF p_raw_value IS NULL OR p_raw_value < 0
    OR (p_metric_type = 'first_weekend_ccu' AND p_raw_value > 9999999)
    OR (p_metric_type = 'first_month_reviews' AND p_raw_value > 999999)
    OR (p_metric_type = 'full_price_us' AND p_raw_value > 10000)
  THEN
    RAISE EXCEPTION 'forecast value is outside the allowed range' USING ERRCODE = '22003';
  END IF;

  SELECT * INTO game FROM public.steam_games
  WHERE steam_games.steam_app_id = p_steam_app_id
    AND lifecycle_status = 'upcoming' AND is_wishlisted = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'game is not open for predictions' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO market FROM public.steam_forecast_markets
  WHERE steam_forecast_markets.steam_app_id = p_steam_app_id
    AND steam_forecast_markets.metric_type = p_metric_type
  FOR UPDATE;
  IF NOT FOUND THEN
    PERFORM public.ensure_steam_points_system();
    SELECT * INTO market FROM public.steam_forecast_markets
    WHERE steam_forecast_markets.steam_app_id = p_steam_app_id
      AND steam_forecast_markets.metric_type = p_metric_type
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'forecast market not found' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  IF market.status = 'open' AND market.lock_at IS NOT NULL AND market.lock_at <= now() THEN
    UPDATE public.steam_forecast_markets SET status = 'locked' WHERE id = market.id;
    market.status := 'locked';
  END IF;
  IF market.status <> 'open' THEN
    RAISE EXCEPTION 'forecast market is %', market.status USING ERRCODE = '22023';
  END IF;

  calculated_percentile := public.steam_percentile_value(
    market.metric_type, market.percentile_model_version, p_raw_value
  );

  SELECT * INTO current_version
  FROM public.steam_prediction_versions
  WHERE market_id = market.id AND user_id = current_user_id AND valid_to IS NULL
  FOR UPDATE;

  IF FOUND AND current_version.raw_value IS DISTINCT FROM p_raw_value THEN
    UPDATE public.steam_prediction_versions SET valid_to = saved_at WHERE id = current_version.id;
  END IF;

  IF NOT FOUND OR current_version.raw_value IS DISTINCT FROM p_raw_value THEN
    INSERT INTO public.steam_prediction_versions (
      market_id, user_id, raw_value, percentile_value, percentile_model_version, valid_from
    ) VALUES (
      market.id, current_user_id, p_raw_value, calculated_percentile,
      market.percentile_model_version, saved_at
    );
  END IF;

  INSERT INTO public.steam_bets (
    user_id, steam_app_id, target_key, value, game_name, release_date,
    release_label, image_url, percentile_value, percentile_model_version
  ) VALUES (
    current_user_id, game.steam_app_id, p_metric_type, p_raw_value, game.name,
    coalesce(game.release_date::text, ''), game.release_label, game.image_url,
    calculated_percentile, market.percentile_model_version
  )
  ON CONFLICT ON CONSTRAINT steam_bets_user_game_target_key DO UPDATE SET
    value = EXCLUDED.value,
    game_name = EXCLUDED.game_name,
    release_date = EXCLUDED.release_date,
    release_label = EXCLUDED.release_label,
    image_url = EXCLUDED.image_url,
    percentile_value = EXCLUDED.percentile_value,
    percentile_model_version = EXCLUDED.percentile_model_version;

  RETURN QUERY SELECT
    game.steam_app_id,
    market.metric_type,
    p_raw_value,
    calculated_percentile,
    market.status,
    market.lock_at,
    saved_at;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_steam_forecast_markets()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  market_count integer;
BEGIN
  PERFORM public.ensure_steam_points_system();
  SELECT count(*) INTO market_count FROM public.steam_forecast_markets;
  RETURN market_count;
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

CREATE OR REPLACE FUNCTION public.upsert_numeric_prediction(p_target_id uuid, p_value numeric)
 RETURNS public.numeric_predictions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  current_user_id uuid := auth.uid();
  target public.forecast_targets%ROWTYPE;
  saved_prediction public.numeric_predictions%ROWTYPE;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT *
  INTO target
  FROM public.forecast_targets
  WHERE id = p_target_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'forecast target not found' USING ERRCODE = 'P0002';
  END IF;

  IF target.status <> 'open' OR target.closes_at <= now() THEN
    RAISE EXCEPTION 'forecast target is closed' USING ERRCODE = '22023';
  END IF;

  IF p_value < target.min_value
     OR (target.max_value IS NOT NULL AND p_value > target.max_value) THEN
    RAISE EXCEPTION 'forecast value is outside the allowed range' USING ERRCODE = '22003';
  END IF;

  INSERT INTO public.numeric_predictions (target_id, user_id, value)
  VALUES (p_target_id, current_user_id, p_value)
  ON CONFLICT (user_id, target_id)
  DO UPDATE SET value = EXCLUDED.value
  RETURNING * INTO saved_prediction;

  RETURN saved_prediction;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.void_steam_forecast_market(p_market_id uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NOT private.steam_is_internal_actor() THEN
    RAISE EXCEPTION 'administrator access required' USING ERRCODE = '42501';
  END IF;
  IF nullif(trim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'void reason is required' USING ERRCODE = '22023';
  END IF;
  UPDATE public.steam_forecast_markets
  SET status = 'void', void_reason = p_reason, voided_at = now()
  WHERE id = p_market_id AND status <> 'void';
  UPDATE public.steam_score_runs SET is_current = false
  WHERE market_id = p_market_id AND is_current = true;
  PERFORM public.rebuild_steam_leaderboard_stats();
END;
$function$
;

grant select on table "public"."coin_ledger" to "authenticated";

grant insert on table "public"."coin_ledger" to "service_role";

grant select on table "public"."coin_ledger" to "service_role";

grant select on table "public"."forecast_targets" to "anon";

grant select on table "public"."forecast_targets" to "authenticated";

grant delete on table "public"."forecast_targets" to "service_role";

grant insert on table "public"."forecast_targets" to "service_role";

grant references on table "public"."forecast_targets" to "service_role";

grant select on table "public"."forecast_targets" to "service_role";

grant trigger on table "public"."forecast_targets" to "service_role";

grant truncate on table "public"."forecast_targets" to "service_role";

grant update on table "public"."forecast_targets" to "service_role";

grant select on table "public"."markets" to "anon";

grant select on table "public"."markets" to "authenticated";

grant delete on table "public"."markets" to "service_role";

grant insert on table "public"."markets" to "service_role";

grant references on table "public"."markets" to "service_role";

grant select on table "public"."markets" to "service_role";

grant trigger on table "public"."markets" to "service_role";

grant truncate on table "public"."markets" to "service_role";

grant update on table "public"."markets" to "service_role";

grant select on table "public"."numeric_predictions" to "authenticated";

grant delete on table "public"."numeric_predictions" to "service_role";

grant insert on table "public"."numeric_predictions" to "service_role";

grant references on table "public"."numeric_predictions" to "service_role";

grant select on table "public"."numeric_predictions" to "service_role";

grant trigger on table "public"."numeric_predictions" to "service_role";

grant truncate on table "public"."numeric_predictions" to "service_role";

grant update on table "public"."numeric_predictions" to "service_role";

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

grant delete on table "public"."simulation_checkpoints" to "service_role";

grant insert on table "public"."simulation_checkpoints" to "service_role";

grant references on table "public"."simulation_checkpoints" to "service_role";

grant select on table "public"."simulation_checkpoints" to "service_role";

grant trigger on table "public"."simulation_checkpoints" to "service_role";

grant truncate on table "public"."simulation_checkpoints" to "service_role";

grant update on table "public"."simulation_checkpoints" to "service_role";

grant insert on table "public"."simulation_events" to "service_role";

grant select on table "public"."simulation_events" to "service_role";

grant delete on table "public"."simulation_forecast_versions" to "service_role";

grant insert on table "public"."simulation_forecast_versions" to "service_role";

grant references on table "public"."simulation_forecast_versions" to "service_role";

grant select on table "public"."simulation_forecast_versions" to "service_role";

grant trigger on table "public"."simulation_forecast_versions" to "service_role";

grant truncate on table "public"."simulation_forecast_versions" to "service_role";

grant update on table "public"."simulation_forecast_versions" to "service_role";

grant delete on table "public"."simulation_games" to "service_role";

grant insert on table "public"."simulation_games" to "service_role";

grant references on table "public"."simulation_games" to "service_role";

grant select on table "public"."simulation_games" to "service_role";

grant trigger on table "public"."simulation_games" to "service_role";

grant truncate on table "public"."simulation_games" to "service_role";

grant update on table "public"."simulation_games" to "service_role";

grant delete on table "public"."simulation_markets" to "service_role";

grant insert on table "public"."simulation_markets" to "service_role";

grant references on table "public"."simulation_markets" to "service_role";

grant select on table "public"."simulation_markets" to "service_role";

grant trigger on table "public"."simulation_markets" to "service_role";

grant truncate on table "public"."simulation_markets" to "service_role";

grant update on table "public"."simulation_markets" to "service_role";

grant delete on table "public"."simulation_players" to "service_role";

grant insert on table "public"."simulation_players" to "service_role";

grant references on table "public"."simulation_players" to "service_role";

grant select on table "public"."simulation_players" to "service_role";

grant trigger on table "public"."simulation_players" to "service_role";

grant truncate on table "public"."simulation_players" to "service_role";

grant update on table "public"."simulation_players" to "service_role";

grant delete on table "public"."simulation_results" to "service_role";

grant insert on table "public"."simulation_results" to "service_role";

grant references on table "public"."simulation_results" to "service_role";

grant select on table "public"."simulation_results" to "service_role";

grant trigger on table "public"."simulation_results" to "service_role";

grant truncate on table "public"."simulation_results" to "service_role";

grant update on table "public"."simulation_results" to "service_role";

grant delete on table "public"."simulation_scheduled_forecasts" to "service_role";

grant insert on table "public"."simulation_scheduled_forecasts" to "service_role";

grant references on table "public"."simulation_scheduled_forecasts" to "service_role";

grant select on table "public"."simulation_scheduled_forecasts" to "service_role";

grant trigger on table "public"."simulation_scheduled_forecasts" to "service_role";

grant truncate on table "public"."simulation_scheduled_forecasts" to "service_role";

grant update on table "public"."simulation_scheduled_forecasts" to "service_role";

grant delete on table "public"."simulation_score_entries" to "service_role";

grant insert on table "public"."simulation_score_entries" to "service_role";

grant references on table "public"."simulation_score_entries" to "service_role";

grant select on table "public"."simulation_score_entries" to "service_role";

grant trigger on table "public"."simulation_score_entries" to "service_role";

grant truncate on table "public"."simulation_score_entries" to "service_role";

grant update on table "public"."simulation_score_entries" to "service_role";

grant delete on table "public"."simulation_score_runs" to "service_role";

grant insert on table "public"."simulation_score_runs" to "service_role";

grant references on table "public"."simulation_score_runs" to "service_role";

grant select on table "public"."simulation_score_runs" to "service_role";

grant trigger on table "public"."simulation_score_runs" to "service_role";

grant truncate on table "public"."simulation_score_runs" to "service_role";

grant update on table "public"."simulation_score_runs" to "service_role";

grant delete on table "public"."simulation_snapshot_predictions" to "service_role";

grant insert on table "public"."simulation_snapshot_predictions" to "service_role";

grant references on table "public"."simulation_snapshot_predictions" to "service_role";

grant select on table "public"."simulation_snapshot_predictions" to "service_role";

grant trigger on table "public"."simulation_snapshot_predictions" to "service_role";

grant truncate on table "public"."simulation_snapshot_predictions" to "service_role";

grant update on table "public"."simulation_snapshot_predictions" to "service_role";

grant delete on table "public"."simulation_snapshots" to "service_role";

grant insert on table "public"."simulation_snapshots" to "service_role";

grant references on table "public"."simulation_snapshots" to "service_role";

grant select on table "public"."simulation_snapshots" to "service_role";

grant trigger on table "public"."simulation_snapshots" to "service_role";

grant truncate on table "public"."simulation_snapshots" to "service_role";

grant update on table "public"."simulation_snapshots" to "service_role";

grant delete on table "public"."simulations" to "service_role";

grant insert on table "public"."simulations" to "service_role";

grant references on table "public"."simulations" to "service_role";

grant select on table "public"."simulations" to "service_role";

grant trigger on table "public"."simulations" to "service_role";

grant truncate on table "public"."simulations" to "service_role";

grant update on table "public"."simulations" to "service_role";

grant delete on table "public"."staging_pending_role_assignments" to "service_role";

grant insert on table "public"."staging_pending_role_assignments" to "service_role";

grant references on table "public"."staging_pending_role_assignments" to "service_role";

grant select on table "public"."staging_pending_role_assignments" to "service_role";

grant trigger on table "public"."staging_pending_role_assignments" to "service_role";

grant truncate on table "public"."staging_pending_role_assignments" to "service_role";

grant update on table "public"."staging_pending_role_assignments" to "service_role";

grant insert on table "public"."staging_role_audit_log" to "service_role";

grant select on table "public"."staging_role_audit_log" to "service_role";

grant delete on table "public"."staging_user_roles" to "service_role";

grant insert on table "public"."staging_user_roles" to "service_role";

grant references on table "public"."staging_user_roles" to "service_role";

grant select on table "public"."staging_user_roles" to "service_role";

grant trigger on table "public"."staging_user_roles" to "service_role";

grant truncate on table "public"."staging_user_roles" to "service_role";

grant update on table "public"."staging_user_roles" to "service_role";

grant select on table "public"."steam_bets" to "authenticated";

grant delete on table "public"."steam_bets" to "service_role";

grant insert on table "public"."steam_bets" to "service_role";

grant references on table "public"."steam_bets" to "service_role";

grant select on table "public"."steam_bets" to "service_role";

grant trigger on table "public"."steam_bets" to "service_role";

grant truncate on table "public"."steam_bets" to "service_role";

grant update on table "public"."steam_bets" to "service_role";

grant delete on table "public"."steam_catalog_sync_runs" to "service_role";

grant insert on table "public"."steam_catalog_sync_runs" to "service_role";

grant references on table "public"."steam_catalog_sync_runs" to "service_role";

grant select on table "public"."steam_catalog_sync_runs" to "service_role";

grant trigger on table "public"."steam_catalog_sync_runs" to "service_role";

grant truncate on table "public"."steam_catalog_sync_runs" to "service_role";

grant update on table "public"."steam_catalog_sync_runs" to "service_role";

grant delete on table "public"."steam_enrichment_runs" to "service_role";

grant insert on table "public"."steam_enrichment_runs" to "service_role";

grant references on table "public"."steam_enrichment_runs" to "service_role";

grant select on table "public"."steam_enrichment_runs" to "service_role";

grant trigger on table "public"."steam_enrichment_runs" to "service_role";

grant truncate on table "public"."steam_enrichment_runs" to "service_role";

grant update on table "public"."steam_enrichment_runs" to "service_role";

grant select on table "public"."steam_forecast_markets" to "anon";

grant select on table "public"."steam_forecast_markets" to "authenticated";

grant delete on table "public"."steam_forecast_markets" to "service_role";

grant insert on table "public"."steam_forecast_markets" to "service_role";

grant references on table "public"."steam_forecast_markets" to "service_role";

grant select on table "public"."steam_forecast_markets" to "service_role";

grant trigger on table "public"."steam_forecast_markets" to "service_role";

grant truncate on table "public"."steam_forecast_markets" to "service_role";

grant update on table "public"."steam_forecast_markets" to "service_role";

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

grant select on table "public"."steam_games" to "anon";

grant select on table "public"."steam_games" to "authenticated";

grant delete on table "public"."steam_games" to "service_role";

grant insert on table "public"."steam_games" to "service_role";

grant references on table "public"."steam_games" to "service_role";

grant select on table "public"."steam_games" to "service_role";

grant trigger on table "public"."steam_games" to "service_role";

grant truncate on table "public"."steam_games" to "service_role";

grant update on table "public"."steam_games" to "service_role";

grant delete on table "public"."steam_market_daily_snapshots" to "service_role";

grant insert on table "public"."steam_market_daily_snapshots" to "service_role";

grant references on table "public"."steam_market_daily_snapshots" to "service_role";

grant select on table "public"."steam_market_daily_snapshots" to "service_role";

grant trigger on table "public"."steam_market_daily_snapshots" to "service_role";

grant truncate on table "public"."steam_market_daily_snapshots" to "service_role";

grant update on table "public"."steam_market_daily_snapshots" to "service_role";

grant select on table "public"."steam_market_results" to "anon";

grant select on table "public"."steam_market_results" to "authenticated";

grant delete on table "public"."steam_market_results" to "service_role";

grant insert on table "public"."steam_market_results" to "service_role";

grant references on table "public"."steam_market_results" to "service_role";

grant select on table "public"."steam_market_results" to "service_role";

grant trigger on table "public"."steam_market_results" to "service_role";

grant truncate on table "public"."steam_market_results" to "service_role";

grant update on table "public"."steam_market_results" to "service_role";

grant delete on table "public"."steam_market_snapshot_predictions" to "service_role";

grant insert on table "public"."steam_market_snapshot_predictions" to "service_role";

grant references on table "public"."steam_market_snapshot_predictions" to "service_role";

grant select on table "public"."steam_market_snapshot_predictions" to "service_role";

grant trigger on table "public"."steam_market_snapshot_predictions" to "service_role";

grant truncate on table "public"."steam_market_snapshot_predictions" to "service_role";

grant update on table "public"."steam_market_snapshot_predictions" to "service_role";

grant delete on table "public"."steam_percentile_models" to "service_role";

grant insert on table "public"."steam_percentile_models" to "service_role";

grant references on table "public"."steam_percentile_models" to "service_role";

grant select on table "public"."steam_percentile_models" to "service_role";

grant trigger on table "public"."steam_percentile_models" to "service_role";

grant truncate on table "public"."steam_percentile_models" to "service_role";

grant update on table "public"."steam_percentile_models" to "service_role";

grant select on table "public"."steam_prediction_score_entries" to "authenticated";

grant delete on table "public"."steam_prediction_score_entries" to "service_role";

grant insert on table "public"."steam_prediction_score_entries" to "service_role";

grant references on table "public"."steam_prediction_score_entries" to "service_role";

grant select on table "public"."steam_prediction_score_entries" to "service_role";

grant trigger on table "public"."steam_prediction_score_entries" to "service_role";

grant truncate on table "public"."steam_prediction_score_entries" to "service_role";

grant update on table "public"."steam_prediction_score_entries" to "service_role";

grant select on table "public"."steam_prediction_versions" to "authenticated";

grant delete on table "public"."steam_prediction_versions" to "service_role";

grant insert on table "public"."steam_prediction_versions" to "service_role";

grant references on table "public"."steam_prediction_versions" to "service_role";

grant select on table "public"."steam_prediction_versions" to "service_role";

grant trigger on table "public"."steam_prediction_versions" to "service_role";

grant truncate on table "public"."steam_prediction_versions" to "service_role";

grant update on table "public"."steam_prediction_versions" to "service_role";

grant delete on table "public"."steam_score_runs" to "service_role";

grant insert on table "public"."steam_score_runs" to "service_role";

grant references on table "public"."steam_score_runs" to "service_role";

grant select on table "public"."steam_score_runs" to "service_role";

grant trigger on table "public"."steam_score_runs" to "service_role";

grant truncate on table "public"."steam_score_runs" to "service_role";

grant update on table "public"."steam_score_runs" to "service_role";

grant delete on table "public"."steam_scoring_config" to "service_role";

grant insert on table "public"."steam_scoring_config" to "service_role";

grant references on table "public"."steam_scoring_config" to "service_role";

grant select on table "public"."steam_scoring_config" to "service_role";

grant trigger on table "public"."steam_scoring_config" to "service_role";

grant truncate on table "public"."steam_scoring_config" to "service_role";

grant update on table "public"."steam_scoring_config" to "service_role";

grant select on table "public"."steam_user_leaderboard_stats" to "anon";

grant select on table "public"."steam_user_leaderboard_stats" to "authenticated";

grant delete on table "public"."steam_user_leaderboard_stats" to "service_role";

grant insert on table "public"."steam_user_leaderboard_stats" to "service_role";

grant references on table "public"."steam_user_leaderboard_stats" to "service_role";

grant select on table "public"."steam_user_leaderboard_stats" to "service_role";

grant trigger on table "public"."steam_user_leaderboard_stats" to "service_role";

grant truncate on table "public"."steam_user_leaderboard_stats" to "service_role";

grant update on table "public"."steam_user_leaderboard_stats" to "service_role";


  create policy "coin_ledger_read_own"
  on "public"."coin_ledger"
  as permissive
  for select
  to authenticated
using ((( SELECT auth.uid() AS uid) = user_id));



  create policy "forecast_targets_public_read"
  on "public"."forecast_targets"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "markets_public_read"
  on "public"."markets"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "numeric_predictions_read_own"
  on "public"."numeric_predictions"
  as permissive
  for select
  to authenticated
using ((( SELECT auth.uid() AS uid) = user_id));



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



  create policy "steam_bets_read_own"
  on "public"."steam_bets"
  as permissive
  for select
  to authenticated
using ((( SELECT auth.uid() AS uid) = user_id));



  create policy "steam_forecast_markets_public_read"
  on "public"."steam_forecast_markets"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "steam_game_media_public_read"
  on "public"."steam_game_media"
  as permissive
  for select
  to anon, authenticated
using ((active = true));



  create policy "steam_games_public_read"
  on "public"."steam_games"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "steam_market_results_public_read"
  on "public"."steam_market_results"
  as permissive
  for select
  to anon, authenticated
using ((is_current = true));



  create policy "steam_prediction_score_entries_read_own"
  on "public"."steam_prediction_score_entries"
  as permissive
  for select
  to authenticated
using ((( SELECT auth.uid() AS uid) = user_id));



  create policy "steam_prediction_versions_read_own"
  on "public"."steam_prediction_versions"
  as permissive
  for select
  to authenticated
using ((( SELECT auth.uid() AS uid) = user_id));



  create policy "steam_user_leaderboard_stats_public_read"
  on "public"."steam_user_leaderboard_stats"
  as permissive
  for select
  to anon, authenticated
using (true);


CREATE TRIGGER coin_ledger_reject_update_delete BEFORE DELETE OR UPDATE ON public.coin_ledger FOR EACH ROW EXECUTE FUNCTION private.reject_coin_ledger_mutation();

CREATE TRIGGER forecast_targets_set_updated_at BEFORE UPDATE ON public.forecast_targets FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER numeric_predictions_set_updated_at BEFORE UPDATE ON public.numeric_predictions FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER simulation_events_append_only BEFORE DELETE OR UPDATE ON public.simulation_events FOR EACH ROW EXECUTE FUNCTION private.reject_staging_append_only_mutation();

CREATE TRIGGER simulation_markets_set_updated_at BEFORE UPDATE ON public.simulation_markets FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER simulations_set_updated_at BEFORE UPDATE ON public.simulations FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER staging_role_audit_append_only BEFORE DELETE OR UPDATE ON public.staging_role_audit_log FOR EACH ROW EXECUTE FUNCTION private.reject_staging_append_only_mutation();

CREATE TRIGGER staging_user_roles_set_updated_at BEFORE UPDATE ON public.staging_user_roles FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER steam_bets_set_updated_at BEFORE UPDATE ON public.steam_bets FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER steam_forecast_markets_set_updated_at BEFORE UPDATE ON public.steam_forecast_markets FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER steam_game_enrichment_state_set_updated_at BEFORE UPDATE ON public.steam_game_enrichment_state FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER steam_games_set_updated_at BEFORE UPDATE ON public.steam_games FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION private.handle_new_user();

CREATE TRIGGER on_auth_user_staging_role_sync AFTER INSERT OR UPDATE OF email, email_confirmed_at ON auth.users FOR EACH ROW EXECUTE FUNCTION private.sync_staging_user_role();


