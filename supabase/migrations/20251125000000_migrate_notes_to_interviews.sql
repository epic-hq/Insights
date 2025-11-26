-- Migrate notes from project_sections to interviews table
-- This makes notes consistent with other interview-like content

INSERT INTO interviews (
  id,
  account_id,
  project_id,
  title,
  observations_and_notes,
  source_type,
  media_type,
  status,
  conversation_analysis,
  created_at,
  updated_at
)
SELECT
  ps.id,
  p.account_id,
  ps.project_id,
  ps.meta->>'title' as title,
  ps.content_md as observations_and_notes,
  'note' as source_type,
  COALESCE(ps.meta->>'note_type', 'note') as media_type,
  'ready' as status,
  jsonb_build_object(
    'note_type', ps.meta->>'note_type',
    'associations', ps.meta->'associations',
    'tags', ps.meta->'tags'
  ) as conversation_analysis,
  ps.created_at,
  ps.updated_at
FROM project_sections ps
JOIN projects p ON p.id = ps.project_id
WHERE ps.kind LIKE 'note_%'
ON CONFLICT (id) DO NOTHING;

-- Clean up migrated notes from project_sections
DELETE FROM project_sections WHERE kind LIKE 'note_%';
