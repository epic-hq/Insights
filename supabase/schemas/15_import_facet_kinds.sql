-- Additional Facet Kinds for CRM Import
-- Adds facet kinds for imported spreadsheet data fields
-- Used by importPeopleFromTable for flexible column-to-facet mapping

INSERT INTO facet_kind_global (slug, label, description) VALUES
  ('job_title', 'Job Title', 'Raw job title text (e.g. VP of Engineering). Distinct from AI-inferred job_function.'),
  ('job_function', 'Job Function', 'Canonical job function values for people profiles and surveys.'),
  ('role', 'Role', 'Job function or role within organization'),
  ('industry', 'Industry', 'Industry or sector'),
  ('location', 'Location', 'Geographic location or region'),
  ('use_case', 'Use Case', 'Primary use case or application'),
  ('event', 'Event', 'Event signup or attendance'),
  ('survey_response', 'Survey Response', 'Answer to a survey or form question'),
  ('preference', 'Preference', 'User preference or interest'),
  ('custom', 'Custom', 'Custom attribute from imported data'),
  ('membership_status', 'Membership Status', 'Membership state imported from CRM or survey data (e.g. active, expired, true).'),
  ('membership_year', 'Membership Year', 'Membership year or cohort imported from CRM or survey data.'),
  ('membership_expiration', 'Membership Expiration', 'Membership expiration date imported from CRM or survey data.'),
  ('company_size', 'Company Size', 'Size range of the person''s organization (e.g. 51-200, 1001-5000). Derived from organizations table.'),
  ('company_industry', 'Company Industry', 'Industry of the person''s organization. Derived from organizations table.')
ON CONFLICT (slug) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  updated_at = now();
