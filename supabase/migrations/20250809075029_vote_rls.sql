create policy "Users can create votes with their uid"
on "public"."votes"
as permissive
for insert
to public
with check (((auth.uid() = user_id) OR (auth.role() = 'service_role'::text)));


create policy "Users can delete their own votes"
on "public"."votes"
as permissive
for delete
to public
using (((auth.uid() = user_id) OR (auth.role() = 'service_role'::text)));


create policy "Users can update their own votes"
on "public"."votes"
as permissive
for update
to public
using (((auth.uid() = user_id) OR (auth.role() = 'service_role'::text)))
with check (((auth.uid() = user_id) OR (auth.role() = 'service_role'::text)));


create policy "Users can view votes in their account"
on "public"."votes"
as permissive
for select
to public
using (((auth.uid() = user_id) OR (auth.role() = 'service_role'::text)));



