alter table "public"."interview_prompts" drop constraint "interview_prompts_status_check";

alter table "public"."user_settings" add column "company_description" text;

alter table "public"."user_settings" add column "company_website" text;

alter table "public"."interview_prompts" add constraint "interview_prompts_status_check" CHECK ((status = ANY (ARRAY['proposed'::text, 'asked'::text, 'answered'::text, 'skipped'::text, 'rejected'::text]))) not valid;

alter table "public"."interview_prompts" validate constraint "interview_prompts_status_check";