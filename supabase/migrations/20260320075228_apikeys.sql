drop trigger if exists "check_duplicate_invitation_trigger" on "accounts"."invitations";

drop trigger if exists "invitation_rate_limit_trigger" on "accounts"."invitations";

drop trigger if exists "log_invitation_created_trigger" on "accounts"."invitations";

drop trigger if exists "log_invitation_deleted_trigger" on "accounts"."invitations";

drop trigger if exists "update_lens_summaries_updated_at" on "public"."conversation_lens_summaries";

drop policy "Audit viewable by account owners" on "accounts"."invitation_audit";

drop policy "Account members can access artifacts" on "public"."artifacts";

drop policy "Account members can insert artifacts" on "public"."artifacts";

drop policy "Account members can update artifacts" on "public"."artifacts";

drop policy "insights_read_only" on "public"."insights";

drop policy "Users can view people in their projects" on "public"."people";

drop policy "Users can create merge history for their projects" on "public"."person_merge_history";

drop policy "Users can view merge history for their projects" on "public"."person_merge_history";

drop policy "Service role can manage thread_seq" on "public"."thread_seq";

drop policy "Account members can access threads" on "public"."threads";

drop policy "Account members can insert threads" on "public"."threads";

drop policy "Account members can update threads" on "public"."threads";

drop policy "Account members can access ui_events" on "public"."ui_events";

drop policy "Account members can insert ui_events" on "public"."ui_events";

drop policy "Account members can access ui_state" on "public"."ui_state";

drop policy "Account members can update ui_state" on "public"."ui_state";

drop policy "Account members can write ui_state" on "public"."ui_state";

drop policy "Members can read research link responses" on "public"."research_link_responses";

revoke insert on table "accounts"."invitation_audit" from "authenticated";

revoke select on table "accounts"."invitation_audit" from "authenticated";

revoke insert on table "accounts"."invitation_audit" from "service_role";

revoke select on table "accounts"."invitation_audit" from "service_role";

revoke select on table "billing"."credit_ledger" from "authenticated";

revoke insert on table "billing"."credit_ledger" from "service_role";

revoke select on table "billing"."credit_ledger" from "service_role";

revoke update on table "billing"."credit_ledger" from "service_role";

revoke select on table "billing"."feature_entitlements" from "authenticated";

revoke delete on table "billing"."feature_entitlements" from "service_role";

revoke insert on table "billing"."feature_entitlements" from "service_role";

revoke select on table "billing"."feature_entitlements" from "service_role";

revoke update on table "billing"."feature_entitlements" from "service_role";

revoke select on table "billing"."usage_events" from "authenticated";

revoke insert on table "billing"."usage_events" from "service_role";

revoke select on table "billing"."usage_events" from "service_role";

revoke delete on table "public"."artifacts" from "anon";

revoke insert on table "public"."artifacts" from "anon";

revoke references on table "public"."artifacts" from "anon";

revoke select on table "public"."artifacts" from "anon";

revoke trigger on table "public"."artifacts" from "anon";

revoke truncate on table "public"."artifacts" from "anon";

revoke update on table "public"."artifacts" from "anon";

revoke delete on table "public"."artifacts" from "authenticated";

revoke insert on table "public"."artifacts" from "authenticated";

revoke references on table "public"."artifacts" from "authenticated";

revoke select on table "public"."artifacts" from "authenticated";

revoke trigger on table "public"."artifacts" from "authenticated";

revoke truncate on table "public"."artifacts" from "authenticated";

revoke update on table "public"."artifacts" from "authenticated";

revoke delete on table "public"."artifacts" from "service_role";

revoke insert on table "public"."artifacts" from "service_role";

revoke references on table "public"."artifacts" from "service_role";

revoke select on table "public"."artifacts" from "service_role";

revoke trigger on table "public"."artifacts" from "service_role";

revoke truncate on table "public"."artifacts" from "service_role";

revoke update on table "public"."artifacts" from "service_role";

revoke delete on table "public"."person_merge_history" from "anon";

revoke insert on table "public"."person_merge_history" from "anon";

revoke references on table "public"."person_merge_history" from "anon";

revoke select on table "public"."person_merge_history" from "anon";

revoke trigger on table "public"."person_merge_history" from "anon";

revoke truncate on table "public"."person_merge_history" from "anon";

revoke update on table "public"."person_merge_history" from "anon";

revoke delete on table "public"."person_merge_history" from "authenticated";

revoke insert on table "public"."person_merge_history" from "authenticated";

revoke references on table "public"."person_merge_history" from "authenticated";

revoke select on table "public"."person_merge_history" from "authenticated";

revoke trigger on table "public"."person_merge_history" from "authenticated";

revoke truncate on table "public"."person_merge_history" from "authenticated";

revoke update on table "public"."person_merge_history" from "authenticated";

revoke delete on table "public"."person_merge_history" from "service_role";

revoke insert on table "public"."person_merge_history" from "service_role";

revoke references on table "public"."person_merge_history" from "service_role";

revoke select on table "public"."person_merge_history" from "service_role";

revoke trigger on table "public"."person_merge_history" from "service_role";

revoke truncate on table "public"."person_merge_history" from "service_role";

revoke update on table "public"."person_merge_history" from "service_role";

revoke delete on table "public"."thread_seq" from "anon";

revoke insert on table "public"."thread_seq" from "anon";

revoke references on table "public"."thread_seq" from "anon";

revoke select on table "public"."thread_seq" from "anon";

revoke trigger on table "public"."thread_seq" from "anon";

revoke truncate on table "public"."thread_seq" from "anon";

revoke update on table "public"."thread_seq" from "anon";

revoke delete on table "public"."thread_seq" from "authenticated";

revoke insert on table "public"."thread_seq" from "authenticated";

revoke references on table "public"."thread_seq" from "authenticated";

revoke select on table "public"."thread_seq" from "authenticated";

revoke trigger on table "public"."thread_seq" from "authenticated";

revoke truncate on table "public"."thread_seq" from "authenticated";

revoke update on table "public"."thread_seq" from "authenticated";

revoke delete on table "public"."thread_seq" from "service_role";

revoke insert on table "public"."thread_seq" from "service_role";

revoke references on table "public"."thread_seq" from "service_role";

revoke select on table "public"."thread_seq" from "service_role";

revoke trigger on table "public"."thread_seq" from "service_role";

revoke truncate on table "public"."thread_seq" from "service_role";

revoke update on table "public"."thread_seq" from "service_role";

revoke delete on table "public"."threads" from "anon";

revoke insert on table "public"."threads" from "anon";

revoke references on table "public"."threads" from "anon";

revoke select on table "public"."threads" from "anon";

revoke trigger on table "public"."threads" from "anon";

revoke truncate on table "public"."threads" from "anon";

revoke update on table "public"."threads" from "anon";

revoke delete on table "public"."threads" from "authenticated";

revoke insert on table "public"."threads" from "authenticated";

revoke references on table "public"."threads" from "authenticated";

revoke select on table "public"."threads" from "authenticated";

revoke trigger on table "public"."threads" from "authenticated";

revoke truncate on table "public"."threads" from "authenticated";

revoke update on table "public"."threads" from "authenticated";

revoke delete on table "public"."threads" from "service_role";

revoke insert on table "public"."threads" from "service_role";

revoke references on table "public"."threads" from "service_role";

revoke select on table "public"."threads" from "service_role";

revoke trigger on table "public"."threads" from "service_role";

revoke truncate on table "public"."threads" from "service_role";

revoke update on table "public"."threads" from "service_role";

revoke delete on table "public"."ui_events" from "anon";

