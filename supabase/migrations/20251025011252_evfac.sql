-- Drop old policy if it exists
drop policy if exists "Account owners can delete" on "public"."people";

-- Drop new policy if it exists (for idempotency)
drop policy if exists "Account members can delete" on "public"."people";

-- Create new policy
create policy "Account members can delete"
on "public"."people"
as permissive
for delete
to authenticated
using ((account_id IN ( SELECT accounts.get_accounts_with_role() AS get_accounts_with_role)));



