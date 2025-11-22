-- Fix analysis_jobs RLS policies to properly check account membership
-- The old policies incorrectly used account_id = auth.uid()
-- This fixes them to check if the user is a member of the account

drop policy if exists "Users can view analysis jobs for their interviews" on analysis_jobs;
drop policy if exists "Users can insert analysis jobs for their interviews" on analysis_jobs;
drop policy if exists "Users can update analysis jobs for their interviews" on analysis_jobs;

create policy "Users can view analysis jobs for their interviews" on analysis_jobs
  for select using (
    interview_id in (
      select id from interviews
      where account_id in (
        select account_id from accounts.account_user where user_id = auth.uid()
      )
    )
  );

create policy "Users can insert analysis jobs for their interviews" on analysis_jobs
  for insert with check (
    interview_id in (
      select id from interviews
      where account_id in (
        select account_id from accounts.account_user where user_id = auth.uid()
      )
    )
  );

create policy "Users can update analysis jobs for their interviews" on analysis_jobs
  for update using (
    interview_id in (
      select id from interviews
      where account_id in (
        select account_id from accounts.account_user where user_id = auth.uid()
      )
    )
  );
