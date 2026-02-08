-- Add utm_params JSONB column to research_link_responses for campaign attribution
alter table public.research_link_responses
  add column if not exists utm_params jsonb;