revoke insert on table "public"."ui_events" from "anon";

revoke references on table "public"."ui_events" from "anon";

revoke select on table "public"."ui_events" from "anon";

revoke trigger on table "public"."ui_events" from "anon";

revoke truncate on table "public"."ui_events" from "anon";

revoke update on table "public"."ui_events" from "anon";

revoke delete on table "public"."ui_events" from "authenticated";

revoke insert on table "public"."ui_events" from "authenticated";

revoke references on table "public"."ui_events" from "authenticated";

revoke select on table "public"."ui_events" from "authenticated";

revoke trigger on table "public"."ui_events" from "authenticated";

revoke truncate on table "public"."ui_events" from "authenticated";

revoke update on table "public"."ui_events" from "authenticated";

revoke delete on table "public"."ui_events" from "service_role";

revoke insert on table "public"."ui_events" from "service_role";

revoke references on table "public"."ui_events" from "service_role";

revoke select on table "public"."ui_events" from "service_role";

revoke trigger on table "public"."ui_events" from "service_role";

revoke truncate on table "public"."ui_events" from "service_role";

revoke update on table "public"."ui_events" from "service_role";

revoke delete on table "public"."ui_state" from "anon";

revoke insert on table "public"."ui_state" from "anon";

revoke references on table "public"."ui_state" from "anon";

revoke select on table "public"."ui_state" from "anon";

revoke trigger on table "public"."ui_state" from "anon";

revoke truncate on table "public"."ui_state" from "anon";

revoke update on table "public"."ui_state" from "anon";

revoke delete on table "public"."ui_state" from "authenticated";

revoke insert on table "public"."ui_state" from "authenticated";

revoke references on table "public"."ui_state" from "authenticated";

revoke select on table "public"."ui_state" from "authenticated";

revoke trigger on table "public"."ui_state" from "authenticated";

revoke truncate on table "public"."ui_state" from "authenticated";

revoke update on table "public"."ui_state" from "authenticated";

revoke delete on table "public"."ui_state" from "service_role";

revoke insert on table "public"."ui_state" from "service_role";

revoke references on table "public"."ui_state" from "service_role";

revoke select on table "public"."ui_state" from "service_role";

revoke trigger on table "public"."ui_state" from "service_role";

revoke truncate on table "public"."ui_state" from "service_role";

revoke update on table "public"."ui_state" from "service_role";

alter table "public"."artifacts" drop constraint "artifacts_account_id_fkey";

alter table "public"."artifacts" drop constraint "artifacts_created_by_check";

alter table "public"."artifacts" drop constraint "artifacts_parent_id_fkey";

alter table "public"."artifacts" drop constraint "artifacts_status_check";

alter table "public"."artifacts" drop constraint "artifacts_thread_id_fkey";

alter table "public"."interviews" drop constraint "interviews_recall_recording_id_key";

alter table "public"."interviews" drop constraint "interviews_research_link_id_fkey";

alter table "public"."person_merge_history" drop constraint "person_merge_history_account_id_fkey";

alter table "public"."person_merge_history" drop constraint "person_merge_history_merged_by_fkey";

alter table "public"."person_merge_history" drop constraint "person_merge_history_project_id_fkey";

alter table "public"."person_merge_history" drop constraint "person_merge_history_target_person_id_fkey";

alter table "public"."research_link_responses" drop constraint "research_link_responses_evidence_id_fkey";

alter table "public"."research_links" drop constraint "research_links_personalized_for_fkey";

alter table "public"."research_links" drop constraint "research_links_survey_goal_check";

alter table "public"."thread_seq" drop constraint "thread_seq_account_id_fkey";

alter table "public"."thread_seq" drop constraint "thread_seq_thread_id_fkey";

alter table "public"."threads" drop constraint "threads_account_id_fkey";

alter table "public"."ui_events" drop constraint "ui_events_account_id_fkey";

alter table "public"."ui_events" drop constraint "ui_events_actor_check";

alter table "public"."ui_events" drop constraint "ui_events_artifact_id_fkey";

alter table "public"."ui_events" drop constraint "ui_events_thread_id_client_event_id_key";

alter table "public"."ui_events" drop constraint "ui_events_thread_id_fkey";

alter table "public"."ui_events" drop constraint "ui_events_thread_id_seq_key";

alter table "public"."ui_state" drop constraint "ui_state_account_id_fkey";

alter table "public"."ui_state" drop constraint "ui_state_thread_id_fkey";

alter table "public"."ui_state" drop constraint "ui_state_updated_by_check";

alter table "public"."actions" drop constraint "actions_insight_id_fkey";

alter table "public"."comments" drop constraint "comments_insight_id_fkey";

alter table "public"."insight_tags" drop constraint "insight_tags_insight_id_fkey";

alter table "public"."opportunity_insights" drop constraint "opportunity_insights_insight_id_fkey";

alter table "public"."persona_insights" drop constraint "persona_insights_insight_id_fkey";

drop function if exists "accounts"."check_duplicate_active_invitation"();

drop function if exists "accounts"."check_invitation_rate_limit"();

drop function if exists "accounts"."log_invitation_created"();

drop function if exists "accounts"."log_invitation_deleted"();

drop function if exists "billing"."get_admin_daily_usage"(p_start_date timestamp with time zone, p_end_date timestamp with time zone);

drop function if exists "billing"."get_admin_usage_by_account"(p_start_date timestamp with time zone, p_end_date timestamp with time zone);

drop function if exists "billing"."get_admin_usage_by_feature"(p_start_date timestamp with time zone, p_end_date timestamp with time zone);

drop function if exists "public"."cleanup_expired_invitations"();

drop function if exists "public"."get_account_research_link_ids"();

drop function if exists "public"."get_admin_daily_usage"(p_start_date timestamp with time zone, p_end_date timestamp with time zone);

drop function if exists "public"."get_admin_daily_usage_by_feature"(p_start_date timestamp with time zone, p_end_date timestamp with time zone);

drop function if exists "public"."get_admin_recent_login_activity"(p_user_limit integer, p_feature_limit integer);

drop function if exists "public"."get_admin_usage_by_account"(p_start_date timestamp with time zone, p_end_date timestamp with time zone);

drop function if exists "public"."get_admin_usage_by_feature"(p_start_date timestamp with time zone, p_end_date timestamp with time zone);

drop function if exists "public"."get_admin_usage_by_user"(p_start_date timestamp with time zone, p_end_date timestamp with time zone);

drop function if exists "public"."get_monthly_usage_summary"(p_account_id uuid);

drop function if exists "public"."get_person_top_themes"(p_person_id uuid, p_limit integer);

drop function if exists "public"."get_research_link_response_counts"(link_ids uuid[]);

drop function if exists "public"."get_user_response_account_ids"();

drop function if exists "public"."get_user_response_link_ids"();

drop function if exists "public"."ingest_ui_event"(p_account_id uuid, p_thread_id uuid, p_client_event_id uuid, p_event_type text, p_path text, p_value jsonb, p_artifact_id uuid, p_actor text, p_trace_id uuid);

drop view if exists "public"."insights_with_priority";

drop function if exists "public"."is_email_account_member"(check_account_id uuid, check_email text);

drop function if exists "public"."is_platform_admin"();

drop function if exists "public"."log_invitation_audit"(p_invitation_id uuid, p_account_id uuid, p_action text, p_invitee_email text, p_account_role accounts.account_role, p_details jsonb);

