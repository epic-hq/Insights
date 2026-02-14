-- Additional Facet Kinds for CRM Import
-- Adds facet kinds for imported spreadsheet data fields
-- Used by importPeopleFromTable for flexible column-to-facet mapping
--
-- Note: company_stage and company_size are stored on organizations table,
-- not as facets. See: organizations.company_type, organizations.size_range

INSERT INTO facet_kind_global (slug, label, description) VALUES
  ('job_title', 'Job Title', 'Raw job title text (e.g. VP of Engineering). Distinct from AI-inferred job_function.'),
  ('role', 'Role', 'Job function or role within organization'),
  ('industry', 'Industry', 'Industry or sector'),
  ('location', 'Location', 'Geographic location or region'),
  ('use_case', 'Use Case', 'Primary use case or application'),
  ('event', 'Event', 'Event signup or attendance'),
  ('survey_response', 'Survey Response', 'Answer to a survey or form question'),
  ('preference', 'Preference', 'User preference or interest'),
  ('custom', 'Custom', 'Custom attribute from imported data')
ON CONFLICT (slug) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  updated_at = now();
