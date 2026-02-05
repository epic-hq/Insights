-- Add AI analysis storage to research_links
alter table public.research_links
  add column if not exists ai_analysis jsonb default null,
  add column if not exists ai_analysis_updated_at timestamptz default null;

comment on column public.research_links.ai_analysis is 'AI-generated analysis of survey responses. Structure: { mode: "quick"|"detailed", updatedAt: timestamp, result: AnalysisResult|DetailedAnalysisResult }';
