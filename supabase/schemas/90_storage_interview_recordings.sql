-- Storage: interview recordings bucket and policies (declarative)

-- Create bucket for interview recordings. Older/newer storage versions may or may not have a `public` column,
-- so we feature-detect before inserting to avoid column errors.
do $$
declare
  has_public boolean;
begin
  select exists(
    select 1
    from information_schema.columns
    where table_schema = 'storage'
      and table_name = 'buckets'
      and column_name = 'public'
  ) into has_public;

  if has_public then
    insert into storage.buckets (id, name, public)
    values ('interview-recordings', 'interview-recordings', true)
    on conflict (id) do update set public = excluded.public;
  else
    insert into storage.buckets (id, name)
    values ('interview-recordings', 'interview-recordings')
    on conflict (id) do nothing;
  end if;
end $$;

-- Policies scoped to this bucket
-- Public read access to objects in this bucket
create policy  "Public read for interview recordings"
on storage.objects
for select using (bucket_id = 'interview-recordings');

-- Allow authenticated users to upload objects into this bucket
create policy  "Authenticated upload to interview recordings"
on storage.objects
for insert to authenticated
with check (bucket_id = 'interview-recordings');

-- Allow authenticated users to update objects in this bucket (optional)
create policy  "Authenticated update interview recordings"
on storage.objects
for update to authenticated
using (bucket_id = 'interview-recordings')
with check (bucket_id = 'interview-recordings');

-- Allow authenticated users to delete objects in this bucket (optional)
create policy  "Authenticated delete interview recordings"
on storage.objects
for delete to authenticated
using (bucket_id = 'interview-recordings');
