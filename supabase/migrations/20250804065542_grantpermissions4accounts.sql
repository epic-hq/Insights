-- fix grants?
GRANT USAGE ON SCHEMA accounts to authenticated;
GRANT USAGE ON SCHEMA accounts to service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE accounts.accounts TO authenticated, service_role;