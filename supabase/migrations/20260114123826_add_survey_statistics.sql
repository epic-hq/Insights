-- Add statistics JSONB column to research_links for storing computed aggregate survey stats
-- This enables efficient retrieval of survey results without recomputing from individual responses

-- Add the statistics column
alter table public.research_links
add column if not exists statistics jsonb default null;

-- Add comment explaining the column structure
comment on column public.research_links.statistics is 'Computed aggregate statistics from survey responses. Structure: { computedAt: timestamp, responseCount: number, completedCount: number, questions: [{ questionId, prompt, type, responseCount, stats: { average?, distribution?, percentages? }, topResponses?: [] }] }';

-- Add stats_updated_at to track when statistics were last computed
alter table public.research_links
add column if not exists stats_updated_at timestamptz default null;
