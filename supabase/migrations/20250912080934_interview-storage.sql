-- Storage: interview recordings bucket and policies (declarative)

-- Create bucket for interview recordings
insert into storage.buckets (id, name)
values ('interview-recordings', 'interview-recordings')
on conflict (id) do nothing;

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
