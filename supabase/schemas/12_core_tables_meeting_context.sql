-- Add meeting context fields to people table
-- Stores where and when you met a contact

do $$
begin
  -- Add where_met column if it doesn't exist
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
    and table_name = 'people'
    and column_name = 'where_met'
  ) then
    alter table public.people add column where_met text;
    comment on column public.people.where_met is 'Location or event where you met this person (e.g., "North County Mixer", "TechCrunch Disrupt")';
  end if;

  -- Add when_met column if it doesn't exist
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
    and table_name = 'people'
    and column_name = 'when_met'
  ) then
    alter table public.people add column when_met timestamptz;
    comment on column public.people.when_met is 'Date/time when you met this person';
  end if;
end $$;
