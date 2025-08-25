-- View: insights_with_priority
-- Shows each insight with its priority (sum of votes from votes table)

create or replace view public.insights_with_priority as
select
  i.*,
  coalesce(sum(v.vote_value), 0) as priority
from
  public.insights i
left join
  public.votes v
    on v.entity_type = 'insight'
    and v.entity_id = i.id
group by
  i.id;