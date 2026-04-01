INSERT INTO public.facet_kind_global (slug, label, description)
VALUES
  ('membership_status', 'Membership Status', 'Membership state imported from CRM or survey data (e.g. active, expired, true).'),
  ('membership_year', 'Membership Year', 'Membership year or cohort imported from CRM or survey data.'),
  ('membership_expiration', 'Membership Expiration', 'Membership expiration date imported from CRM or survey data.')
ON CONFLICT (slug) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  updated_at = now();
