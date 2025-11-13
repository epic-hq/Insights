-- ICP (Ideal Customer Profile) Recommendations
-- Stores AI-generated recommendations for target customer segments based on bullseye scores and pain matrix data

CREATE TABLE IF NOT EXISTS icp_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  -- Top recommended ICP combinations
  -- Structure: [{ name: string, facets: object, stats: { count, bullseye_avg, top_pains } }]
  recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Generation metadata
  generated_at timestamptz NOT NULL DEFAULT now(),
  generated_by_user_id uuid,

  -- Ensure only one set of recommendations per project (can be refreshed)
  UNIQUE(project_id),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for quick lookups by project
CREATE INDEX IF NOT EXISTS idx_icp_recommendations_project_id ON icp_recommendations(project_id);

-- RLS Policies
ALTER TABLE icp_recommendations ENABLE ROW LEVEL SECURITY;

-- Users can view ICP recommendations for projects in their accounts
CREATE POLICY "Users can view ICP recommendations for their projects"
  ON icp_recommendations
  FOR SELECT
  USING (
    project_id IN (
      SELECT p.id FROM projects p
      INNER JOIN accounts.accounts a ON p.account_id = a.id
      INNER JOIN accounts.account_user au ON a.id = au.account_id
      WHERE au.user_id = auth.uid()
    )
  );

-- Users can insert/update ICP recommendations for projects in their accounts
CREATE POLICY "Users can manage ICP recommendations for their projects"
  ON icp_recommendations
  FOR ALL
  USING (
    project_id IN (
      SELECT p.id FROM projects p
      INNER JOIN accounts.accounts a ON p.account_id = a.id
      INNER JOIN accounts.account_user au ON a.id = au.account_id
      WHERE au.user_id = auth.uid()
    )
  );

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_icp_recommendations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_icp_recommendations_updated_at
  BEFORE UPDATE ON icp_recommendations
  FOR EACH ROW
  EXECUTE FUNCTION update_icp_recommendations_updated_at();
