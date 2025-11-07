-- BANT Facet Kinds for Sales Qualification
-- Adds facet kinds for Budget, Authority, Need, Timing analysis

INSERT INTO facet_kind_global (slug, label, description) VALUES
  ('budget_range', 'Budget Range', 'Budget commitment and spending authority'),
  ('decision_authority', 'Decision Authority', 'Decision-making power and approval levels'),
  ('timeline_urgency', 'Timeline Urgency', 'Purchase urgency and timing signals')
ON CONFLICT (slug) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  updated_at = now();
