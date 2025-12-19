-- Evidence Extraction Facet Kinds
-- Adds facet kinds used by BAML ExtractEvidenceFromTranscriptV2

INSERT INTO facet_kind_global (slug, label, description) VALUES
  ('goal', 'Goal', 'Desired outcomes or objectives the person wants to achieve'),
  ('pain', 'Pain', 'Problems, frustrations, or obstacles the person experiences'),
  ('behavior', 'Behavior', 'Actions, habits, or patterns of activity'),
  ('tool', 'Tool', 'Software, equipment, or resources the person uses'),
  ('value', 'Value', 'Principles, beliefs, or what matters to the person'),
  ('requirements', 'Requirements', 'Must-haves, constraints, or non-negotiables'),
  ('preference', 'Preference', 'Likes, dislikes, or favored approaches'),
  ('demographic', 'Demographic', 'Background information like role, experience, or context'),
  ('context', 'Context', 'Situational factors or environmental conditions'),
  ('artifact', 'Artifact', 'Documents, deliverables, or tangible outputs'),
  ('emotion', 'Emotion', 'Feelings, emotional responses, or sentiment signals'),
  ('workflow', 'Workflow', 'Processes, sequences, or ways of working')
ON CONFLICT (slug) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  updated_at = now();
