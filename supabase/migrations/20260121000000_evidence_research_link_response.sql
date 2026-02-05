-- Add research_link_response_id FK to evidence table
-- Enables survey text responses to create evidence records for theme clustering

-- Add nullable FK to research_link_responses
ALTER TABLE public.evidence
ADD COLUMN IF NOT EXISTS research_link_response_id uuid
REFERENCES public.research_link_responses(id) ON DELETE CASCADE;

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_evidence_research_link_response_id
ON public.evidence(research_link_response_id)
WHERE research_link_response_id IS NOT NULL;

-- Add 'survey' to method enum if not present
DO $$
BEGIN
  -- Check if 'survey' is already in the constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'evidence_method_check'
    AND pg_get_constraintdef(oid) LIKE '%survey%'
  ) THEN
    -- Drop old constraint and recreate with 'survey'
    ALTER TABLE public.evidence DROP CONSTRAINT IF EXISTS evidence_method_check;
    ALTER TABLE public.evidence ADD CONSTRAINT evidence_method_check
    CHECK (method IN (
      'interview','usability','survey','telemetry','market_report','support_ticket','benchmark','other'
    ));
  END IF;
END$$;

-- Comment explaining the new column
COMMENT ON COLUMN public.evidence.research_link_response_id IS
'Source survey response if applicable. Either interview_id OR research_link_response_id should be set, not both.';
