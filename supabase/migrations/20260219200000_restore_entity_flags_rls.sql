-- Restore RLS policies for entity_flags table.
-- These were accidentally dropped in 20250809174047_rls_anno.sql and never re-created.

create policy "Account members can view flags"
on "public"."entity_flags"
as permissive
for select
to public
using (
    (exists (
        select 1 from accounts.account_user
        where account_user.user_id = auth.uid()
          and account_user.account_id = entity_flags.account_id
    ))
    or (auth.role() = 'service_role'::text)
);

create policy "Users can insert their own flags"
on "public"."entity_flags"
as permissive
for insert
to public
with check (
    (auth.uid() = user_id)
    or (auth.role() = 'service_role'::text)
);

create policy "Users can update their own flags"
on "public"."entity_flags"
as permissive
for update
to public
using (
    (auth.uid() = user_id)
    or (auth.role() = 'service_role'::text)
);

create policy "Users can delete their own flags"
on "public"."entity_flags"
as permissive
for delete
to public
using (
    (auth.uid() = user_id)
    or (auth.role() = 'service_role'::text)
);
