-- Add evidence_id column to project_answer_evidence table
-- This links project answers to specific evidence records

alter table "public"."project_answer_evidence" 
add column if not exists "evidence_id" uuid references public.evidence(id) on delete cascade;

-- Add index for evidence_id lookups
create index if not exists idx_pae_evidence_id on public.project_answer_evidence(evidence_id);

-- Update the unique constraint to include evidence_id
drop index if exists idx_pae_unique_answer_evidence;
create unique index idx_pae_unique_project_answer_evidence 
on public.project_answer_evidence(project_id, answer_id, evidence_id);