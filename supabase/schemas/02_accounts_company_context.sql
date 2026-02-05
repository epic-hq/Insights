-- Company Context for Accounts
-- Stores account-level company information that provides DEFAULTS for all projects
-- Projects can override these values for study-specific focus
--
-- LAYERING: Account → Project (project overrides account when present)

-- Add company context columns to accounts table
ALTER TABLE accounts.accounts ADD COLUMN IF NOT EXISTS website_url text;
ALTER TABLE accounts.accounts ADD COLUMN IF NOT EXISTS company_description text;
ALTER TABLE accounts.accounts ADD COLUMN IF NOT EXISTS customer_problem text;
ALTER TABLE accounts.accounts ADD COLUMN IF NOT EXISTS offerings text[];
ALTER TABLE accounts.accounts ADD COLUMN IF NOT EXISTS target_orgs text[];
ALTER TABLE accounts.accounts ADD COLUMN IF NOT EXISTS target_company_sizes text[];
ALTER TABLE accounts.accounts ADD COLUMN IF NOT EXISTS target_roles text[];
ALTER TABLE accounts.accounts ADD COLUMN IF NOT EXISTS competitors text[];
ALTER TABLE accounts.accounts ADD COLUMN IF NOT EXISTS industry text;

-- Comments for documentation
COMMENT ON COLUMN accounts.accounts.website_url IS 'Company website URL for auto-research';
COMMENT ON COLUMN accounts.accounts.company_description IS 'Brief description of what the company does';
COMMENT ON COLUMN accounts.accounts.customer_problem IS 'Default customer problem (can be overridden per project)';
COMMENT ON COLUMN accounts.accounts.offerings IS 'Default products/services (can be overridden per project)';
COMMENT ON COLUMN accounts.accounts.target_orgs IS 'Default target organizations (can be overridden per project)';
COMMENT ON COLUMN accounts.accounts.target_company_sizes IS 'Target company sizes (e.g., Startup, SMB, Mid-Market, Enterprise)';
COMMENT ON COLUMN accounts.accounts.target_roles IS 'Default target buyer roles (can be overridden per project)';
COMMENT ON COLUMN accounts.accounts.competitors IS 'Known competitors in the market';
COMMENT ON COLUMN accounts.accounts.industry IS 'The industry or sector the company operates in';