drop function if exists "public"."merge_people_transaction"(p_source_person_id uuid, p_target_person_id uuid, p_account_id uuid, p_project_id uuid, p_merged_by uuid, p_reason text, p_source_person_data jsonb, p_source_person_name text, p_target_person_name text, p_evidence_count integer, p_interview_count integer, p_facet_count integer);

drop function if exists "public"."record_usage_event"(p_account_id uuid, p_project_id uuid, p_user_id uuid, p_provider text, p_model text, p_input_tokens integer, p_output_tokens integer, p_estimated_cost_usd numeric, p_credits_charged integer, p_feature_source text, p_resource_type text, p_resource_id text, p_idempotency_key text);

drop function if exists "public"."update_lens_summaries_timestamp"();

drop function if exists "public"."user_has_response_for_link"(link_id uuid);

drop view if exists "public"."conversations";

drop view if exists "public"."decision_question_summary";

drop view if exists "public"."persona_distribution";

drop view if exists "public"."research_question_summary";

drop view if exists "public"."insights_current";

drop view if exists "public"."project_answer_metrics";

alter table "accounts"."invitation_audit" drop constraint "invitation_audit_pkey";

alter table "public"."artifacts" drop constraint "artifacts_pkey";

alter table "public"."person_merge_history" drop constraint "person_merge_history_pkey";

alter table "public"."thread_seq" drop constraint "thread_seq_pkey";

alter table "public"."threads" drop constraint "threads_pkey";

alter table "public"."ui_events" drop constraint "ui_events_pkey";

alter table "public"."ui_state" drop constraint "ui_state_pkey";

drop index if exists "accounts"."invitation_audit_account_idx";

drop index if exists "accounts"."invitation_audit_created_at_idx";

drop index if exists "accounts"."invitation_audit_invitation_id_idx";

drop index if exists "accounts"."invitation_audit_pkey";

drop index if exists "public"."artifacts_pkey";

drop index if exists "public"."artifacts_status_idx";

drop index if exists "public"."artifacts_thread_type_created_idx";

drop index if exists "public"."idx_calendar_connections_pica";

drop index if exists "public"."idx_evidence_active";

drop index if exists "public"."idx_evidence_soft_deleted";

drop index if exists "public"."idx_interviews_recall_recording_id";

drop index if exists "public"."idx_interviews_speaker_review_needed";

drop index if exists "public"."idx_people_deleted_at";

drop index if exists "public"."idx_person_merge_history_account";

drop index if exists "public"."idx_person_merge_history_merged_at";

drop index if exists "public"."idx_person_merge_history_project";

drop index if exists "public"."idx_person_merge_history_source";

drop index if exists "public"."idx_person_merge_history_target";

drop index if exists "public"."idx_user_settings_legacy_trial";

drop index if exists "public"."interviews_recall_recording_id_key";

drop index if exists "public"."person_merge_history_pkey";

drop index if exists "public"."thread_seq_pkey";

drop index if exists "public"."threads_account_id_idx";

drop index if exists "public"."threads_pkey";

drop index if exists "public"."threads_resource_id_idx";

drop index if exists "public"."ui_events_event_type_idx";

drop index if exists "public"."ui_events_pkey";

drop index if exists "public"."ui_events_thread_id_client_event_id_key";

drop index if exists "public"."ui_events_thread_id_seq_key";

drop index if exists "public"."ui_events_thread_seq_idx";

drop index if exists "public"."ui_state_pkey";

drop index if exists "public"."ui_state_thread_idx";

drop table "accounts"."invitation_audit";

drop table "public"."artifacts";

drop table "public"."person_merge_history";

drop table "public"."thread_seq";

drop table "public"."threads";

drop table "public"."ui_events";

drop table "public"."ui_state";


  create table "public"."project_api_keys" (
    "id" uuid not null default gen_random_uuid(),
    "account_id" uuid not null,
    "project_id" uuid not null,
    "name" text not null,
    "key_prefix" text not null,
    "key_hash" text not null,
    "scopes" text[] not null default '{read}'::text[],
    "last_used_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    "created_by" uuid,
    "created_at" timestamp with time zone not null default now(),
    "revoked_at" timestamp with time zone
      );


