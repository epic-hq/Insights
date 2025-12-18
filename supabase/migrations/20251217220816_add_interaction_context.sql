-- Add interaction_context enum and columns to interviews table
-- Determines which lenses to apply based on LLM-classified content type

create type "public"."interaction_context" as enum ('research', 'sales', 'support', 'internal', 'personal');

-- Guard: ensure key_takeaways exists in environments created before it was added
alter table "public"."interviews" add column if not exists "key_takeaways" text;

alter table "public"."interviews" add column "interaction_context" public.interaction_context;
alter table "public"."interviews" add column "context_confidence" real;
alter table "public"."interviews" add column "context_reasoning" text;

CREATE INDEX idx_interviews_interaction_context ON public.interviews USING btree (interaction_context);

-- Update the conversations view to include new columns
drop view if exists "public"."conversations";

create or replace view "public"."conversations" as
SELECT id,
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
    created_at,
    updated_at,
    created_by,
    updated_by
FROM public.interviews;
