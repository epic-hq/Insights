-- Fix RLS circular dependency for My Responses feature
-- The previous policies created a circular dependency:
-- - research_links policy checked research_link_responses
-- - research_link_responses policy might trigger research_links check during joins
--
-- Solution: Use security_definer function to bypass RLS when checking user's responses

-- Create helper function to check if user has responses (bypasses RLS)
create or replace function public.user_has_response_for_link(link_id uuid)
    returns boolean
    language sql
    security definer
    stable
as $$
    select exists (
        select 1
        from public.research_link_responses
        where research_link_id = link_id
          and lower(email) = lower(auth.jwt() ->> 'email')
    );
$$;

-- Create helper function to get research_link_ids user has responded to (bypasses RLS)
create or replace function public.get_user_response_link_ids()
    returns setof uuid
    language sql
    security definer
    stable
as $$
    select research_link_id
    from public.research_link_responses
    where lower(email) = lower(auth.jwt() ->> 'email');
$$;

-- Create helper function to get account_ids user has responded to (bypasses RLS)
create or replace function public.get_user_response_account_ids()
    returns setof uuid
    language sql
    security definer
    stable
as $$
    select distinct rl.account_id
    from public.research_links rl
    where rl.id in (
        select research_link_id
        from public.research_link_responses
        where lower(email) = lower(auth.jwt() ->> 'email')
    );
$$;

-- Drop old policies that had circular dependency
drop policy if exists "Users can read research links they responded to" on public.research_links;
drop policy if exists "Users can read accounts they responded to" on accounts.accounts;

-- Recreate policies using the security_definer functions
create policy "Users can read research links they responded to"
    on public.research_links
    for select
    to authenticated
    using (id in (select public.get_user_response_link_ids()));

create policy "Users can read accounts they responded to"
    on accounts.accounts
    for select
    to authenticated
    using (id in (select public.get_user_response_account_ids()));

-- Grant execute permissions
grant execute on function public.user_has_response_for_link(uuid) to authenticated;
grant execute on function public.get_user_response_link_ids() to authenticated;
grant execute on function public.get_user_response_account_ids() to authenticated;
