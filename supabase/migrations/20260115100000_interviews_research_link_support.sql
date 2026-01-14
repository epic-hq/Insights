-- Unified Conversation Architecture: Phase 1
-- Links interviews table to research_links for Ask link responses
-- Enables survey responses to flow through the standard interview analysis pipeline

-- Add FK to research_links (null for non-Ask interviews)
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

-- Update source_type documentation to include survey types
COMMENT ON COLUMN public.interviews.source_type IS
  'Source of the content. Values: realtime_recording | audio_upload | video_upload | document_upload | transcript_paste | transcript_import | survey_form | survey_chat | survey_voice';

-- Update draft surveys index to use new source_type values
DROP INDEX IF EXISTS idx_interviews_draft_surveys;
CREATE INDEX IF NOT EXISTS idx_interviews_draft_surveys
  ON public.interviews(project_id, status, source_type)
  WHERE status = 'draft' AND source_type IN ('survey_form', 'survey_chat', 'survey_voice');
