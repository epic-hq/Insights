-- Rename target_industries to target_orgs for naming consistency
-- Same field name at account and project level, project overrides account

-- Rename the column (preserves data)
ALTER TABLE accounts.accounts RENAME COLUMN target_industries TO target_orgs;

-- Update comment
COMMENT ON COLUMN accounts.accounts.target_orgs IS 'Default target organizations (can be overridden per project)';
