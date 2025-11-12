-- Stage 1: Extend themes to house insight attributes and create compatibility views

ALTER TABLE public.themes
    ADD COLUMN IF NOT EXISTS category text,
    ADD COLUMN IF NOT EXISTS journey_stage text,
    ADD COLUMN IF NOT EXISTS desired_outcome text,
    ADD COLUMN IF NOT EXISTS emotional_response text,
    ADD COLUMN IF NOT EXISTS jtbd text,
    ADD COLUMN IF NOT EXISTS motivation text,
    ADD COLUMN IF NOT EXISTS contradictions text,
    ADD COLUMN IF NOT EXISTS pain text,
    ADD COLUMN IF NOT EXISTS details text,
    ADD COLUMN IF NOT EXISTS evidence text,
    ADD COLUMN IF NOT EXISTS impact numeric,
    ADD COLUMN IF NOT EXISTS novelty numeric,
    ADD COLUMN IF NOT EXISTS opportunity_ideas text[],
    ADD COLUMN IF NOT EXISTS related_tags text[],
    ADD COLUMN IF NOT EXISTS embedding text,
    ADD COLUMN IF NOT EXISTS confidence text,
    ADD COLUMN IF NOT EXISTS interview_id uuid;

DROP VIEW IF EXISTS public.insights_current CASCADE;
DROP VIEW IF EXISTS public.insights_with_priority;

CREATE VIEW public.insights_current AS
SELECT
    t.id,
    t.account_id,
    t.project_id,
    t.name,
    t.pain,
    t.details,
    t.category,
    t.journey_stage,
    t.emotional_response,
    t.desired_outcome,
    t.jtbd,
    t.impact,
    t.evidence,
    t.motivation,
    t.contradictions,
    t.embedding,
    t.opportunity_ideas,
    t.related_tags,
    t.novelty,
    t.confidence,
    t.interview_id,
    t.statement,
    t.synonyms,
    t.inclusion_criteria,
    t.exclusion_criteria,
    t.anti_examples,
    t.created_at,
    t.created_by,
    t.updated_at,
    t.updated_by
FROM public.themes t;

CREATE VIEW public.insights_with_priority AS
SELECT
    ic.id,
    ic.account_id,
    ic.project_id,
    ic.name,
    ic.pain,
    ic.details,
    ic.category,
    ic.journey_stage,
    ic.emotional_response,
    ic.desired_outcome,
    ic.jtbd,
    ic.impact,
    ic.evidence,
    ic.motivation,
    ic.contradictions,
    ic.embedding,
    ic.opportunity_ideas,
    ic.related_tags,
    ic.novelty,
    ic.confidence,
    ic.interview_id,
    ic.statement,
    ic.synonyms,
    ic.inclusion_criteria,
    ic.exclusion_criteria,
    ic.anti_examples,
    ic.created_at,
    ic.created_by,
    ic.updated_at,
    ic.updated_by,
    COALESCE(SUM(v.vote_value), 0) AS priority
FROM public.insights_current ic
LEFT JOIN public.votes v
    ON v.entity_type = 'insight'
    AND v.entity_id = ic.id
GROUP BY
    ic.id,
    ic.account_id,
    ic.project_id,
    ic.name,
    ic.pain,
    ic.details,
    ic.category,
    ic.journey_stage,
    ic.emotional_response,
    ic.desired_outcome,
    ic.jtbd,
    ic.impact,
    ic.evidence,
    ic.motivation,
    ic.contradictions,
    ic.embedding,
    ic.opportunity_ideas,
    ic.related_tags,
    ic.novelty,
    ic.confidence,
    ic.interview_id,
    ic.statement,
    ic.synonyms,
    ic.inclusion_criteria,
    ic.exclusion_criteria,
    ic.anti_examples,
    ic.created_at,
    ic.created_by,
    ic.updated_at,
    ic.updated_by;

GRANT SELECT ON public.insights_current TO authenticated;
GRANT SELECT ON public.insights_with_priority TO authenticated;
