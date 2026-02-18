-- Add company_size and company_industry facet kinds
-- These enable person-level facets derived from organization data

INSERT INTO facet_kind_global (slug, label, description) VALUES
  ('company_size', 'Company Size', 'Size range of the person''s organization (e.g. 51-200, 1001-5000). Derived from organizations table.'),
  ('company_industry', 'Company Industry', 'Industry of the person''s organization. Derived from organizations table.')
ON CONFLICT (slug) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  updated_at = now();

-- Standardize existing organizations.size_range values to numeric ranges
UPDATE organizations SET size_range = CASE
  WHEN lower(size_range) IN ('small', 'startup', 'micro') THEN '1-10'
  WHEN lower(size_range) IN ('smb', 'small business') THEN '11-50'
  WHEN lower(size_range) IN ('mid-market', 'midmarket', 'medium') THEN '201-500'
  WHEN lower(size_range) IN ('enterprise', 'large') THEN '1001-5000'
  WHEN lower(size_range) IN ('large enterprise') THEN '5001-10000'
  WHEN size_range ~ '^\d+-\d+$' THEN size_range
  WHEN size_range ~ '^\d+\+$' THEN size_range
  ELSE size_range
END
WHERE size_range IS NOT NULL;

-- Add comment documenting valid size_range values
COMMENT ON COLUMN organizations.size_range IS 'Standard ranges: 1-10, 11-50, 51-200, 201-500, 501-1000, 1001-5000, 5001-10000, 10000+';
