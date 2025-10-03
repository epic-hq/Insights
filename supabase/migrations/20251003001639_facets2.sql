alter table "public"."person_scale" drop constraint "person_scale_source_check";

drop function if exists "public"."list_invitations_for_current_user"();

alter table "public"."people" drop column if exists "behavior";

alter table "public"."people" drop column if exists "feedback";

alter table "public"."people" drop column if exists "goals";

alter table "public"."person_scale" add constraint "person_scale_source_check" CHECK ((source = ANY (ARRAY['interview'::text, 'survey'::text, 'telemetry'::text, 'inferred'::text, 'manual'::text]))) not valid;

alter table "public"."person_scale" validate constraint "person_scale_source_check";
