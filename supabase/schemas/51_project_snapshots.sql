-- Project Snapshots
-- Daily snapshots of project metrics for week-over-week delta tracking.
-- Used by the ResearchPulse gen-ui widget to show "what changed this week?"

CREATE TABLE IF NOT EXISTS project_snapshots (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  data jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, snapshot_date)
);

-- RLS: project members can read their own project snapshots
ALTER TABLE project_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their project snapshots"
  ON project_snapshots FOR SELECT
  USING (
    account_id IN (
      SELECT account_id FROM account_user WHERE user_id = auth.uid()
    )
  );

-- Index for efficient queries by project + date range
CREATE INDEX IF NOT EXISTS idx_project_snapshots_project_date
  ON project_snapshots (project_id, snapshot_date DESC);
