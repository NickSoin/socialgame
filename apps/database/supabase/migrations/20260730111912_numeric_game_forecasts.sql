
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


  create table "public"."numeric_predictions" (
    "id" uuid not null default gen_random_uuid(),
    "target_id" uuid not null,
    "user_id" uuid not null,
    "value" numeric not null,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."numeric_predictions" enable row level security;

CREATE UNIQUE INDEX forecast_targets_market_key_key ON public.forecast_targets USING btree (market_id, key);

CREATE INDEX forecast_targets_market_order_idx ON public.forecast_targets USING btree (market_id, status, display_order);

CREATE UNIQUE INDEX forecast_targets_pkey ON public.forecast_targets USING btree (id);

CREATE UNIQUE INDEX numeric_predictions_pkey ON public.numeric_predictions USING btree (id);

CREATE INDEX numeric_predictions_target_idx ON public.numeric_predictions USING btree (target_id);

CREATE UNIQUE INDEX numeric_predictions_user_target_key ON public.numeric_predictions USING btree (user_id, target_id);

CREATE INDEX numeric_predictions_user_updated_idx ON public.numeric_predictions USING btree (user_id, updated_at DESC);

alter table "public"."forecast_targets" add constraint "forecast_targets_pkey" PRIMARY KEY using index "forecast_targets_pkey";

alter table "public"."numeric_predictions" add constraint "numeric_predictions_pkey" PRIMARY KEY using index "numeric_predictions_pkey";

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

alter table "public"."numeric_predictions" add constraint "numeric_predictions_target_id_fkey" FOREIGN KEY (target_id) REFERENCES public.forecast_targets(id) ON DELETE CASCADE not valid;

alter table "public"."numeric_predictions" validate constraint "numeric_predictions_target_id_fkey";

alter table "public"."numeric_predictions" add constraint "numeric_predictions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."numeric_predictions" validate constraint "numeric_predictions_user_id_fkey";

alter table "public"."numeric_predictions" add constraint "numeric_predictions_user_target_key" UNIQUE using index "numeric_predictions_user_target_key";

set check_function_bodies = off;

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

grant select on table "public"."forecast_targets" to "anon";

grant select on table "public"."forecast_targets" to "authenticated";

grant delete on table "public"."forecast_targets" to "service_role";

grant insert on table "public"."forecast_targets" to "service_role";

grant references on table "public"."forecast_targets" to "service_role";

grant select on table "public"."forecast_targets" to "service_role";

grant trigger on table "public"."forecast_targets" to "service_role";

grant truncate on table "public"."forecast_targets" to "service_role";

grant update on table "public"."forecast_targets" to "service_role";

grant select on table "public"."numeric_predictions" to "authenticated";

grant delete on table "public"."numeric_predictions" to "service_role";

grant insert on table "public"."numeric_predictions" to "service_role";

grant references on table "public"."numeric_predictions" to "service_role";

grant select on table "public"."numeric_predictions" to "service_role";

grant trigger on table "public"."numeric_predictions" to "service_role";

grant truncate on table "public"."numeric_predictions" to "service_role";

grant update on table "public"."numeric_predictions" to "service_role";


  create policy "forecast_targets_public_read"
  on "public"."forecast_targets"
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


CREATE TRIGGER forecast_targets_set_updated_at BEFORE UPDATE ON public.forecast_targets FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER numeric_predictions_set_updated_at BEFORE UPDATE ON public.numeric_predictions FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();


