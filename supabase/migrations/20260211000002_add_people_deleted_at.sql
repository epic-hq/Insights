-- Add soft delete column to people table
-- Allows 30-day rollback window for person merges

ALTER TABLE people
ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Index for filtering out soft-deleted people
CREATE INDEX IF NOT EXISTS idx_people_deleted_at ON people(deleted_at) WHERE deleted_at IS NULL;

-- Update RLS policies to exclude soft-deleted people
-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view people in their projects" ON people;

-- Recreate with deleted_at filter
CREATE POLICY "Users can view people in their projects"
  ON people
  FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND account_id IN (
      SELECT account_id FROM account_users WHERE user_id = auth.uid()
    )
  );

-- Comment
COMMENT ON COLUMN people.deleted_at IS 'Soft delete timestamp for person merges. Allows 30-day rollback window before permanent deletion.';
