drop policy "steam_bets_insert_own" on "public"."steam_bets";

revoke insert on table "public"."steam_bets" from "authenticated";


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

alter table "public"."steam_bets" add column "percentile_model_version" integer;

alter table "public"."steam_bets" add column "percentile_value" numeric;

alter table "public"."steam_bets" add column "updated_at" timestamp with time zone not null default now();

CREATE UNIQUE INDEX steam_forecast_markets_game_metric_key ON public.steam_forecast_markets USING btree (steam_app_id, metric_type);

CREATE UNIQUE INDEX steam_forecast_markets_pkey ON public.steam_forecast_markets USING btree (id);

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

alter table "public"."steam_forecast_markets" add constraint "steam_forecast_markets_pkey" PRIMARY KEY using index "steam_forecast_markets_pkey";

alter table "public"."steam_market_daily_snapshots" add constraint "steam_market_daily_snapshots_pkey" PRIMARY KEY using index "steam_market_daily_snapshots_pkey";

alter table "public"."steam_market_results" add constraint "steam_market_results_pkey" PRIMARY KEY using index "steam_market_results_pkey";

alter table "public"."steam_market_snapshot_predictions" add constraint "steam_market_snapshot_predictions_pkey" PRIMARY KEY using index "steam_market_snapshot_predictions_pkey";

alter table "public"."steam_percentile_models" add constraint "steam_percentile_models_pkey" PRIMARY KEY using index "steam_percentile_models_pkey";

alter table "public"."steam_prediction_score_entries" add constraint "steam_prediction_score_entries_pkey" PRIMARY KEY using index "steam_prediction_score_entries_pkey";

alter table "public"."steam_prediction_versions" add constraint "steam_prediction_versions_pkey" PRIMARY KEY using index "steam_prediction_versions_pkey";

alter table "public"."steam_score_runs" add constraint "steam_score_runs_pkey" PRIMARY KEY using index "steam_score_runs_pkey";

alter table "public"."steam_scoring_config" add constraint "steam_scoring_config_pkey" PRIMARY KEY using index "steam_scoring_config_pkey";

alter table "public"."steam_user_leaderboard_stats" add constraint "steam_user_leaderboard_stats_pkey" PRIMARY KEY using index "steam_user_leaderboard_stats_pkey";

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
    AND (game.is_wishlisted = false OR game.lifecycle_status = 'released');

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
    AND current_result.resolved_at = p_resolved_at
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

  PERFORM public.ensure_steam_points_system();

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
    RAISE EXCEPTION 'forecast market not found' USING ERRCODE = 'P0002';
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
  ON CONFLICT (user_id, steam_app_id, target_key) DO UPDATE SET
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

grant select on table "public"."steam_forecast_markets" to "anon";

grant select on table "public"."steam_forecast_markets" to "authenticated";

grant delete on table "public"."steam_forecast_markets" to "service_role";

grant insert on table "public"."steam_forecast_markets" to "service_role";

grant references on table "public"."steam_forecast_markets" to "service_role";

grant select on table "public"."steam_forecast_markets" to "service_role";

grant trigger on table "public"."steam_forecast_markets" to "service_role";

grant truncate on table "public"."steam_forecast_markets" to "service_role";

grant update on table "public"."steam_forecast_markets" to "service_role";

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


  create policy "steam_forecast_markets_public_read"
  on "public"."steam_forecast_markets"
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


CREATE TRIGGER steam_bets_set_updated_at BEFORE UPDATE ON public.steam_bets FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER steam_forecast_markets_set_updated_at BEFORE UPDATE ON public.steam_forecast_markets FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();


