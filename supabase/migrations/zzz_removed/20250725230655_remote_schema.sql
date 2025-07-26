create extension if not exists "pg_net" with schema "public" version '0.14.0';

alter table "public"."insight_tags" drop constraint "insight_tags_tag_fkey";

alter table "public"."interview_tags" drop constraint "interview_tags_tag_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.link_insight_to_personas(p_insight_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    -- This function is a wrapper around auto_link_persona_insights
    -- It exists for backward compatibility with tests and manual operations
    PERFORM auto_link_persona_insights(p_insight_id);
END;
$function$
;


