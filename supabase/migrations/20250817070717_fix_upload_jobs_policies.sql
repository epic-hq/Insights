-- Fix RLS policies for upload_jobs and analysis_jobs to use accounts.get_accounts_with_role()
-- This allows users to access jobs for interviews in team accounts they're members of

-- Drop existing policies
drop policy if exists "Users can view upload jobs for their interviews" on upload_jobs;
drop policy if exists "Users can insert upload jobs for their interviews" on upload_jobs;
drop policy if exists "Users can update upload jobs for their interviews" on upload_jobs;

drop policy if exists "Users can view analysis jobs for their interviews" on analysis_jobs;
drop policy if exists "Users can insert analysis jobs for their interviews" on analysis_jobs;
drop policy if exists "Users can update analysis jobs for their interviews" on analysis_jobs;

-- Create new policies using accounts.get_accounts_with_role()
create policy "Users can view upload jobs for their interviews" on upload_jobs
  for select using (
    interview_id in (
      select id from interviews 
      where account_id in (select accounts.get_accounts_with_role())
    )
  );

create policy "Users can insert upload jobs for their interviews" on upload_jobs
  for insert with check (
    interview_id in (
      select id from interviews 
      where account_id in (select accounts.get_accounts_with_role())
    )
  );

create policy "Users can update upload jobs for their interviews" on upload_jobs
  for update using (
    interview_id in (
      select id from interviews 
      where account_id in (select accounts.get_accounts_with_role())
    )
  );

create policy "Users can view analysis jobs for their interviews" on analysis_jobs
  for select using (
    interview_id in (
      select id from interviews 
      where account_id in (select accounts.get_accounts_with_role())
    )
  );

create policy "Users can insert analysis jobs for their interviews" on analysis_jobs
  for insert with check (
    interview_id in (
      select id from interviews 
      where account_id in (select accounts.get_accounts_with_role())
    )
  );

create policy "Users can update analysis jobs for their interviews" on analysis_jobs
  for update using (
    interview_id in (
      select id from interviews 
      where account_id in (select accounts.get_accounts_with_role())
    )
  );