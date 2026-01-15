-- Fix circular RLS dependency in research_link_responses
--
-- The problem:
-- 1. "Members can read research link responses" does: research_link_id IN (SELECT id FROM research_links WHERE ...)
-- 2. research_links has policy "Users can read research links they responded to" which queries research_link_responses
-- 3. This creates infinite recursion causing 500 errors
--
-- Solution: Make the research_link_responses policy use a security_definer function

-- Create helper function to get research_link_ids for user's accounts (bypasses RLS)
create or replace function public.get_account_research_link_ids()
    returns setof uuid
    language sql
    security definer
    stable
as $$
    select id
    from public.research_links
    where account_id in (select accounts.get_accounts_with_role());
$$;

grant execute on function public.get_account_research_link_ids() to authenticated;
grant execute on function public.get_account_research_link_ids() to anon;

-- Drop and recreate the problematic policy
drop policy if exists "Members can read research link responses" on public.research_link_responses;

create policy "Members can read research link responses"
    on public.research_link_responses
    for select
    using (
        research_link_id in (select public.get_account_research_link_ids())
    );
