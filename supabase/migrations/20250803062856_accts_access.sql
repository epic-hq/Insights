create policy "Authenticated users can read accounts"
on "accounts"."accounts"
as permissive
for select
to authenticated
using (true);



