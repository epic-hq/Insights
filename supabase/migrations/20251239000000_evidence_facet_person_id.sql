-- Add person_id to evidence_facet for direct person linkage
-- This enables survey_response facets to link directly to the person who answered

-- Add the column
alter table "public"."evidence_facet" add column if not exists "person_id" uuid;

-- Add index for efficient person-based queries
create index if not exists idx_evidence_facet_person_id on public.evidence_facet using btree (person_id);

-- Add foreign key constraint
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'evidence_facet_person_id_fkey'
  ) then
    alter table "public"."evidence_facet"
      add constraint "evidence_facet_person_id_fkey"
      foreign key (person_id) references public.people(id) on delete set null;
  end if;
end $$;

comment on column public.evidence_facet.person_id is 'Direct link to the person this facet belongs to. Used for survey_response facets where each Q&A is specific to one person.';
