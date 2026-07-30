
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
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."steam_games" enable row level security;

CREATE UNIQUE INDEX steam_catalog_sync_runs_pkey ON public.steam_catalog_sync_runs USING btree (id);

CREATE UNIQUE INDEX steam_catalog_sync_runs_source_updated_at_key ON public.steam_catalog_sync_runs USING btree (source_updated_at);

CREATE INDEX steam_catalog_sync_runs_started_idx ON public.steam_catalog_sync_runs USING btree (started_at DESC);

CREATE INDEX steam_games_current_rank_idx ON public.steam_games USING btree (lifecycle_status, is_wishlisted, wishlist_rank) WHERE ((lifecycle_status = 'upcoming'::text) AND (is_wishlisted = true));

CREATE INDEX steam_games_name_search_idx ON public.steam_games USING btree (lower(name) text_pattern_ops);

CREATE UNIQUE INDEX steam_games_pkey ON public.steam_games USING btree (steam_app_id);

CREATE INDEX steam_games_source_updated_idx ON public.steam_games USING btree (source_updated_at DESC);

alter table "public"."steam_catalog_sync_runs" add constraint "steam_catalog_sync_runs_pkey" PRIMARY KEY using index "steam_catalog_sync_runs_pkey";

alter table "public"."steam_games" add constraint "steam_games_pkey" PRIMARY KEY using index "steam_games_pkey";

alter table "public"."steam_catalog_sync_runs" add constraint "steam_catalog_sync_runs_completion_check" CHECK ((((status = 'running'::text) AND (finished_at IS NULL)) OR ((status = ANY (ARRAY['success'::text, 'error'::text])) AND (finished_at IS NOT NULL)))) not valid;

alter table "public"."steam_catalog_sync_runs" validate constraint "steam_catalog_sync_runs_completion_check";

alter table "public"."steam_catalog_sync_runs" add constraint "steam_catalog_sync_runs_counts_check" CHECK (((current_count >= 0) AND (released_count >= 0))) not valid;

alter table "public"."steam_catalog_sync_runs" validate constraint "steam_catalog_sync_runs_counts_check";

alter table "public"."steam_catalog_sync_runs" add constraint "steam_catalog_sync_runs_source_updated_at_key" UNIQUE using index "steam_catalog_sync_runs_source_updated_at_key";

alter table "public"."steam_catalog_sync_runs" add constraint "steam_catalog_sync_runs_status_check" CHECK ((status = ANY (ARRAY['running'::text, 'success'::text, 'error'::text]))) not valid;

alter table "public"."steam_catalog_sync_runs" validate constraint "steam_catalog_sync_runs_status_check";

alter table "public"."steam_games" add constraint "steam_games_app_id_check" CHECK ((steam_app_id > 0)) not valid;

alter table "public"."steam_games" validate constraint "steam_games_app_id_check";

alter table "public"."steam_games" add constraint "steam_games_image_url_check" CHECK ((image_url ~ '^https://'::text)) not valid;

alter table "public"."steam_games" validate constraint "steam_games_image_url_check";

alter table "public"."steam_games" add constraint "steam_games_lifecycle_check" CHECK ((lifecycle_status = ANY (ARRAY['upcoming'::text, 'released'::text]))) not valid;

alter table "public"."steam_games" validate constraint "steam_games_lifecycle_check";

alter table "public"."steam_games" add constraint "steam_games_name_check" CHECK (((char_length(name) >= 1) AND (char_length(name) <= 250))) not valid;

alter table "public"."steam_games" validate constraint "steam_games_name_check";

alter table "public"."steam_games" add constraint "steam_games_pre_release_rank_check" CHECK (((pre_release_rank IS NULL) OR ((pre_release_rank >= 1) AND (pre_release_rank <= 10000)))) not valid;

alter table "public"."steam_games" validate constraint "steam_games_pre_release_rank_check";

alter table "public"."steam_games" add constraint "steam_games_release_label_check" CHECK (((char_length(release_label) >= 1) AND (char_length(release_label) <= 80))) not valid;

alter table "public"."steam_games" validate constraint "steam_games_release_label_check";

alter table "public"."steam_games" add constraint "steam_games_release_state_check" CHECK ((((lifecycle_status = 'upcoming'::text) AND (released_at IS NULL)) OR ((lifecycle_status = 'released'::text) AND (released_at IS NOT NULL)))) not valid;

alter table "public"."steam_games" validate constraint "steam_games_release_state_check";

alter table "public"."steam_games" add constraint "steam_games_wishlist_rank_check" CHECK (((wishlist_rank IS NULL) OR ((wishlist_rank >= 1) AND (wishlist_rank <= 10000)))) not valid;

alter table "public"."steam_games" validate constraint "steam_games_wishlist_rank_check";

grant delete on table "public"."steam_catalog_sync_runs" to "service_role";

grant insert on table "public"."steam_catalog_sync_runs" to "service_role";

grant references on table "public"."steam_catalog_sync_runs" to "service_role";

grant select on table "public"."steam_catalog_sync_runs" to "service_role";

grant trigger on table "public"."steam_catalog_sync_runs" to "service_role";

grant truncate on table "public"."steam_catalog_sync_runs" to "service_role";

grant update on table "public"."steam_catalog_sync_runs" to "service_role";

grant select on table "public"."steam_games" to "anon";

grant select on table "public"."steam_games" to "authenticated";

grant delete on table "public"."steam_games" to "service_role";

grant insert on table "public"."steam_games" to "service_role";

grant references on table "public"."steam_games" to "service_role";

grant select on table "public"."steam_games" to "service_role";

grant trigger on table "public"."steam_games" to "service_role";

grant truncate on table "public"."steam_games" to "service_role";

grant update on table "public"."steam_games" to "service_role";


  create policy "steam_games_public_read"
  on "public"."steam_games"
  as permissive
  for select
  to anon, authenticated
using (true);


CREATE TRIGGER steam_games_set_updated_at BEFORE UPDATE ON public.steam_games FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();


