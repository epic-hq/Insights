create extension if not exists "pg_net" with schema "public" version '0.14.0';

revoke delete on table "public"."annotations" from "anon";

revoke insert on table "public"."annotations" from "anon";

revoke references on table "public"."annotations" from "anon";

revoke select on table "public"."annotations" from "anon";

revoke trigger on table "public"."annotations" from "anon";

revoke truncate on table "public"."annotations" from "anon";

revoke update on table "public"."annotations" from "anon";

revoke delete on table "public"."annotations" from "authenticated";

revoke insert on table "public"."annotations" from "authenticated";

revoke references on table "public"."annotations" from "authenticated";

revoke select on table "public"."annotations" from "authenticated";

revoke trigger on table "public"."annotations" from "authenticated";

revoke truncate on table "public"."annotations" from "authenticated";

revoke update on table "public"."annotations" from "authenticated";

revoke delete on table "public"."annotations" from "service_role";

revoke insert on table "public"."annotations" from "service_role";

revoke references on table "public"."annotations" from "service_role";

revoke select on table "public"."annotations" from "service_role";

revoke trigger on table "public"."annotations" from "service_role";

revoke truncate on table "public"."annotations" from "service_role";

revoke update on table "public"."annotations" from "service_role";

revoke delete on table "public"."entity_flags" from "anon";

revoke insert on table "public"."entity_flags" from "anon";

revoke references on table "public"."entity_flags" from "anon";

revoke select on table "public"."entity_flags" from "anon";

revoke trigger on table "public"."entity_flags" from "anon";

revoke truncate on table "public"."entity_flags" from "anon";

revoke update on table "public"."entity_flags" from "anon";

revoke delete on table "public"."entity_flags" from "authenticated";

revoke insert on table "public"."entity_flags" from "authenticated";

revoke references on table "public"."entity_flags" from "authenticated";

revoke select on table "public"."entity_flags" from "authenticated";

revoke trigger on table "public"."entity_flags" from "authenticated";

revoke truncate on table "public"."entity_flags" from "authenticated";

revoke update on table "public"."entity_flags" from "authenticated";

revoke delete on table "public"."entity_flags" from "service_role";

revoke insert on table "public"."entity_flags" from "service_role";

revoke references on table "public"."entity_flags" from "service_role";

revoke select on table "public"."entity_flags" from "service_role";

revoke trigger on table "public"."entity_flags" from "service_role";

revoke truncate on table "public"."entity_flags" from "service_role";

revoke update on table "public"."entity_flags" from "service_role";

revoke delete on table "public"."votes" from "anon";

revoke insert on table "public"."votes" from "anon";

revoke references on table "public"."votes" from "anon";

revoke select on table "public"."votes" from "anon";

revoke trigger on table "public"."votes" from "anon";

revoke truncate on table "public"."votes" from "anon";

revoke update on table "public"."votes" from "anon";

revoke delete on table "public"."votes" from "authenticated";

revoke insert on table "public"."votes" from "authenticated";

revoke references on table "public"."votes" from "authenticated";

revoke select on table "public"."votes" from "authenticated";

revoke trigger on table "public"."votes" from "authenticated";

revoke truncate on table "public"."votes" from "authenticated";

revoke update on table "public"."votes" from "authenticated";

revoke delete on table "public"."votes" from "service_role";

revoke insert on table "public"."votes" from "service_role";

revoke references on table "public"."votes" from "service_role";

revoke select on table "public"."votes" from "service_role";

revoke trigger on table "public"."votes" from "service_role";

revoke truncate on table "public"."votes" from "service_role";

revoke update on table "public"."votes" from "service_role";

alter table "public"."annotations" drop constraint "annotations_account_id_fkey";

alter table "public"."annotations" drop constraint "annotations_annotation_type_check";

alter table "public"."annotations" drop constraint "annotations_created_by_user_id_fkey";

alter table "public"."annotations" drop constraint "annotations_entity_type_check";

alter table "public"."annotations" drop constraint "annotations_parent_annotation_id_fkey";

alter table "public"."annotations" drop constraint "annotations_project_id_fkey";

alter table "public"."annotations" drop constraint "annotations_status_check";

alter table "public"."annotations" drop constraint "annotations_thread_root_id_fkey";

alter table "public"."annotations" drop constraint "annotations_visibility_check";

