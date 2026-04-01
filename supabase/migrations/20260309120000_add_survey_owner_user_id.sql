-- Add survey_owner_user_id to research_links to track which user created the survey.
-- Used for PostHog PLG nurture attribution so events can be fired against the survey creator.
alter table public.research_links
    add column if not exists survey_owner_user_id uuid references auth.users (id) on delete set null;

comment on column public.research_links.survey_owner_user_id is 'The auth.users id of the user who created this survey. Used for PostHog PLG event attribution.';
