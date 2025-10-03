BEGIN;

SET search_path = public;

-- Align evidence table with declarative schema prior to seed scripts -------------------------
ALTER TABLE public.evidence
  ADD COLUMN IF NOT EXISTS project_answer_id uuid;

ALTER TABLE public.evidence
  ADD COLUMN IF NOT EXISTS chunk text;

ALTER TABLE public.evidence
  ADD COLUMN IF NOT EXISTS gist text;

ALTER TABLE public.evidence
  ADD COLUMN IF NOT EXISTS topic text;

ALTER TABLE public.evidence
  ADD COLUMN IF NOT EXISTS context_summary text;

ALTER TABLE public.evidence
  ADD COLUMN IF NOT EXISTS support text;

ALTER TABLE public.evidence
  ADD COLUMN IF NOT EXISTS modality text;

ALTER TABLE public.evidence
  ADD COLUMN IF NOT EXISTS method text;

ALTER TABLE public.evidence
  ADD COLUMN IF NOT EXISTS source_type text;

ALTER TABLE public.evidence
  ADD COLUMN IF NOT EXISTS personas text[] DEFAULT '{}'::text[];

ALTER TABLE public.evidence
  ADD COLUMN IF NOT EXISTS segments text[] DEFAULT '{}'::text[];

ALTER TABLE public.evidence
  ADD COLUMN IF NOT EXISTS says text[] DEFAULT '{}'::text[];

ALTER TABLE public.evidence
  ADD COLUMN IF NOT EXISTS does text[] DEFAULT '{}'::text[];

ALTER TABLE public.evidence
  ADD COLUMN IF NOT EXISTS thinks text[] DEFAULT '{}'::text[];

ALTER TABLE public.evidence
  ADD COLUMN IF NOT EXISTS feels text[] DEFAULT '{}'::text[];

ALTER TABLE public.evidence
  ADD COLUMN IF NOT EXISTS pains text[] DEFAULT '{}'::text[];

ALTER TABLE public.evidence
  ADD COLUMN IF NOT EXISTS gains text[] DEFAULT '{}'::text[];

ALTER TABLE public.evidence
  ADD COLUMN IF NOT EXISTS journey_stage text;

ALTER TABLE public.evidence
  ADD COLUMN IF NOT EXISTS weight_quality numeric DEFAULT 0.8;

ALTER TABLE public.evidence
  ADD COLUMN IF NOT EXISTS weight_relevance numeric DEFAULT 0.8;

ALTER TABLE public.evidence
  ADD COLUMN IF NOT EXISTS independence_key text;

ALTER TABLE public.evidence
  ADD COLUMN IF NOT EXISTS confidence text;

ALTER TABLE public.evidence
  ALTER COLUMN modality SET DEFAULT 'qual';

ALTER TABLE public.evidence
  ALTER COLUMN support SET DEFAULT 'supports';

ALTER TABLE public.evidence
  ALTER COLUMN source_type SET DEFAULT 'primary';

ALTER TABLE public.evidence
  ALTER COLUMN confidence SET DEFAULT 'medium';

ALTER TABLE public.evidence
  ALTER COLUMN weight_quality SET DEFAULT 0.8;

ALTER TABLE public.evidence
  ALTER COLUMN weight_relevance SET DEFAULT 0.8;

ALTER TABLE public.evidence
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.evidence
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Defer the project_answers FK to later migrations once that table exists

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.evidence'::regclass
      AND conname = 'evidence_support_check'
  ) THEN
    ALTER TABLE public.evidence
      ADD CONSTRAINT evidence_support_check
        CHECK (support IN ('supports','refutes','neutral'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.evidence'::regclass
      AND conname = 'evidence_modality_check'
  ) THEN
    ALTER TABLE public.evidence
      ADD CONSTRAINT evidence_modality_check
        CHECK (modality IN ('qual','quant'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.evidence'::regclass
      AND conname = 'evidence_method_check'
  ) THEN
    ALTER TABLE public.evidence
      ADD CONSTRAINT evidence_method_check
        CHECK (method IN (
          'interview','usability','survey','telemetry','market_report','support_ticket','benchmark','other'
        ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.evidence'::regclass
      AND conname = 'evidence_source_type_check'
  ) THEN
    ALTER TABLE public.evidence
      ADD CONSTRAINT evidence_source_type_check
        CHECK (source_type IN ('primary','secondary'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.evidence'::regclass
      AND conname = 'evidence_confidence_check'
  ) THEN
    ALTER TABLE public.evidence
      ADD CONSTRAINT evidence_confidence_check
        CHECK (confidence IN ('low','medium','high'));
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_evidence_project_answer
  ON public.evidence(project_answer_id);

CREATE INDEX IF NOT EXISTS idx_evidence_account_id
  ON public.evidence(account_id);

CREATE INDEX IF NOT EXISTS idx_evidence_project_id
  ON public.evidence(project_id);

CREATE INDEX IF NOT EXISTS idx_evidence_interview_id
  ON public.evidence(interview_id);

CREATE INDEX IF NOT EXISTS idx_evidence_created_at
  ON public.evidence(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_evidence_kind_tags
  ON public.evidence USING gin (kind_tags);

CREATE INDEX IF NOT EXISTS idx_evidence_anchors_gin
  ON public.evidence USING gin (anchors jsonb_path_ops);

ALTER TABLE public.evidence ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_evidence_timestamp ON public.evidence;
DROP TRIGGER IF EXISTS set_evidence_user_tracking ON public.evidence;

CREATE TRIGGER set_evidence_timestamp
    BEFORE INSERT OR UPDATE ON public.evidence
    FOR EACH ROW
EXECUTE PROCEDURE accounts.trigger_set_timestamps();

CREATE TRIGGER set_evidence_user_tracking
    BEFORE INSERT OR UPDATE ON public.evidence
    FOR EACH ROW
EXECUTE PROCEDURE accounts.trigger_set_user_tracking();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'evidence' AND policyname = 'Account members can select'
  ) THEN
    CREATE POLICY "Account members can select" ON public.evidence
      FOR SELECT TO authenticated
      USING (account_id IN (SELECT accounts.get_accounts_with_role()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'evidence' AND policyname = 'Account members can insert'
  ) THEN
    CREATE POLICY "Account members can insert" ON public.evidence
      FOR INSERT TO authenticated
      WITH CHECK (account_id IN (SELECT accounts.get_accounts_with_role()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'evidence' AND policyname = 'Account members can update'
  ) THEN
    CREATE POLICY "Account members can update" ON public.evidence
      FOR UPDATE TO authenticated
      USING (account_id IN (SELECT accounts.get_accounts_with_role()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'evidence' AND policyname = 'Account owners can delete'
  ) THEN
    CREATE POLICY "Account owners can delete" ON public.evidence
      FOR DELETE TO authenticated
      USING (account_id IN (SELECT accounts.get_accounts_with_role('owner')));
  END IF;
END$$;

COMMIT;
