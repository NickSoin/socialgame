revoke delete on table "public"."steam_catalog_exclusions" from "anon";

revoke insert on table "public"."steam_catalog_exclusions" from "anon";

revoke references on table "public"."steam_catalog_exclusions" from "anon";

revoke select on table "public"."steam_catalog_exclusions" from "anon";

revoke trigger on table "public"."steam_catalog_exclusions" from "anon";

revoke truncate on table "public"."steam_catalog_exclusions" from "anon";

revoke update on table "public"."steam_catalog_exclusions" from "anon";

revoke delete on table "public"."steam_catalog_exclusions" from "authenticated";

revoke insert on table "public"."steam_catalog_exclusions" from "authenticated";

revoke references on table "public"."steam_catalog_exclusions" from "authenticated";

revoke select on table "public"."steam_catalog_exclusions" from "authenticated";

revoke trigger on table "public"."steam_catalog_exclusions" from "authenticated";

revoke truncate on table "public"."steam_catalog_exclusions" from "authenticated";

revoke update on table "public"."steam_catalog_exclusions" from "authenticated";

revoke delete on table "public"."steam_ccu_observations" from "anon";

revoke insert on table "public"."steam_ccu_observations" from "anon";

revoke references on table "public"."steam_ccu_observations" from "anon";

revoke select on table "public"."steam_ccu_observations" from "anon";

revoke trigger on table "public"."steam_ccu_observations" from "anon";

revoke truncate on table "public"."steam_ccu_observations" from "anon";

revoke update on table "public"."steam_ccu_observations" from "anon";

revoke delete on table "public"."steam_ccu_observations" from "authenticated";

revoke insert on table "public"."steam_ccu_observations" from "authenticated";

revoke references on table "public"."steam_ccu_observations" from "authenticated";

revoke select on table "public"."steam_ccu_observations" from "authenticated";

revoke trigger on table "public"."steam_ccu_observations" from "authenticated";

revoke truncate on table "public"."steam_ccu_observations" from "authenticated";

revoke update on table "public"."steam_ccu_observations" from "authenticated";

alter table "public"."simulation_score_entries" drop constraint "simulation_score_entries_percentiles_check";

alter table "public"."simulation_score_entries" add constraint "simulation_score_entries_percentiles_check" CHECK ((((user_percentile >= (0)::numeric) AND (user_percentile <= (100)::numeric)) AND ((crowd_without_user_percentile >= (0)::numeric) AND (crowd_without_user_percentile <= (100)::numeric)) AND ((actual_percentile >= (0)::numeric) AND (actual_percentile <= (100)::numeric)))) not valid;

alter table "public"."simulation_score_entries" validate constraint "simulation_score_entries_percentiles_check";


