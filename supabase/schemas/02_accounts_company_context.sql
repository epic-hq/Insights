-- Company Context for Accounts
-- Stores account-level company information that's inherited by all projects
-- This is set once during account setup and used as context for AI operations

-- Add company context columns to accounts table
ALTER TABLE accounts.accounts ADD COLUMN IF NOT EXISTS website_url text;
ALTER TABLE accounts.accounts ADD COLUMN IF NOT EXISTS company_description text;
ALTER TABLE accounts.accounts ADD COLUMN IF NOT EXISTS customer_problem text;
ALTER TABLE accounts.accounts ADD COLUMN IF NOT EXISTS offerings text[];
ALTER TABLE accounts.accounts ADD COLUMN IF NOT EXISTS target_industries text[];
ALTER TABLE accounts.accounts ADD COLUMN IF NOT EXISTS target_company_sizes text[];
ALTER TABLE accounts.accounts ADD COLUMN IF NOT EXISTS target_roles text[];
ALTER TABLE accounts.accounts ADD COLUMN IF NOT EXISTS competitors text[];
ALTER TABLE accounts.accounts ADD COLUMN IF NOT EXISTS industry text;

-- Comments for documentation
COMMENT ON COLUMN accounts.accounts.website_url IS 'Company website URL for auto-research via Exa.ai';
COMMENT ON COLUMN accounts.accounts.company_description IS 'Brief description of what the company does (1-2 sentences)';
COMMENT ON COLUMN accounts.accounts.customer_problem IS 'The main problem or pain point the company solves for customers';
COMMENT ON COLUMN accounts.accounts.offerings IS 'Array of main products or services offered';
COMMENT ON COLUMN accounts.accounts.target_industries IS 'Industries the company serves (e.g., Healthcare, Fintech)';
COMMENT ON COLUMN accounts.accounts.target_company_sizes IS 'Company sizes targeted (e.g., Startup, SMB, Enterprise)';
COMMENT ON COLUMN accounts.accounts.target_roles IS 'Job roles/titles of target buyers (e.g., Product Manager, CTO)';
COMMENT ON COLUMN accounts.accounts.competitors IS 'Known competitors in the market';
COMMENT ON COLUMN accounts.accounts.industry IS 'The industry or sector the company operates in (e.g., B2B SaaS)';
