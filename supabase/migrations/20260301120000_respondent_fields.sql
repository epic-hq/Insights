-- Replace collect_title boolean with flexible respondent_fields JSONB array
-- This allows admins to choose which additional fields to collect from respondents
-- (e.g., first_name, last_name, company, title, phone)

alter table public.research_links
    add column if not exists respondent_fields jsonb not null default '["first_name", "last_name"]'::jsonb;

-- Migrate existing collect_title=true to include 'title' in respondent_fields
update public.research_links
    set respondent_fields = '["first_name", "last_name", "company", "title"]'::jsonb
    where collect_title = true;

-- Keep collect_title column for backwards compatibility (will be removed later)
