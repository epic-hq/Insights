-- Add BANT facet kinds for sales-lens feature
-- Specify explicit IDs to avoid conflicts with auto-generated sequence
DO $$
BEGIN
  -- Insert budget_range with explicit ID
  INSERT INTO facet_kind_global (id, slug, label, description, created_at, updated_at)
  VALUES (2, 'budget_range', 'Budget Range', 'Budget commitment and spending authority', now(), now())
  ON CONFLICT (slug) DO NOTHING;

  -- Insert decision_authority with explicit ID
  INSERT INTO facet_kind_global (id, slug, label, description, created_at, updated_at)
  VALUES (3, 'decision_authority', 'Decision Authority', 'Decision-making power and approval levels', now(), now())
  ON CONFLICT (slug) DO NOTHING;

  -- Insert timeline_urgency with explicit ID
  INSERT INTO facet_kind_global (id, slug, label, description, created_at, updated_at)
  VALUES (4, 'timeline_urgency', 'Timeline Urgency', 'Purchase urgency and timing signals', now(), now())
  ON CONFLICT (slug) DO NOTHING;

  -- Update sequence to avoid future conflicts
  PERFORM setval('facet_kind_global_id_seq', (SELECT MAX(id) FROM facet_kind_global));
END $$;