alter table "public"."project_api_keys" enable row level security;


  create table "public"."project_snapshots" (
    "id" uuid not null default gen_random_uuid(),
    "project_id" uuid not null,
    "account_id" uuid not null,
    "snapshot_date" date not null default CURRENT_DATE,
    "data" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."project_snapshots" enable row level security;

alter table "public"."evidence" drop column "deleted_at";

alter table "public"."evidence" drop column "is_archived";

alter table "public"."interviews" drop column "meeting_platform";

alter table "public"."interviews" drop column "recall_recording_id";

alter table "public"."interviews" drop column "transcript_url";

alter table "public"."interviews" add column "draft_responses" jsonb default '{}'::jsonb;

alter table "public"."people" drop column "deleted_at";

alter table "public"."people" add column "when_met" timestamp with time zone;

alter table "public"."people" add column "where_met" text;

alter table "public"."projects" add column "is_public" boolean default false;

alter table "public"."projects" add column "public_allow_chat" boolean default false;

alter table "public"."projects" add column "public_calendar_url" text;

alter table "public"."projects" add column "public_cta_helper" text;

alter table "public"."projects" add column "public_cta_label" text default 'Share your feedback'::text;

alter table "public"."projects" add column "public_hero_subtitle" text;

alter table "public"."projects" add column "public_hero_title" text;

alter table "public"."projects" add column "public_redirect_url" text;

alter table "public"."projects" add column "public_slug" text;

alter table "public"."research_link_responses" add column "first_name" text;

alter table "public"."research_link_responses" add column "last_name" text;

alter table "public"."research_link_responses" add column "person_id" uuid;

alter table "public"."research_link_responses" alter column "evidence_count" set not null;

alter table "public"."research_link_responses" alter column "evidence_extracted" set not null;

alter table "public"."research_links" drop column "generation_metadata";

alter table "public"."research_links" drop column "personalized_for";

alter table "public"."research_links" drop column "survey_goal";

alter table "public"."user_settings" drop column "legacy_trial_provisioned_at";

CREATE INDEX idx_project_api_keys_hash ON public.project_api_keys USING btree (key_hash) WHERE (revoked_at IS NULL);

CREATE INDEX idx_project_api_keys_project ON public.project_api_keys USING btree (project_id, created_at DESC) WHERE (revoked_at IS NULL);

CREATE INDEX idx_project_snapshots_project_date ON public.project_snapshots USING btree (project_id, snapshot_date DESC);

CREATE INDEX idx_projects_account_public ON public.projects USING btree (account_id, is_public) WHERE (is_public = true);

CREATE UNIQUE INDEX idx_projects_public_slug ON public.projects USING btree (public_slug) WHERE (public_slug IS NOT NULL);

CREATE UNIQUE INDEX project_api_keys_pkey ON public.project_api_keys USING btree (id);

CREATE UNIQUE INDEX project_snapshots_pkey ON public.project_snapshots USING btree (id);

CREATE UNIQUE INDEX project_snapshots_project_id_snapshot_date_key ON public.project_snapshots USING btree (project_id, snapshot_date);

CREATE INDEX research_link_responses_person_id_idx ON public.research_link_responses USING btree (person_id);

alter table "public"."project_api_keys" add constraint "project_api_keys_pkey" PRIMARY KEY using index "project_api_keys_pkey";

alter table "public"."project_snapshots" add constraint "project_snapshots_pkey" PRIMARY KEY using index "project_snapshots_pkey";

alter table "public"."project_api_keys" add constraint "project_api_keys_account_id_fkey" FOREIGN KEY (account_id) REFERENCES accounts.accounts(id) ON DELETE CASCADE not valid;

alter table "public"."project_api_keys" validate constraint "project_api_keys_account_id_fkey";

alter table "public"."project_api_keys" add constraint "project_api_keys_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) not valid;

alter table "public"."project_api_keys" validate constraint "project_api_keys_created_by_fkey";

alter table "public"."project_api_keys" add constraint "project_api_keys_project_id_fkey" FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE not valid;

alter table "public"."project_api_keys" validate constraint "project_api_keys_project_id_fkey";

alter table "public"."project_snapshots" add constraint "project_snapshots_account_id_fkey" FOREIGN KEY (account_id) REFERENCES accounts.accounts(id) ON DELETE CASCADE not valid;

alter table "public"."project_snapshots" validate constraint "project_snapshots_account_id_fkey";

alter table "public"."project_snapshots" add constraint "project_snapshots_project_id_fkey" FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE not valid;

alter table "public"."project_snapshots" validate constraint "project_snapshots_project_id_fkey";

alter table "public"."project_snapshots" add constraint "project_snapshots_project_id_snapshot_date_key" UNIQUE using index "project_snapshots_project_id_snapshot_date_key";

alter table "public"."research_link_responses" add constraint "research_link_responses_person_id_fkey" FOREIGN KEY (person_id) REFERENCES public.people(id) ON DELETE SET NULL not valid;

alter table "public"."research_link_responses" validate constraint "research_link_responses_person_id_fkey";

alter table "public"."actions" add constraint "actions_insight_id_fkey" FOREIGN KEY (insight_id) REFERENCES public.themes(id) ON DELETE SET NULL not valid;

alter table "public"."actions" validate constraint "actions_insight_id_fkey";

alter table "public"."comments" add constraint "comments_insight_id_fkey" FOREIGN KEY (insight_id) REFERENCES public.insights(id) ON DELETE CASCADE not valid;

alter table "public"."comments" validate constraint "comments_insight_id_fkey";

alter table "public"."insight_tags" add constraint "insight_tags_insight_id_fkey" FOREIGN KEY (insight_id) REFERENCES public.themes(id) ON DELETE CASCADE not valid;

alter table "public"."insight_tags" validate constraint "insight_tags_insight_id_fkey";

alter table "public"."opportunity_insights" add constraint "opportunity_insights_insight_id_fkey" FOREIGN KEY (insight_id) REFERENCES public.themes(id) ON DELETE CASCADE not valid;

alter table "public"."opportunity_insights" validate constraint "opportunity_insights_insight_id_fkey";

alter table "public"."persona_insights" add constraint "persona_insights_insight_id_fkey" FOREIGN KEY (insight_id) REFERENCES public.themes(id) ON DELETE CASCADE not valid;

alter table "public"."persona_insights" validate constraint "persona_insights_insight_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.finalize_survey_response(p_interview_id uuid, p_prompts jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_draft jsonb;
  v_transcript jsonb := '[]'::jsonb;
  v_prompt jsonb;
  v_answer text;
BEGIN
  -- Get draft responses
  SELECT draft_responses INTO v_draft
  FROM interviews
  WHERE id = p_interview_id;

  -- Build transcript_formatted from prompts and answers
  FOR v_prompt IN SELECT * FROM jsonb_array_elements(p_prompts)
  LOOP
    v_answer := v_draft->>((v_prompt->>'id')::text);
    IF v_answer IS NOT NULL AND v_answer != '' THEN
      v_transcript := v_transcript || jsonb_build_object(
        'speaker', 'Interviewer',
        'text', v_prompt->>'text'
      ) || jsonb_build_object(
        'speaker', 'Participant',
        'text', v_answer
      );
    END IF;
  END LOOP;

  -- Update interview with finalized transcript
  UPDATE interviews
  SET
    transcript_formatted = v_transcript,
    transcript = (
      SELECT string_agg(
        CASE
          WHEN elem->>'speaker' = 'Interviewer' THEN 'Q: ' || (elem->>'text')
          ELSE 'A: ' || (elem->>'text')
        END,
        E'\n\n'
      )
      FROM jsonb_array_elements(v_transcript) AS elem
    ),
    draft_responses = '{}'::jsonb,
    status = 'uploaded' -- Triggers analysis pipeline
  WHERE id = p_interview_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION billing.get_active_entitlement(p_account_id uuid, p_feature_key text)
 RETURNS TABLE(id uuid, enabled boolean, source billing.entitlement_source, quantity_limit integer, quantity_used integer, quantity_remaining integer, valid_until timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        e.id,
        e.enabled,
        e.source,
        e.quantity_limit,
        e.quantity_used,
        CASE
            WHEN e.quantity_limit IS NOT NULL
            THEN e.quantity_limit - COALESCE(e.quantity_used, 0)
            ELSE NULL
        END AS quantity_remaining,
        e.valid_until
    FROM billing.feature_entitlements e
    WHERE e.account_id = p_account_id
        AND e.feature_key = p_feature_key
        AND e.enabled = true
        AND e.valid_from <= now()
        AND (e.valid_until IS NULL OR e.valid_until > now())
    ORDER BY
        -- Priority: override > promo > addon > plan
        CASE e.source
            WHEN 'override' THEN 1
            WHEN 'promo' THEN 2
            WHEN 'addon' THEN 3
            WHEN 'plan' THEN 4
        END,
        e.created_at DESC
    LIMIT 1;
END;
$function$
;

CREATE OR REPLACE FUNCTION billing.grant_credits(p_account_id uuid, p_amount integer, p_source billing.credit_source, p_idempotency_key text, p_expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_billing_period_start timestamp with time zone DEFAULT NULL::timestamp with time zone, p_billing_period_end timestamp with time zone DEFAULT NULL::timestamp with time zone, p_created_by uuid DEFAULT NULL::uuid, p_metadata jsonb DEFAULT NULL::jsonb)
 RETURNS TABLE(success boolean, is_duplicate boolean, ledger_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_ledger_id UUID;
BEGIN
    INSERT INTO billing.credit_ledger (
        account_id,
        event_type,
        amount,
        source,
        idempotency_key,
        expires_at,
        billing_period_start,
        billing_period_end,
        created_by,
        metadata
    ) VALUES (
        p_account_id,
        'grant',
        p_amount,
        p_source,
        p_idempotency_key,
        p_expires_at,
        p_billing_period_start,
        p_billing_period_end,
        p_created_by,
        COALESCE(p_metadata, '{}'::jsonb)
    ) ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING id INTO v_ledger_id;

    IF v_ledger_id IS NULL THEN
        -- Duplicate detected
        RETURN QUERY SELECT TRUE, TRUE, NULL::UUID;
    ELSE
        RETURN QUERY SELECT TRUE, FALSE, v_ledger_id;
    END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION billing.increment_voice_minutes(p_account_id uuid, p_minutes integer)
 RETURNS TABLE(success boolean, new_quantity_used integer, quantity_remaining integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_entitlement_id UUID;
    v_quantity_limit INTEGER;
    v_new_used INTEGER;
BEGIN
    -- Get the active voice_chat entitlement
    SELECT e.id, e.quantity_limit, e.quantity_used + p_minutes
    INTO v_entitlement_id, v_quantity_limit, v_new_used
    FROM billing.feature_entitlements e
    WHERE e.account_id = p_account_id
        AND e.feature_key = 'voice_chat'
        AND e.enabled = true
        AND e.valid_from <= now()
        AND (e.valid_until IS NULL OR e.valid_until > now())
    ORDER BY e.created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF v_entitlement_id IS NULL THEN
        RETURN QUERY SELECT FALSE, 0, 0;
        RETURN;
    END IF;

    -- Update quantity used
    UPDATE billing.feature_entitlements
    SET quantity_used = v_new_used
    WHERE id = v_entitlement_id;

    RETURN QUERY SELECT
        TRUE,
        v_new_used,
        GREATEST(0, v_quantity_limit - v_new_used);
END;
$function$
;

CREATE OR REPLACE FUNCTION billing.spend_credits_atomic(p_account_id uuid, p_amount integer, p_soft_limit integer, p_hard_limit integer, p_idempotency_key text, p_usage_event_id uuid DEFAULT NULL::uuid, p_feature_source text DEFAULT NULL::text, p_metadata jsonb DEFAULT NULL::jsonb)
 RETURNS TABLE(success boolean, new_balance integer, limit_status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_current_balance INTEGER;
    v_new_balance INTEGER;
    v_status TEXT;
    v_inserted BOOLEAN;
BEGIN
    -- Lock account row to prevent concurrent spends
    PERFORM 1 FROM accounts.accounts WHERE id = p_account_id FOR UPDATE;

    -- Calculate current balance (only non-expired credits)
    SELECT COALESCE(SUM(
        CASE
            WHEN event_type IN ('grant', 'purchase', 'refund') THEN amount
            WHEN event_type IN ('spend', 'expire') THEN -amount
            ELSE 0
        END
    ), 0) INTO v_current_balance
    FROM billing.credit_ledger
    WHERE account_id = p_account_id
        AND (expires_at IS NULL OR expires_at > now());

    v_new_balance := v_current_balance - p_amount;

    -- Check hard limit (only for free tier typically)
    IF p_hard_limit > 0 AND v_new_balance < -p_hard_limit THEN
        v_status := 'hard_limit_exceeded';
        RETURN QUERY SELECT FALSE, v_current_balance, v_status;
        RETURN;
    END IF;

    -- Insert spend event (idempotent via ON CONFLICT)
    INSERT INTO billing.credit_ledger (
        account_id,
        event_type,
        amount,
        idempotency_key,
        usage_event_id,
        feature_source,
        metadata
    ) VALUES (
        p_account_id,
        'spend',
        p_amount,
        p_idempotency_key,
        p_usage_event_id,
        p_feature_source,
        p_metadata
    ) ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING TRUE INTO v_inserted;

    -- If this was a duplicate, return current state without error
    IF v_inserted IS NULL THEN
        v_status := 'duplicate_ignored';
        RETURN QUERY SELECT TRUE, v_current_balance, v_status;
        RETURN;
    END IF;

    -- Determine status based on soft cap
    IF p_soft_limit > 0 THEN
        IF v_new_balance < -p_soft_limit * 0.2 THEN  -- 120% of limit
            v_status := 'soft_cap_exceeded';
        ELSIF v_new_balance < 0 THEN  -- 100% of limit
            v_status := 'soft_cap_warning';
        ELSIF v_current_balance - p_amount < p_soft_limit * 0.2 THEN  -- 80% threshold
            v_status := 'approaching_limit';
        ELSE
            v_status := 'ok';
        END IF;
    ELSE
        v_status := 'ok';
    END IF;

    RETURN QUERY SELECT TRUE, v_new_balance, v_status;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.accept_invitation(lookup_invitation_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'accounts'
AS $function$
declare
    lookup_account_id       uuid;
    declare new_member_role accounts.account_role;
    lookup_account_slug     text;
begin
    select i.account_id, i.account_role, a.slug
    into lookup_account_id, new_member_role, lookup_account_slug
    from accounts.invitations i
             join accounts.accounts a on a.id = i.account_id
    where i.token = lookup_invitation_token
      and i.created_at > now() - interval '14 days';

    if lookup_account_id IS NULL then
        raise exception 'Invitation not found';
    end if;

    if lookup_account_id is not null then
        -- we've validated the token is real, so grant the user access
        insert into accounts.account_user (account_id, user_id, account_role)
        values (lookup_account_id, auth.uid(), new_member_role);
        -- email types of invitations are only good for one usage
        delete from accounts.invitations where token = lookup_invitation_token and invitation_type = 'one_time';
    end if;
    return json_build_object('account_id', lookup_account_id, 'account_role', new_member_role, 'slug',
                             lookup_account_slug);
EXCEPTION
    WHEN unique_violation THEN
        raise exception 'You are already a member of this account';
end;
$function$
;

CREATE OR REPLACE FUNCTION public.auto_link_persona_insights(p_insight_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    persona_record RECORD;
    relevance_score_var DECIMAL(3,2);
BEGIN
    -- Find personas for people involved in interviews that have evidence linked to this theme
    -- Themes don't have interview_id - they're linked via theme_evidence -> evidence -> interview
    FOR persona_record IN
        SELECT DISTINCT pp.persona_id, p.name as persona
        FROM themes t
        -- Link through theme_evidence junction to get to interviews
        JOIN theme_evidence te ON t.id = te.theme_id
        JOIN evidence e ON te.evidence_id = e.id
        JOIN interviews iv ON e.interview_id = iv.id
        JOIN interview_people ip ON iv.id = ip.interview_id
        JOIN people pe ON ip.person_id = pe.id
        JOIN people_personas pp ON pe.id = pp.person_id
        JOIN personas p ON pp.persona_id = p.id AND pe.account_id = p.account_id
        WHERE t.id = p_insight_id
        AND pp.persona_id IS NOT NULL
    LOOP
        -- Calculate relevance score (simplified - could be more sophisticated)
        relevance_score_var := 1.0;

        -- Insert persona-insight link
        INSERT INTO persona_insights (persona_id, insight_id, relevance_score, created_at)
        VALUES (persona_record.persona_id, p_insight_id, relevance_score_var, NOW())
        ON CONFLICT (persona_id, insight_id) DO NOTHING;
    END LOOP;
END;
$function$
;

create or replace view "public"."conversations" as  SELECT id,
    account_id,
    project_id,
    title,
    interview_date,
    interviewer_id,
    key_takeaways,
    participant_pseudonym,
    segment,
    media_url,
    thumbnail_url,
    media_type,
    transcript,
    transcript_formatted,
    conversation_analysis,
    high_impact_themes,
    relevant_answers,
    open_questions_and_next_steps,
    observations_and_notes,
    source_type,
    source_url,
    interview_type,
    lens_visibility,
    file_extension,
    original_filename,
    person_id,
    duration_sec,
    status,
    interaction_context,
    context_confidence,
    context_reasoning,
    processing_metadata,
    speaker_review_needed,
    draft_responses,
    research_link_id,
    created_at,
    updated_at,
    created_by,
    updated_by
   FROM public.interviews;


CREATE OR REPLACE FUNCTION public.get_account(account_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'accounts', 'public'
AS $function$
declare
    user_id uuid;
    user_role text;
begin
    -- Get the current user's id from the JWT/session
    user_id := auth.uid();

    -- Check if the user is a member of the account
    select au.account_role into user_role
    from accounts.account_user au
    where au.account_id = get_account.account_id and au.user_id = auth.uid()
    limit 1;

    if user_role is null then
        raise exception 'You must be a member of an account to access it';
    end if;

    -- Return the account data
    return (
        select json_build_object(
            'account_id', a.id,
            'account_role', user_role,
            'is_primary_owner', a.primary_owner_user_id = auth.uid(),
            'name', a.name,
            'slug', a.slug,
            'personal_account', a.personal_account,
            'billing_enabled', case
                when a.personal_account = true then config.enable_personal_account_billing
                else config.enable_team_account_billing
            end,
            'billing_status', bs.status,
            'created_at', a.created_at,
            'updated_at', a.updated_at,
            'metadata', a.public_metadata
        )
        from accounts.accounts a
        join accounts.config config on true
        left join (
            select bs.account_id, bs.status
            from accounts.billing_subscriptions bs
            where bs.account_id = get_account.account_id
            order by bs.created_at desc
            limit 1
        ) bs on bs.account_id = a.id
        where a.id = get_account.account_id
    );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_account_billing_status(account_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'accounts'
AS $function$
DECLARE
    result      jsonb;
    role_result jsonb;
BEGIN
    select public.current_user_account_role(get_account_billing_status.account_id) into role_result;

    select jsonb_build_object(
                   'account_id', get_account_billing_status.account_id,
                   'billing_subscription_id', s.id,
                   'billing_enabled', case
                                          when a.personal_account = true then config.enable_personal_account_billing
                                          else config.enable_team_account_billing end,
                   'billing_status', s.status,
                   'billing_customer_id', c.id,
                   'billing_provider', config.billing_provider,
                   'billing_email',
                   coalesce(c.email, u.email) -- if we don't have a customer email, use the user's email as a fallback
               )
    into result
    from accounts.accounts a
             join auth.users u on u.id = a.primary_owner_user_id
             left join accounts.billing_subscriptions s on s.account_id = a.id
             left join accounts.billing_customers c on c.account_id = coalesce(s.account_id, a.id)
             join accounts.config config on true
    where a.id = get_account_billing_status.account_id
    order by s.created_at desc
    limit 1;

    return result || role_result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_account_invitations(account_id uuid, results_limit integer DEFAULT 25, results_offset integer DEFAULT 0)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'accounts'
AS $function$
DECLARE
    user_role text;
BEGIN
    -- Check that the current user is a member of this account (any role)
    user_role := (select public.current_user_account_role(get_account_invitations.account_id) ->> 'account_role');

    if user_role is null then
        raise exception 'You are not a member of this account';
    end if;

    return (select json_agg(
                           json_build_object(
                                   'account_role', i.account_role,
                                   'created_at', i.created_at,
                                   'invitation_type', i.invitation_type,
                                   'invitation_id', i.id,
                                   'email', i.invitee_email
                               )
                       )
            from accounts.invitations i
            where i.account_id = get_account_invitations.account_id
              and i.created_at > now() - interval '30 days'
            limit coalesce(get_account_invitations.results_limit, 25) offset coalesce(get_account_invitations.results_offset, 0));
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_campaign_recommendations(p_account_id uuid, p_project_id uuid, p_strategy text, p_limit integer DEFAULT 10)
 RETURNS TABLE(person_id uuid, person_name text, person_email text, person_title text, icp_score numeric, evidence_count bigint, recommendation_score numeric, recommendation_reason text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
begin
  -- Strategy: sparse_data_discovery (people with little evidence)
  if p_strategy = 'sparse_data_discovery' then
    return query
    select
      p.id as person_id,
      coalesce(p.firstname || ' ' || p.lastname, p.firstname, 'Unknown') as person_name,
      p.primary_email as person_email,
      p.title as person_title,
      coalesce(ps.score, 0) as icp_score,
      count(ep.evidence_id)::bigint as evidence_count,
      -- Score: High ICP + Low evidence = High priority
      (coalesce(ps.score, 0) * 100 - count(ep.evidence_id)::numeric) as recommendation_score,
      case
        when count(ep.evidence_id) = 0 then 'No evidence yet - great for discovery'
        when count(ep.evidence_id) < 3 then 'Minimal evidence (' || count(ep.evidence_id) || ' pieces) - good for follow-up'
        else 'Some evidence but gaps remain'
      end as recommendation_reason
    from public.people p
    left join public.person_scale ps on ps.person_id = p.id and ps.kind_slug = 'icp_match'
    left join public.evidence_people ep on ep.person_id = p.id
    where
      p.account_id = p_account_id
      and (p.project_id = p_project_id or p_project_id is null)
      and p.primary_email is not null
    group by p.id, p.firstname, p.lastname, p.primary_email, p.title, ps.score
    order by recommendation_score desc
    limit p_limit;

  -- Strategy: pricing_validation (high ICP people good for pricing feedback)
  elsif p_strategy = 'pricing_validation' then
    return query
    select
      p.id as person_id,
      coalesce(p.firstname || ' ' || p.lastname, p.firstname, 'Unknown') as person_name,
      p.primary_email as person_email,
      p.title as person_title,
      coalesce(ps.score, 0) as icp_score,
      count(ep.evidence_id)::bigint as evidence_count,
      -- Score: High ICP = High priority (evidence count secondary)
      (coalesce(ps.score, 0) * 100) as recommendation_score,
      case
        when coalesce(ps.score, 0) >= 0.7 then 'Strong ICP match - valuable for pricing validation'
        when coalesce(ps.score, 0) >= 0.5 then 'Moderate ICP match - useful for pricing feedback'
        else 'Weak ICP match - consider for broader perspective'
      end as recommendation_reason
    from public.people p
    left join public.person_scale ps on ps.person_id = p.id and ps.kind_slug = 'icp_match'
    left join public.evidence_people ep on ep.person_id = p.id
    where
      p.account_id = p_account_id
      and (p.project_id = p_project_id or p_project_id is null)
      and p.primary_email is not null
    group by p.id, p.firstname, p.lastname, p.primary_email, p.title, ps.score
    having coalesce(ps.score, 0) >= 0.5 -- Only recommend moderate+ ICP matches for pricing
    order by recommendation_score desc
    limit p_limit;

  -- Default: general_research (balanced approach)
  else
    return query
    select
      p.id as person_id,
      coalesce(p.firstname || ' ' || p.lastname, p.firstname, 'Unknown') as person_name,
      p.primary_email as person_email,
      p.title as person_title,
      coalesce(ps.score, 0) as icp_score,
      count(ep.evidence_id)::bigint as evidence_count,
      -- Balanced score
      (coalesce(ps.score, 0) * 50 + (10 - least(count(ep.evidence_id)::numeric, 10)) * 5) as recommendation_score,
      'Balanced candidate for general research' as recommendation_reason
    from public.people p
    left join public.person_scale ps on ps.person_id = p.id and ps.kind_slug = 'icp_match'
    left join public.evidence_people ep on ep.person_id = p.id
    where
      p.account_id = p_account_id
      and (p.project_id = p_project_id or p_project_id is null)
      and p.primary_email is not null
    group by p.id, p.firstname, p.lastname, p.primary_email, p.title, ps.score
    order by recommendation_score desc
    limit p_limit;
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_campaign_stats(p_research_link_id uuid)
 RETURNS TABLE(total_sent bigint, total_opened bigint, total_completed bigint, completion_rate numeric, avg_evidence_per_response numeric, total_evidence_extracted bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
begin
  return query
  select
    count(*) filter (where ps.status in ('sent', 'opened', 'completed'))::bigint as total_sent,
    count(*) filter (where ps.status in ('opened', 'completed'))::bigint as total_opened,
    count(*) filter (where ps.status = 'completed')::bigint as total_completed,
    case
      when count(*) filter (where ps.status in ('sent', 'opened', 'completed')) > 0
      then round(
        (count(*) filter (where ps.status = 'completed')::numeric /
         count(*) filter (where ps.status in ('sent', 'opened', 'completed'))::numeric) * 100,
        1
      )
      else 0
    end as completion_rate,
    coalesce(avg(ps.evidence_count) filter (where ps.evidence_extracted = true), 0) as avg_evidence_per_response,
    coalesce(sum(ps.evidence_count) filter (where ps.evidence_extracted = true), 0)::bigint as total_evidence_extracted
  from public.personalized_surveys ps
  where ps.research_link_id = p_research_link_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.list_invitations_for_current_user()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'accounts'
AS $function$
DECLARE
  current_email text;
BEGIN
  -- Determine current user's email
  SELECT email INTO current_email FROM auth.users WHERE id = auth.uid();
  IF current_email IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN (
    SELECT COALESCE(
      json_agg(
        json_build_object(
          'account_id', i.account_id,
          'account_name', i.account_name,
          'account_role', i.account_role,
          'invitation_type', i.invitation_type,
          'created_at', i.created_at,
          'token', i.token
        )
        ORDER BY i.created_at DESC
      ), '[]'::json
    )
    FROM accounts.invitations i
    WHERE i.invitee_email IS NOT NULL
      AND lower(i.invitee_email) = lower(current_email)
      AND i.created_at > now() - interval '30 days'
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.lookup_invitation(lookup_invitation_token text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'accounts'
AS $function$
declare
    invitation_record RECORD;
begin
    select
        account_id,
        account_name,
        account_role,
        invited_by_user_id,
        case when id IS NOT NULL then true else false end as active
    into invitation_record
    from accounts.invitations
    where token = lookup_invitation_token
      and created_at > now() - interval '14 days'
    limit 1;
    return json_build_object(
        'active', coalesce(invitation_record.active, false),
        'account_name', invitation_record.account_name,
        'account_id', invitation_record.account_id,
        'account_role', invitation_record.account_role,
        'inviter_user_id', invitation_record.invited_by_user_id
    );
end;
$function$
;

create or replace view "public"."persona_distribution" as  WITH persona_interview_counts AS (
         SELECT p.id AS persona_id,
            p.account_id,
            p.name AS persona_name,
            p.color_hex,
            p.description,
            p.created_at,
            p.updated_at,
            count(DISTINCT i.id) AS interview_count,
            ( SELECT count(DISTINCT i_total.id) AS count
                   FROM (public.interviews i_total
                     JOIN public.interview_people ip_total ON ((ip_total.interview_id = i_total.id)))
                  WHERE (i_total.account_id = p.account_id)) AS total_interviews_with_participants
           FROM (((public.personas p
             LEFT JOIN public.people_personas pp ON ((pp.persona_id = p.id)))
             LEFT JOIN public.interview_people ip ON ((ip.person_id = pp.person_id)))
             LEFT JOIN public.interviews i ON (((i.id = ip.interview_id) AND (i.account_id = p.account_id))))
          GROUP BY p.id, p.account_id, p.name, p.color_hex, p.description, p.created_at, p.updated_at
        ), legacy_fallback_counts AS (
         SELECT p.id AS persona_id,
            count(DISTINCT i_legacy.id) AS legacy_interview_count,
            ( SELECT count(DISTINCT i_total.id) AS count
                   FROM public.interviews i_total
                  WHERE ((i_total.account_id = p.account_id) AND ((i_total.participant_pseudonym IS NOT NULL) OR (i_total.segment IS NOT NULL)) AND (NOT (EXISTS ( SELECT 1
                           FROM public.interview_people ip_check
                          WHERE (ip_check.interview_id = i_total.id)))))) AS total_legacy_interviews
           FROM (public.personas p
             LEFT JOIN public.interviews i_legacy ON (((i_legacy.account_id = p.account_id) AND ((i_legacy.participant_pseudonym = p.name) OR (i_legacy.segment = p.name)) AND (NOT (EXISTS ( SELECT 1
                   FROM public.interview_people ip_check
                  WHERE (ip_check.interview_id = i_legacy.id)))))))
          GROUP BY p.id, p.account_id
        )
 SELECT pic.persona_id,
    pic.account_id,
    pic.persona_name,
    pic.color_hex,
    pic.description,
    pic.created_at,
    pic.updated_at,
    pic.interview_count,
    pic.total_interviews_with_participants,
        CASE
            WHEN (pic.total_interviews_with_participants > 0) THEN round((((pic.interview_count)::numeric / (pic.total_interviews_with_participants)::numeric) * (100)::numeric), 1)
            ELSE (0)::numeric
        END AS interview_percentage,
    lfc.legacy_interview_count,
    lfc.total_legacy_interviews,
        CASE
            WHEN (lfc.total_legacy_interviews > 0) THEN round((((lfc.legacy_interview_count)::numeric / (lfc.total_legacy_interviews)::numeric) * (100)::numeric), 1)
            ELSE (0)::numeric
        END AS legacy_percentage,
    (pic.interview_count + lfc.legacy_interview_count) AS total_interview_count,
    (pic.total_interviews_with_participants + lfc.total_legacy_interviews) AS total_interviews,
        CASE
            WHEN ((pic.total_interviews_with_participants + lfc.total_legacy_interviews) > 0) THEN round(((((pic.interview_count + lfc.legacy_interview_count))::numeric / ((pic.total_interviews_with_participants + lfc.total_legacy_interviews))::numeric) * (100)::numeric), 1)
            ELSE (0)::numeric
        END AS combined_percentage
   FROM (persona_interview_counts pic
     JOIN legacy_fallback_counts lfc ON ((pic.persona_id = lfc.persona_id)))
  ORDER BY pic.account_id, (pic.interview_count + lfc.legacy_interview_count) DESC;


create or replace view "public"."project_answer_metrics" as  SELECT pa.project_id,
    pa.id AS project_answer_id,
    pa.prompt_id,
    pa.research_question_id,
    pa.decision_question_id,
    pa.interview_id,
    pa.respondent_person_id,
    pa.status,
    pa.answered_at,
    COALESCE(count(e.id), (0)::bigint) AS evidence_count,
    COALESCE(count(DISTINCT COALESCE(e.interview_id, pa.interview_id)), (0)::bigint) AS interview_count,
    COALESCE(count(DISTINCT pp.persona_id), (0)::bigint) AS persona_count
   FROM ((public.project_answers pa
     LEFT JOIN public.evidence e ON ((e.project_answer_id = pa.id)))
     LEFT JOIN public.people_personas pp ON (((pp.person_id = pa.respondent_person_id) AND (pp.project_id = pa.project_id))))
  GROUP BY pa.project_id, pa.id, pa.prompt_id, pa.research_question_id, pa.decision_question_id, pa.interview_id, pa.respondent_person_id, pa.status, pa.answered_at;


create or replace view "public"."research_question_summary" as  SELECT rq.project_id,
    rq.id AS research_question_id,
    rq.decision_question_id,
    rq.text AS research_question_text,
    COALESCE(count(DISTINCT pa.id) FILTER (WHERE (pa.status = ANY (ARRAY['answered'::text, 'ad_hoc'::text]))), (0)::bigint) AS answered_answer_count,
    COALESCE(count(DISTINCT pa.id) FILTER (WHERE (pa.status = ANY (ARRAY['planned'::text, 'asked'::text]))), (0)::bigint) AS open_answer_count,
    COALESCE(sum(m.evidence_count), (0)::numeric) AS evidence_count,
    COALESCE(count(DISTINCT pa.interview_id), (0)::bigint) AS interview_count,
    COALESCE(count(DISTINCT pp.persona_id), (0)::bigint) AS persona_count
   FROM (((public.research_questions rq
     LEFT JOIN public.project_answers pa ON ((pa.research_question_id = rq.id)))
     LEFT JOIN public.project_answer_metrics m ON ((m.project_answer_id = pa.id)))
     LEFT JOIN public.people_personas pp ON (((pp.person_id = pa.respondent_person_id) AND (pp.project_id = rq.project_id))))
  GROUP BY rq.project_id, rq.id, rq.decision_question_id, rq.text;


CREATE OR REPLACE FUNCTION public.service_role_upsert_customer_subscription(account_id uuid, customer jsonb DEFAULT NULL::jsonb, subscription jsonb DEFAULT NULL::jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- if the customer is not null, upsert the data into billing_customers, only upsert fields that are present in the jsonb object
    if customer is not null then
        insert into accounts.billing_customers (id, account_id, email, provider)
        values (customer ->> 'id', service_role_upsert_customer_subscription.account_id, customer ->> 'billing_email',
                (customer ->> 'provider'))
        on conflict (id) do update
            set email = customer ->> 'billing_email';
    end if;

    -- if the subscription is not null, upsert the data into billing_subscriptions, only upsert fields that are present in the jsonb object
    if subscription is not null then
        insert into accounts.billing_subscriptions (id, account_id, billing_customer_id, status, metadata, price_id,
                                                    quantity, cancel_at_period_end, created_at, current_period_start,
                                                    current_period_end, ended_at, cancel_at, canceled_at, trial_start,
                                                    trial_end, plan_name, provider)
        values (subscription ->> 'id', service_role_upsert_customer_subscription.account_id,
                subscription ->> 'billing_customer_id', (subscription ->> 'status')::accounts.subscription_status,
                subscription -> 'metadata',
                subscription ->> 'price_id', (subscription ->> 'quantity')::int,
                (subscription ->> 'cancel_at_period_end')::boolean,
                (subscription ->> 'created_at')::timestamptz, (subscription ->> 'current_period_start')::timestamptz,
                (subscription ->> 'current_period_end')::timestamptz, (subscription ->> 'ended_at')::timestamptz,
                (subscription ->> 'cancel_at')::timestamptz,
                (subscription ->> 'canceled_at')::timestamptz, (subscription ->> 'trial_start')::timestamptz,
                (subscription ->> 'trial_end')::timestamptz,
                subscription ->> 'plan_name', (subscription ->> 'provider'))
        on conflict (id) do update
            set billing_customer_id  = subscription ->> 'billing_customer_id',
                status               = (subscription ->> 'status')::accounts.subscription_status,
                metadata             = subscription -> 'metadata',
                price_id             = subscription ->> 'price_id',
                quantity             = (subscription ->> 'quantity')::int,
                cancel_at_period_end = (subscription ->> 'cancel_at_period_end')::boolean,
                current_period_start = (subscription ->> 'current_period_start')::timestamptz,
                current_period_end   = (subscription ->> 'current_period_end')::timestamptz,
                ended_at             = (subscription ->> 'ended_at')::timestamptz,
                cancel_at            = (subscription ->> 'cancel_at')::timestamptz,
                canceled_at          = (subscription ->> 'canceled_at')::timestamptz,
                trial_start          = (subscription ->> 'trial_start')::timestamptz,
                trial_end            = (subscription ->> 'trial_end')::timestamptz,
                plan_name            = subscription ->> 'plan_name';
    end if;
end;
$function$
;

create or replace view "public"."decision_question_summary" as  SELECT dq.project_id,
    dq.id AS decision_question_id,
    dq.text AS decision_question_text,
    COALESCE(count(DISTINCT rq.id), (0)::bigint) AS research_question_count,
    COALESCE(count(DISTINCT pa.id) FILTER (WHERE (pa.status = ANY (ARRAY['answered'::text, 'ad_hoc'::text]))), (0)::bigint) AS answered_answer_count,
    COALESCE(count(DISTINCT pa.id) FILTER (WHERE (pa.status = ANY (ARRAY['planned'::text, 'asked'::text]))), (0)::bigint) AS open_answer_count,
    COALESCE(sum(m.evidence_count), (0)::numeric) AS evidence_count,
    COALESCE(count(DISTINCT pa.interview_id), (0)::bigint) AS interview_count,
    COALESCE(count(DISTINCT pp.persona_id), (0)::bigint) AS persona_count
   FROM ((((public.decision_questions dq
     LEFT JOIN public.research_questions rq ON ((rq.decision_question_id = dq.id)))
     LEFT JOIN public.project_answers pa ON ((pa.decision_question_id = dq.id)))
     LEFT JOIN public.project_answer_metrics m ON ((m.project_answer_id = pa.id)))
     LEFT JOIN public.people_personas pp ON (((pp.person_id = pa.respondent_person_id) AND (pp.project_id = dq.project_id))))
  GROUP BY dq.project_id, dq.id, dq.text;


grant delete on table "public"."project_api_keys" to "anon";

grant insert on table "public"."project_api_keys" to "anon";

grant references on table "public"."project_api_keys" to "anon";

grant select on table "public"."project_api_keys" to "anon";

grant trigger on table "public"."project_api_keys" to "anon";

grant truncate on table "public"."project_api_keys" to "anon";

grant update on table "public"."project_api_keys" to "anon";

grant delete on table "public"."project_api_keys" to "authenticated";

grant insert on table "public"."project_api_keys" to "authenticated";

grant references on table "public"."project_api_keys" to "authenticated";

grant select on table "public"."project_api_keys" to "authenticated";

grant trigger on table "public"."project_api_keys" to "authenticated";

grant truncate on table "public"."project_api_keys" to "authenticated";

grant update on table "public"."project_api_keys" to "authenticated";

grant delete on table "public"."project_api_keys" to "service_role";

grant insert on table "public"."project_api_keys" to "service_role";

grant references on table "public"."project_api_keys" to "service_role";

grant select on table "public"."project_api_keys" to "service_role";

grant trigger on table "public"."project_api_keys" to "service_role";

grant truncate on table "public"."project_api_keys" to "service_role";

grant update on table "public"."project_api_keys" to "service_role";

grant delete on table "public"."project_snapshots" to "anon";

grant insert on table "public"."project_snapshots" to "anon";

grant references on table "public"."project_snapshots" to "anon";

grant select on table "public"."project_snapshots" to "anon";

grant trigger on table "public"."project_snapshots" to "anon";

grant truncate on table "public"."project_snapshots" to "anon";

grant update on table "public"."project_snapshots" to "anon";

grant delete on table "public"."project_snapshots" to "authenticated";

grant insert on table "public"."project_snapshots" to "authenticated";

grant references on table "public"."project_snapshots" to "authenticated";

grant select on table "public"."project_snapshots" to "authenticated";

grant trigger on table "public"."project_snapshots" to "authenticated";

grant truncate on table "public"."project_snapshots" to "authenticated";

grant update on table "public"."project_snapshots" to "authenticated";

grant delete on table "public"."project_snapshots" to "service_role";

grant insert on table "public"."project_snapshots" to "service_role";

grant references on table "public"."project_snapshots" to "service_role";

grant select on table "public"."project_snapshots" to "service_role";

grant trigger on table "public"."project_snapshots" to "service_role";

grant truncate on table "public"."project_snapshots" to "service_role";

grant update on table "public"."project_snapshots" to "service_role";


  create policy "Users can view their project snapshots"
  on "public"."project_snapshots"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM accounts.account_user
  WHERE ((account_user.account_id = project_snapshots.account_id) AND (account_user.user_id = auth.uid())))));



  create policy "Members can read research link responses"
  on "public"."research_link_responses"
  as permissive
  for select
  to public
using ((research_link_id IN ( SELECT research_links.id
   FROM public.research_links
  WHERE (research_links.account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)))));



