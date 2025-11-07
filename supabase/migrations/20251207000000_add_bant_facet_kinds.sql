-- Add BANT facet kinds for sales-lens feature
INSERT INTO facet_kind_global (slug, label, description) VALUES
  ('budget_range', 'Budget Range', 'Budget commitment and spending authority'),
  ('decision_authority', 'Decision Authority', 'Decision-making power and approval levels'),
  ('timeline_urgency', 'Timeline Urgency', 'Purchase urgency and timing signals')
ON CONFLICT (slug) DO NOTHING;
