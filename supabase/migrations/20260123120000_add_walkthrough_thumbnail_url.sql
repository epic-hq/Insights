alter table public.research_links
    add column if not exists walkthrough_thumbnail_url text;

comment on column public.research_links.walkthrough_thumbnail_url is
    'R2 key for walkthrough video thumbnail used in email previews.';
