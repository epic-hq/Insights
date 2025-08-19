-- Fix RLS policy for annotations table
-- The previous policy had a bug where it compared account_user.account_id = account_user.account_id
-- instead of account_user.account_id = annotations.account_id

-- Drop the existing policy with the bug
drop policy if exists "Account members can insert annotations" on public.annotations;

-- Create the corrected insert policy
create policy "Account members can insert annotations"
    on public.annotations
    for insert
    with check (
        auth.uid() = created_by_user_id
        or exists (
            select 1 from accounts.account_user
            where account_user.user_id = auth.uid()
              and account_user.account_id = annotations.account_id
        )
        or auth.role() = 'service_role'
    );

-- Add missing SELECT policy for annotations
create policy "Account members can view annotations"
    on public.annotations
    for select
    using (
        exists (
            select 1 from accounts.account_user
            where account_user.user_id = auth.uid()
              and account_user.account_id = annotations.account_id
        )
        or auth.role() = 'service_role'
    );