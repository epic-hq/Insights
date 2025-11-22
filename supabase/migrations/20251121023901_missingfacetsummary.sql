do $$
begin
  -- Only add the column if the table already exists (it may be created by later migrations)
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'person_facet_summaries'
  ) then
    alter table public.person_facet_summaries
      add column if not exists created_at timestamptz not null default now();
  end if;
end $$;
