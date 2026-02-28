-- Survey editor redesign: add archived state, collect_title, default is_live to true
-- Also add title column to responses for optional title collection

-- Add is_archived column for hiding surveys from main list
alter table public.research_links
    add column if not exists is_archived boolean not null default false;

-- Add collect_title option for collecting respondent job title
alter table public.research_links
    add column if not exists collect_title boolean not null default false;

-- Change is_live default to true (new surveys are live by default)
alter table public.research_links
    alter column is_live set default true;

-- Add title column to responses for respondent job title
alter table public.research_link_responses
    add column if not exists title text;
