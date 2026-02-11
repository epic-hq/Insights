-- Person Merge History
-- Tracks person record merges for audit trail and potential rollback

CREATE TABLE IF NOT EXISTS person_merge_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  -- Source person (deleted/merged away)
  source_person_id uuid NOT NULL,
  source_person_name text,
  source_person_data jsonb, -- Snapshot of source person before merge

  -- Target person (kept)
  target_person_id uuid NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  target_person_name text,

  -- Merge metadata
  merged_by uuid REFERENCES auth.users(id),
  merged_at timestamptz NOT NULL DEFAULT now(),
  reason text,

  -- Counts of transferred records
  evidence_count integer DEFAULT 0,
  interview_count integer DEFAULT 0,
  facet_count integer DEFAULT 0,

  -- Soft delete (allow 30-day rollback window)
  deleted_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_person_merge_history_account ON person_merge_history(account_id);
CREATE INDEX idx_person_merge_history_project ON person_merge_history(project_id);
CREATE INDEX idx_person_merge_history_source ON person_merge_history(source_person_id);
CREATE INDEX idx_person_merge_history_target ON person_merge_history(target_person_id);
CREATE INDEX idx_person_merge_history_merged_at ON person_merge_history(merged_at);

-- RLS
ALTER TABLE person_merge_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view merge history for their projects"
  ON person_merge_history
  FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM account_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create merge history for their projects"
  ON person_merge_history
  FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (
      SELECT account_id FROM account_users WHERE user_id = auth.uid()
    )
  );

-- Comment
COMMENT ON TABLE person_merge_history IS 'Audit trail for person record merges, enabling rollback and data lineage tracking';
