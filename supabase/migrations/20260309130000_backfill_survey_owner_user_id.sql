-- Backfill survey_owner_user_id for existing research_links.
-- Strategy: for each account with research_links that have no owner set,
-- find the account owner (role = 'owner') and assign them.
-- This is a best-effort backfill - single-user accounts will be correct;
-- multi-user accounts will get the account owner which is the right default.
update public.research_links rl
set survey_owner_user_id = (
    select m.user_id
    from accounts.account_user m
    where m.account_id = rl.account_id
      and m.account_role = 'owner'
    order by m.created_at asc
    limit 1
)
where rl.survey_owner_user_id is null;
