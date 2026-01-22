/**
 * Add plan_id column to accounts table for feature gating
 *
 * This allows simpler feature checks without joining to billing tables.
 * Default is 'free' for existing accounts.
 */

-- Add plan_id column to accounts.accounts
ALTER TABLE accounts.accounts
ADD COLUMN IF NOT EXISTS plan_id text NOT NULL DEFAULT 'free';

-- Create index for plan_id lookups
CREATE INDEX IF NOT EXISTS idx_accounts_plan_id ON accounts.accounts(plan_id);

-- Comment for documentation
COMMENT ON COLUMN accounts.accounts.plan_id IS 'Current plan ID for feature gating. Values: free, starter, pro, team';
