-- Add AI autonomy setting and research goals to research_links
-- Enables tiered AI interview behavior: strict (follows script), moderate (light follow-ups), adaptive (full CRM-powered)

-- Add the column first (without constraint)
ALTER TABLE public.research_links
ADD COLUMN IF NOT EXISTS ai_autonomy TEXT NOT NULL DEFAULT 'strict';

-- Add the check constraint separately
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'research_links_ai_autonomy_check'
  ) THEN
    ALTER TABLE public.research_links
    ADD CONSTRAINT research_links_ai_autonomy_check
    CHECK (ai_autonomy IN ('strict', 'moderate', 'adaptive'));
  END IF;
END $$;

-- Add research_goals column for future use
ALTER TABLE public.research_links
ADD COLUMN IF NOT EXISTS research_goals JSONB DEFAULT NULL;

COMMENT ON COLUMN public.research_links.ai_autonomy IS 'Controls AI interview behavior in chat mode. strict=follows questions exactly, moderate=can ask brief follow-ups, adaptive=full CRM-powered dynamic questioning (gated feature)';

COMMENT ON COLUMN public.research_links.research_goals IS 'Research objectives and constraints for AI interviewing. Structure: { objectives: string[], mustAskQuestionIds: string[], probeTopics: string[], avoidTopics: string[] }';