alter table "public"."entity_flags" drop constraint "entity_flags_account_id_fkey";

alter table "public"."entity_flags" drop constraint "entity_flags_entity_type_check";

alter table "public"."entity_flags" drop constraint "entity_flags_flag_type_check";

alter table "public"."entity_flags" drop constraint "entity_flags_project_id_fkey";

alter table "public"."entity_flags" drop constraint "entity_flags_user_id_entity_type_entity_id_flag_type_key";

alter table "public"."entity_flags" drop constraint "entity_flags_user_id_fkey";

alter table "public"."votes" drop constraint "votes_account_id_fkey";

alter table "public"."votes" drop constraint "votes_entity_type_check";

alter table "public"."votes" drop constraint "votes_project_id_fkey";

alter table "public"."votes" drop constraint "votes_user_id_entity_type_entity_id_key";

alter table "public"."votes" drop constraint "votes_user_id_fkey";

alter table "public"."votes" drop constraint "votes_vote_value_check";

drop function if exists "public"."get_annotation_counts"(p_entity_type text, p_entity_id uuid, p_project_id uuid);

drop function if exists "public"."get_user_flags"(p_entity_type text, p_entity_id uuid, p_user_id uuid);

drop function if exists "public"."get_user_vote"(p_entity_type text, p_entity_id uuid, p_user_id uuid);

drop function if exists "public"."get_vote_counts"(p_entity_type text, p_entity_id uuid, p_project_id uuid);

alter table "public"."annotations" drop constraint "annotations_pkey";

alter table "public"."entity_flags" drop constraint "entity_flags_pkey";

alter table "public"."votes" drop constraint "votes_pkey";

drop index if exists "public"."annotations_pkey";

drop index if exists "public"."entity_flags_pkey";

drop index if exists "public"."entity_flags_user_id_entity_type_entity_id_flag_type_key";

drop index if exists "public"."idx_annotations_entity";

drop index if exists "public"."idx_annotations_project";

drop index if exists "public"."idx_annotations_thread";

drop index if exists "public"."idx_annotations_type";

drop index if exists "public"."idx_annotations_user";

drop index if exists "public"."idx_entity_flags_entity";

drop index if exists "public"."idx_entity_flags_project";

drop index if exists "public"."idx_entity_flags_user";

drop index if exists "public"."idx_votes_entity";

drop index if exists "public"."idx_votes_project";

drop index if exists "public"."idx_votes_user";

drop index if exists "public"."votes_pkey";

drop index if exists "public"."votes_user_id_entity_type_entity_id_key";

drop table "public"."annotations";

drop table "public"."entity_flags";

drop table "public"."votes";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_account(account_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'accounts', 'public'
AS $function$
DECLARE
    current_user_id uuid;
    user_role text;
BEGIN
    -- Get the current user's id from the JWT/session
    current_user_id := auth.uid();

    -- Check if the user is a member of the account (with proper table aliases)
    SELECT au.account_role INTO user_role
    FROM accounts.account_user au
    WHERE au.account_id = get_account.account_id AND au.user_id = current_user_id
    LIMIT 1;

    IF user_role IS NULL THEN
        RAISE EXCEPTION 'You must be a member of an account to access it';
    END IF;

    -- Return the account data (with proper table aliases and variable names)
    RETURN (
        SELECT json_build_object(
            'account_id', a.id,
            'account_role', user_role,
            'is_primary_owner', a.primary_owner_user_id = current_user_id,
            'name', a.name,
            'slug', a.slug,
            'personal_account', a.personal_account,
            'billing_enabled', CASE
                WHEN a.personal_account = true THEN config.enable_personal_account_billing
                ELSE config.enable_team_account_billing
            END,
            'billing_status', bs.status,
            'created_at', a.created_at,
            'updated_at', a.updated_at,
            'metadata', a.public_metadata
        )
        FROM accounts.accounts a
        JOIN accounts.config config ON true
        LEFT JOIN (
            SELECT bs.account_id, bs.status
            FROM accounts.billing_subscriptions bs
            WHERE bs.account_id = get_account.account_id
            ORDER BY bs.created DESC
            LIMIT 1
        ) bs ON bs.account_id = a.id
        WHERE a.id = get_account.account_id
    );
END;
$function$
;


