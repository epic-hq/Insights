drop policy "Users can delete their own annotations" on "public"."annotations";

drop policy "Users can insert annotations in their account" on "public"."annotations";

drop policy "Users can update their own annotations" on "public"."annotations";

drop policy "Users can view annotations in their account" on "public"."annotations";

drop policy "Users can delete their own flags" on "public"."entity_flags";

drop policy "Users can insert flags in their account" on "public"."entity_flags";

drop policy "Users can update their own flags" on "public"."entity_flags";

drop policy "Users can view flags in their account" on "public"."entity_flags";

drop index if exists "public"."idx_annotations_entity_project";

drop index if exists "public"."idx_entity_flags_entity_project";

drop index if exists "public"."idx_votes_entity_project";

create policy "Account members can insert annotations"
on "public"."annotations"
as permissive
for insert
to public
with check (((auth.uid() = created_by_user_id) OR (EXISTS ( SELECT 1
   FROM accounts.account_user
  WHERE ((account_user.user_id = auth.uid()) AND (account_user.account_id = account_user.account_id)))) OR (auth.role() = 'service_role'::text)));



