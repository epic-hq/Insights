-- Project Answer Evidence (normalized evidence rows per answer)
-- Declarative schema using member-role RLS and timestamp/user tracking triggers

set search_path = public;

create table if not exists public.project_answer_evidence (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  answer_id uuid not null references public.project_answers(id) on delete cascade,
  evidence_id uuid,
  interview_id uuid references public.interviews(id) on delete set null,
  source text not null,                      -- 'transcript' | 'note' | 'file' | 'email' | 'survey' | 'manual'
  text text,                                 -- short excerpt (optional)
  start_seconds numeric,                     -- for A/V segments
  end_seconds numeric,
  transcript_chunk_id uuid,                  -- optional future FK if transcript chunks normalized
  payload jsonb,                             -- tool-specific metadata (speaker, urls, spans, etc.)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes ------------------------------------------------------------------
create index if not exists idx_pae_project            on public.project_answer_evidence(project_id);
create index if not exists idx_pae_answer             on public.project_answer_evidence(answer_id);
create index if not exists idx_pae_evidence_id        on public.project_answer_evidence(evidence_id);
create index if not exists idx_pae_interview          on public.project_answer_evidence(interview_id);
create index if not exists idx_pae_source             on public.project_answer_evidence(source);
create index if not exists idx_pae_times              on public.project_answer_evidence(start_seconds, end_seconds);
create index if not exists idx_pae_payload_gin        on public.project_answer_evidence using gin (payload);
create unique index if not exists idx_pae_unique_project_answer_evidence on public.project_answer_evidence(project_id, answer_id, evidence_id);

DO $$
BEGIN
  IF to_regclass('public.evidence') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.project_answer_evidence'::regclass
        AND conname = 'project_answer_evidence_evidence_id_fkey'
    ) THEN
      ALTER TABLE public.project_answer_evidence
        ADD CONSTRAINT project_answer_evidence_evidence_id_fkey
          FOREIGN KEY (evidence_id)
          REFERENCES public.evidence(id)
          ON DELETE CASCADE;
    END IF;
  ELSE
    RAISE NOTICE 'Skipping project_answer_evidence_evidence_id_fkey; evidence table missing';
  END IF;
END$$;

-- Triggers -----------------------------------------------------------------
create trigger set_project_answer_evidence_timestamp
  before insert or update on public.project_answer_evidence
  for each row execute procedure accounts.trigger_set_timestamps();

create trigger set_project_answer_evidence_user_tracking
  before insert or update on public.project_answer_evidence
  for each row execute procedure accounts.trigger_set_user_tracking();

-- RLS ----------------------------------------------------------------------
alter table public.project_answer_evidence enable row level security;

create policy "Account members can select evidence"
  on public.project_answer_evidence
  for select to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and accounts.has_role_on_account(p.account_id)
    )
  );

create policy "Account members can insert evidence"
  on public.project_answer_evidence
  for insert to authenticated
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id and accounts.has_role_on_account(p.account_id)
    )
  );

create policy "Account members can update evidence"
  on public.project_answer_evidence
  for update to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and accounts.has_role_on_account(p.account_id)
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id and accounts.has_role_on_account(p.account_id)
    )
  );

create policy "Account owners can delete evidence"
  on public.project_answer_evidence
  for delete to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and accounts.has_role_on_account(p.account_id, 'owner'::accounts.account_role)
    )
  );
