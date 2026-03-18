-- Seed canonical global facet values for survey respondent profile selects.
-- These drive DB-backed dropdowns for job function, company industry, and company size.

INSERT INTO public.facet_kind_global (slug, label, description)
VALUES
  ('job_function', 'Job Function', 'Canonical job function values for people profiles and surveys.'),
  ('company_industry', 'Company Industry', 'Canonical industry values for organizations and respondent profiles.'),
  ('company_size', 'Company Size', 'Canonical company size ranges for organizations and respondent profiles.')
ON CONFLICT (slug) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  updated_at = now();

WITH kind_map AS (
  SELECT slug, id FROM public.facet_kind_global
)
INSERT INTO public.facet_global (kind_id, slug, label, synonyms, description)
SELECT
  km.id,
  datum.slug,
  datum.label,
  datum.synonyms,
  datum.description
FROM (
  VALUES
    ('job_function', 'job_function_engineering', 'Engineering', ARRAY['engineering'], 'Product engineering and software development roles'),
    ('job_function', 'job_function_product', 'Product', ARRAY['product'], 'Product management and product operations roles'),
    ('job_function', 'job_function_design', 'Design', ARRAY['design'], 'Product, brand, and UX design roles'),
    ('job_function', 'job_function_marketing', 'Marketing', ARRAY['marketing'], 'Demand gen, brand, and growth marketing roles'),
    ('job_function', 'job_function_sales', 'Sales', ARRAY['sales'], 'Sales and business development roles'),
    ('job_function', 'job_function_customer_success', 'Customer Success', ARRAY['customer success'], 'Customer success, support, and account management roles'),
    ('job_function', 'job_function_operations', 'Operations', ARRAY['operations'], 'Business, revenue, and internal operations roles'),
    ('job_function', 'job_function_finance', 'Finance', ARRAY['finance'], 'Finance and accounting roles'),
    ('job_function', 'job_function_hr', 'HR', ARRAY['hr','people'], 'People, talent, and HR roles'),
    ('job_function', 'job_function_legal', 'Legal', ARRAY['legal'], 'Legal and compliance roles'),
    ('job_function', 'job_function_data', 'Data', ARRAY['data','analytics'], 'Data science, analytics, and BI roles'),
    ('job_function', 'job_function_it', 'IT', ARRAY['it','information technology'], 'IT and systems administration roles'),
    ('job_function', 'job_function_research', 'Research', ARRAY['research'], 'UX, market, and academic research roles'),
    ('job_function', 'job_function_executive', 'Executive', ARRAY['executive','leadership'], 'Executive leadership roles'),
    ('job_function', 'job_function_other', 'Other', ARRAY['other'], 'Other or uncategorized job functions'),

    ('company_industry', 'company_industry_saas', 'SaaS / Software', ARRAY['saas','software'], 'Software and SaaS companies'),
    ('company_industry', 'company_industry_fintech', 'Fintech', ARRAY['fintech'], 'Financial technology companies'),
    ('company_industry', 'company_industry_healthcare', 'Healthcare', ARRAY['healthcare'], 'Healthcare providers and services'),
    ('company_industry', 'company_industry_healthtech', 'Healthcare Technology', ARRAY['healthtech'], 'Healthcare technology companies'),
    ('company_industry', 'company_industry_edtech', 'Education Technology', ARRAY['edtech'], 'Education technology companies'),
    ('company_industry', 'company_industry_ecommerce', 'E-commerce', ARRAY['ecommerce','e-commerce'], 'E-commerce and digital retail companies'),
    ('company_industry', 'company_industry_retail', 'Retail', ARRAY['retail'], 'Retail businesses'),
    ('company_industry', 'company_industry_manufacturing', 'Manufacturing', ARRAY['manufacturing'], 'Manufacturing and industrial companies'),
    ('company_industry', 'company_industry_logistics', 'Logistics', ARRAY['logistics','supply chain'], 'Logistics and supply chain companies'),
    ('company_industry', 'company_industry_real_estate', 'Real Estate', ARRAY['real estate'], 'Real estate businesses'),
    ('company_industry', 'company_industry_proptech', 'Real Estate Technology', ARRAY['proptech'], 'Property and real estate technology companies'),
    ('company_industry', 'company_industry_insurtech', 'Insurance Technology', ARRAY['insurtech'], 'Insurance technology companies'),
    ('company_industry', 'company_industry_cybersecurity', 'Cybersecurity', ARRAY['cybersecurity'], 'Cybersecurity companies'),
    ('company_industry', 'company_industry_ai_ml', 'AI / Machine Learning', ARRAY['ai','machine learning','ai/ml'], 'Artificial intelligence and ML companies'),
    ('company_industry', 'company_industry_biotech', 'Biotechnology', ARRAY['biotech'], 'Biotechnology companies'),
    ('company_industry', 'company_industry_cleantech', 'Clean Technology', ARRAY['cleantech'], 'Climate and clean technology companies'),
    ('company_industry', 'company_industry_agtech', 'Agriculture Technology', ARRAY['agtech'], 'Agriculture technology companies'),
    ('company_industry', 'company_industry_martech', 'Marketing Technology', ARRAY['martech'], 'Marketing technology companies'),
    ('company_industry', 'company_industry_hrtech', 'HR Technology', ARRAY['hrtech'], 'HR and people technology companies'),
    ('company_industry', 'company_industry_legaltech', 'Legal Technology', ARRAY['legaltech'], 'Legal technology companies'),
    ('company_industry', 'company_industry_media', 'Media & Entertainment', ARRAY['media','entertainment'], 'Media and entertainment companies'),
    ('company_industry', 'company_industry_gaming', 'Gaming', ARRAY['gaming'], 'Gaming companies'),
    ('company_industry', 'company_industry_travel', 'Travel & Hospitality', ARRAY['travel','hospitality'], 'Travel and hospitality companies'),
    ('company_industry', 'company_industry_automotive', 'Automotive', ARRAY['automotive'], 'Automotive companies'),
    ('company_industry', 'company_industry_energy', 'Energy', ARRAY['energy'], 'Energy companies'),
    ('company_industry', 'company_industry_telecom', 'Telecommunications', ARRAY['telecom','telecommunications'], 'Telecommunications companies'),
    ('company_industry', 'company_industry_consulting', 'Consulting', ARRAY['consulting'], 'Consulting and services companies'),
    ('company_industry', 'company_industry_other', 'Other', ARRAY['other'], 'Other or uncategorized industries'),

    ('company_size', 'company_size_1_10', '1-10', ARRAY['startup (1-10)'], 'Very small organizations with 1-10 employees'),
    ('company_size', 'company_size_11_50', '11-50', ARRAY['small business (11-50)'], 'Small organizations with 11-50 employees'),
    ('company_size', 'company_size_51_200', '51-200', ARRAY['smb (51-200)'], 'SMB organizations with 51-200 employees'),
    ('company_size', 'company_size_201_500', '201-500', ARRAY['mid-market (201-500)'], 'Mid-market organizations with 201-500 employees'),
    ('company_size', 'company_size_501_1000', '501-1000', ARRAY['mid-market (501-1000)'], 'Mid-market organizations with 501-1000 employees'),
    ('company_size', 'company_size_1001_5000', '1001-5000', ARRAY['enterprise (1001-5000)'], 'Enterprise organizations with 1001-5000 employees'),
    ('company_size', 'company_size_5001_10000', '5001-10000', ARRAY['large enterprise (5001-10000)'], 'Large enterprise organizations with 5001-10000 employees'),
    ('company_size', 'company_size_10000_plus', '10000+', ARRAY['large enterprise (10000+)'], 'Organizations with more than 10000 employees')
) AS datum(kind_slug, slug, label, synonyms, description)
JOIN kind_map km ON km.slug = datum.kind_slug
ON CONFLICT (slug) DO UPDATE SET
  label = EXCLUDED.label,
  synonyms = EXCLUDED.synonyms,
  description = EXCLUDED.description,
  updated_at = now();
