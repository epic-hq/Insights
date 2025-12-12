-- Additional Facet Kinds for CRM Import
-- Adds facet kinds for imported spreadsheet data fields

INSERT INTO facet_kind_global (slug, label, description) VALUES
  ('role', 'Role', 'Job function or role within organization'),
  ('industry', 'Industry', 'Industry or sector'),
  ('location', 'Location', 'Geographic location or region'),
  ('company_size', 'Company Size', 'Size of company by employees or revenue'),
  ('use_case', 'Use Case', 'Primary use case or application')
ON CONFLICT (slug) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  updated_at = now();
