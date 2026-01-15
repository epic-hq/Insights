-- Add policy for members to delete survey responses

create policy "Members can delete research link responses"
    on public.research_link_responses
    for delete
    to authenticated
    using (
        research_link_id in (
            select id from public.research_links
            where account_id in (select accounts.get_accounts_with_role())
        )
    );
