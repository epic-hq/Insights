-- Add AI autonomy setting and research goals to research_links
-- Enables tiered AI interview behavior: strict (follows script), moderate (light follow-ups), adaptive (full CRM-powered)

ALTER TABLE public.research_links
ADD COLUMN IF NOT EXISTS ai_autonomy TEXT NOT NULL DEFAULT 'strict'
CHECK (ai_autonomy IN ('strict', 'moderate', 'adaptive'));

ALTER TABLE public.research_links
ADD COLUMN IF NOT EXISTS research_goals JSONB DEFAULT NULL;

COMMENT ON COLUMN public.research_links.ai_autonomy IS 'Controls AI interview behavior in chat mode. strict=follows questions exactly, moderate=can ask brief follow-ups, adaptive=full CRM-powered dynamic questioning (gated feature)';

COMMENT ON COLUMN public.research_links.research_goals IS 'Research objectives and constraints for AI interviewing. Structure: { objectives: string[], mustAskQuestionIds: string[], probeTopics: string[], avoidTopics: string[] }';
