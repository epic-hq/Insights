-- Create function to find clusters of similar person facets for semantic segment grouping
create or replace function public.find_person_facet_clusters(
  project_id_param uuid,
  kind_slug_param text,
  similarity_threshold float default 0.75
)
returns table (
  person_facet_id_1 text,
  person_facet_id_2 text,
  facet_account_id_1 int,
  facet_account_id_2 int,
  label_1 text,
  label_2 text,
  similarity float,
  combined_person_count bigint
) as $$
begin
  return query
    select
      pf1.person_id::text || '|' || pf1.facet_account_id::text as person_facet_id_1,
      pf2.person_id::text || '|' || pf2.facet_account_id::text as person_facet_id_2,
      pf1.facet_account_id as facet_account_id_1,
      pf2.facet_account_id as facet_account_id_2,
      fa1.label as label_1,
      fa2.label as label_2,
      1 - (pf1.embedding <=> pf2.embedding) as similarity,
      (
        select count(distinct person_id)
        from public.person_facet pf_temp
        where pf_temp.facet_account_id in (pf1.facet_account_id, pf2.facet_account_id)
          and pf_temp.project_id = project_id_param
      ) as combined_person_count
    from public.person_facet pf1
    join public.facet_account fa1 on fa1.id = pf1.facet_account_id
    join public.facet_kind_global fkg1 on fkg1.id = fa1.kind_id
    cross join public.person_facet pf2
    join public.facet_account fa2 on fa2.id = pf2.facet_account_id
    join public.facet_kind_global fkg2 on fkg2.id = fa2.kind_id
    where pf1.project_id = project_id_param
      and pf2.project_id = project_id_param
      and fkg1.slug = kind_slug_param
      and fkg2.slug = kind_slug_param
      and pf1.facet_account_id < pf2.facet_account_id
      and pf1.embedding is not null
      and pf2.embedding is not null
      and 1 - (pf1.embedding <=> pf2.embedding) > similarity_threshold
    order by similarity desc;
end;
$$ language plpgsql;

comment on function public.find_person_facet_clusters is 'Find clusters of similar person facets for semantic segment grouping (e.g., "Product Manager" + "PM" + "Product Lead")';
