-- Add company context columns to accounts table
-- These are set once during account setup and used as context for AI operations

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
COMMENT ON COLUMN accounts.accounts.website_url IS 'Company website URL for auto-research';
COMMENT ON COLUMN accounts.accounts.company_description IS 'Brief description of what the company does';
COMMENT ON COLUMN accounts.accounts.customer_problem IS 'The main problem or pain point the company solves';
COMMENT ON COLUMN accounts.accounts.offerings IS 'Array of main products or services offered';
COMMENT ON COLUMN accounts.accounts.target_industries IS 'Industries the company serves';
COMMENT ON COLUMN accounts.accounts.target_company_sizes IS 'Company sizes targeted (Startup, SMB, Enterprise)';
COMMENT ON COLUMN accounts.accounts.target_roles IS 'Job roles/titles of target buyers';
COMMENT ON COLUMN accounts.accounts.competitors IS 'Known competitors in the market';
COMMENT ON COLUMN accounts.accounts.industry IS 'The industry or sector the company operates in';
