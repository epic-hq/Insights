-- Per-person facet lens summaries (1-2 sentence takeaways per kind)
create table if not exists public.person_facet_summaries (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts.accounts (id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  kind_slug text not null,

  -- The summary for this (person, kind) combination
  summary text not null,

  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (person_id, kind_slug)
);

create index if not exists idx_person_facet_summaries_person on public.person_facet_summaries(person_id);
create index if not exists idx_person_facet_summaries_project on public.person_facet_summaries(project_id);

CREATE TRIGGER set_person_facet_summaries_timestamp
    BEFORE INSERT OR UPDATE ON public.person_facet_summaries
    FOR EACH ROW
EXECUTE PROCEDURE accounts.trigger_set_timestamps();

CREATE TRIGGER set_person_facet_summaries_user_tracking
    BEFORE INSERT OR UPDATE ON public.person_facet_summaries
    FOR EACH ROW
EXECUTE PROCEDURE accounts.trigger_set_user_tracking();

ALTER TABLE public.person_facet_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members can select"
  ON public.person_facet_summaries
  FOR SELECT
  TO authenticated
  USING (account_id IN (SELECT accounts.get_accounts_with_role()));

CREATE POLICY "Account members can insert"
  ON public.person_facet_summaries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (SELECT accounts.get_accounts_with_role())
    AND project_id IN (
      SELECT p.id FROM projects p WHERE p.account_id = account_id
    )
  );

CREATE POLICY "Account members can update"
  ON public.person_facet_summaries
  FOR UPDATE
  TO authenticated
  USING (account_id IN (SELECT accounts.get_accounts_with_role()))
  WITH CHECK (
    account_id IN (SELECT accounts.get_accounts_with_role())
    AND project_id IN (
      SELECT p.id FROM projects p WHERE p.account_id = account_id
    )
  );

CREATE POLICY "Account owners can delete"
  ON public.person_facet_summaries
  FOR DELETE
  TO authenticated
  USING (account_id IN (SELECT accounts.get_accounts_with_role('owner')));
