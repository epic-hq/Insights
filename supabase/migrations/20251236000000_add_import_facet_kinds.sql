-- Additional Facet Kinds for CRM Import
-- Adds facet kinds for imported spreadsheet data fields
-- Used by importPeopleFromTable for flexible column-to-facet mapping

INSERT INTO facet_kind_global (slug, label, description) VALUES
  ('event', 'Event', 'Event signup or attendance'),
  ('survey_response', 'Survey Response', 'Answer to a survey or form question'),
  ('custom', 'Custom', 'Custom attribute from imported data')
ON CONFLICT (slug) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  updated_at = now();
