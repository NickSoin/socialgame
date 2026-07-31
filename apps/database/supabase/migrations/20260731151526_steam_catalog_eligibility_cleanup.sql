alter table "public"."steam_enrichment_runs" drop constraint "steam_enrichment_runs_counts_check";


  create table "public"."steam_catalog_exclusions" (
    "steam_app_id" bigint not null,
    "name" text not null,
    "reason" text not null,
    "steam_app_type" text,
    "release_date" date,
    "source" text not null default 'steam_appdetails'::text,
    "excluded_at" timestamp with time zone not null default now(),
    "last_seen_at" timestamp with time zone not null default now()
      );


alter table "public"."steam_catalog_exclusions" enable row level security;

alter table "public"."steam_enrichment_runs" add column "excluded_count" integer not null default 0;

alter table "public"."steam_games" add column "classification_updated_at" timestamp with time zone;

alter table "public"."steam_games" add column "steam_app_type" text;

CREATE UNIQUE INDEX steam_catalog_exclusions_pkey ON public.steam_catalog_exclusions USING btree (steam_app_id);

CREATE INDEX steam_catalog_exclusions_reason_idx ON public.steam_catalog_exclusions USING btree (reason, excluded_at DESC);

alter table "public"."steam_catalog_exclusions" add constraint "steam_catalog_exclusions_pkey" PRIMARY KEY using index "steam_catalog_exclusions_pkey";

alter table "public"."steam_catalog_exclusions" add constraint "steam_catalog_exclusions_app_id_check" CHECK ((steam_app_id > 0)) not valid;

alter table "public"."steam_catalog_exclusions" validate constraint "steam_catalog_exclusions_app_id_check";

alter table "public"."steam_catalog_exclusions" add constraint "steam_catalog_exclusions_app_type_check" CHECK (((steam_app_type IS NULL) OR (steam_app_type ~ '^[a-z0-9_]{1,40}$'::text))) not valid;

alter table "public"."steam_catalog_exclusions" validate constraint "steam_catalog_exclusions_app_type_check";

alter table "public"."steam_catalog_exclusions" add constraint "steam_catalog_exclusions_name_check" CHECK (((char_length(name) >= 1) AND (char_length(name) <= 250))) not valid;

alter table "public"."steam_catalog_exclusions" validate constraint "steam_catalog_exclusions_name_check";

alter table "public"."steam_catalog_exclusions" add constraint "steam_catalog_exclusions_reason_check" CHECK ((reason = ANY (ARRAY['released_before_cutoff'::text, 'non_game'::text]))) not valid;

alter table "public"."steam_catalog_exclusions" validate constraint "steam_catalog_exclusions_reason_check";

alter table "public"."steam_catalog_exclusions" add constraint "steam_catalog_exclusions_source_check" CHECK ((source = ANY (ARRAY['steam_appdetails'::text, 'catalog_cleanup'::text]))) not valid;

alter table "public"."steam_catalog_exclusions" validate constraint "steam_catalog_exclusions_source_check";

alter table "public"."steam_games" add constraint "steam_games_app_type_check" CHECK (((steam_app_type IS NULL) OR (steam_app_type ~ '^[a-z0-9_]{1,40}$'::text))) not valid;

alter table "public"."steam_games" validate constraint "steam_games_app_type_check";

alter table "public"."steam_games" add constraint "steam_games_classification_check" CHECK ((((steam_app_type IS NULL) AND (classification_updated_at IS NULL)) OR ((steam_app_type IS NOT NULL) AND (classification_updated_at IS NOT NULL)))) not valid;

alter table "public"."steam_games" validate constraint "steam_games_classification_check";

alter table "public"."steam_enrichment_runs" add constraint "steam_enrichment_runs_counts_check" CHECK (((selected_count >= 0) AND (succeeded_count >= 0) AND (partial_count >= 0) AND (unavailable_count >= 0) AND (failed_count >= 0) AND (released_count >= 0) AND (uploaded_count >= 0) AND (skipped_unchanged_count >= 0) AND (still_pending_count >= 0) AND (excluded_count >= 0))) not valid;

alter table "public"."steam_enrichment_runs" validate constraint "steam_enrichment_runs_counts_check";

grant delete on table "public"."steam_catalog_exclusions" to "service_role";

grant insert on table "public"."steam_catalog_exclusions" to "service_role";

grant references on table "public"."steam_catalog_exclusions" to "service_role";

grant select on table "public"."steam_catalog_exclusions" to "service_role";

grant trigger on table "public"."steam_catalog_exclusions" to "service_role";

grant truncate on table "public"."steam_catalog_exclusions" to "service_role";

grant update on table "public"."steam_catalog_exclusions" to "service_role";


