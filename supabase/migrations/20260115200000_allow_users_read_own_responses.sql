-- Allow users to read their own survey responses by email
-- This enables the "My Responses" feature where users can see surveys they've submitted
-- even if they're not members of the project/account that created the survey

create policy "Users can read own responses by email"
    on public.research_link_responses
    for select
    to authenticated
    using (
        lower(email) = lower(auth.jwt() ->> 'email')
    );

-- Allow users to read research_links if they have submitted a response to it
-- This is needed for the join in the My Responses query
create policy "Users can read research links they responded to"
    on public.research_links
    for select
    to authenticated
    using (
        id in (
            select research_link_id
            from public.research_link_responses
            where lower(email) = lower(auth.jwt() ->> 'email')
        )
    );

-- Allow users to read accounts if they have responded to a survey from that account
-- This is needed for the join in the My Responses query to show "From [Account Name]"
create policy "Users can read accounts they responded to"
    on accounts.accounts
    for select
    to authenticated
    using (
        id in (
            select rl.account_id
            from public.research_links rl
            inner join public.research_link_responses rlr on rlr.research_link_id = rl.id
            where lower(rlr.email) = lower(auth.jwt() ->> 'email')
        )
    );
