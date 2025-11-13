-- Make legacy insights table read-only
alter table public.insights enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'insights' and policyname = 'insights_read_only'
  ) then
    create policy "insights_read_only" on public.insights
      for select using (true);
  end if;
end $$;

create or replace rule insights_no_write as on insert to public.insights do instead nothing;
create or replace rule insights_no_update as on update to public.insights do instead nothing;
create or replace rule insights_no_delete as on delete to public.insights do instead nothing;
