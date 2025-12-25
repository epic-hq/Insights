-- RPC function to get response counts for research links
create or replace function public.get_research_link_response_counts(link_ids uuid[])
returns table (research_link_id uuid, response_count bigint)
language sql
stable
as $$
  select research_link_id, count(*)::bigint as response_count
  from public.research_link_responses
  where research_link_id = any(link_ids)
  group by research_link_id
$$;
