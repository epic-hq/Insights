-- Helper function to get cluster strength metrics (people, orgs, evidence count)
create or replace function public.get_cluster_strength(
  cluster_facet_ids uuid[],
  project_id_param uuid
)
returns table (
  total_evidence_count bigint,
  total_people_count bigint,
  total_org_count bigint
) as $$
begin
  return query
    with cluster_evidence as (
      -- Get all evidence linked to cluster facets
      select distinct evf.evidence_id
      from public.evidence_facets evf
      where evf.facet_id = any(cluster_facet_ids)
        and evf.project_id = project_id_param
    ),
    cluster_people as (
      -- Get all people linked to cluster evidence
      select distinct ep.person_id
      from cluster_evidence ce
      join public.evidence_people ep on ep.evidence_id = ce.evidence_id
    ),
    cluster_orgs as (
      -- Get all orgs from people in cluster
      select distinct p.org_id
      from cluster_people cp
      join public.person p on p.id = cp.person_id
      where p.org_id is not null
    )
    select
      (select count(*) from cluster_evidence)::bigint as total_evidence_count,
      (select count(*) from cluster_people)::bigint as total_people_count,
      (select count(*) from cluster_orgs)::bigint as total_org_count;
end;
$$ language plpgsql;

comment on function public.get_cluster_strength is 'Calculate cluster strength metrics: total evidence, people, and organizations represented in the cluster';
