create type "public"."interview_status" as enum ('draft', 'scheduled', 'uploaded', 'transcribed', 'processing', 'ready', 'tagged', 'archived');

alter table "public"."interviews" drop constraint "interviews_status_check";

alter table "public"."interviews" alter column "status" set default 'draft'::interview_status;

alter table "public"."interviews" alter column "status" set data type interview_status using "status"::interview_status;


