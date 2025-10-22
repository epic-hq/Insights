alter table "public"."analysis_jobs" add column "trigger_run_id" text;

alter table "public"."user_settings" add column "company_description" text;

alter table "public"."user_settings" add column "company_website" text;

CREATE INDEX idx_analysis_jobs_trigger_run ON public.analysis_jobs USING btree (trigger_run_id);


