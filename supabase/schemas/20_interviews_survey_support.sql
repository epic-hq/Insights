-- Survey Support for Interviews
-- Enables interviews table to store in-progress survey responses
-- Part of unified conversation architecture where all responses flow through interviews

-- Add draft_responses for in-progress survey answers (saved in real-time)
ALTER TABLE public.interviews ADD COLUMN IF NOT EXISTS
  draft_responses jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.interviews.draft_responses IS
  'In-progress survey/chat answers saved in real-time. Cleared when finalized to transcript_formatted. Structure: { "question_id": "answer_text", ... }';

-- Extended source_type values (documented, not enforced by enum)
-- Existing: realtime_recording, audio_upload, video_upload, document_upload, transcript_paste, transcript_import
-- New: survey_form, survey_chat, survey_voice (replacing generic survey_response/public_chat)
COMMENT ON COLUMN public.interviews.source_type IS
  'Source of the content. Values: realtime_recording | audio_upload | video_upload | document_upload | transcript_paste | transcript_import | survey_form | survey_chat | survey_voice';

-- Link to Ask link configuration (null for non-Ask interviews)
-- Enables unified view while preserving Ask-specific context
ALTER TABLE public.interviews ADD COLUMN IF NOT EXISTS
  research_link_id uuid REFERENCES public.research_links(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.interviews.research_link_id IS
  'FK to research_links for Ask link responses. Null for traditional interviews/uploads.';

-- Ensure one response per person per Ask link (prevents duplicates)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_interviews_research_link_person
  ON public.interviews(research_link_id, person_id)
  WHERE research_link_id IS NOT NULL AND person_id IS NOT NULL;

-- Index for finding Ask responses efficiently
CREATE INDEX IF NOT EXISTS idx_interviews_research_link_id
  ON public.interviews(research_link_id)
  WHERE research_link_id IS NOT NULL;

-- Index for finding draft (in-progress) surveys
CREATE INDEX IF NOT EXISTS idx_interviews_draft_surveys
  ON public.interviews(project_id, status, source_type)
  WHERE status = 'draft' AND source_type IN ('survey_form', 'survey_chat', 'survey_voice');

-- Helper function to convert draft_responses to transcript_formatted
-- Called when survey is completed
CREATE OR REPLACE FUNCTION public.finalize_survey_response(
  p_interview_id uuid,
  p_prompts jsonb -- Array of { id, text } for the interview_prompts used
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

COMMENT ON FUNCTION public.finalize_survey_response IS
  'Converts draft_responses to transcript_formatted when a survey is completed. Triggers analysis pipeline by setting status to uploaded.';
