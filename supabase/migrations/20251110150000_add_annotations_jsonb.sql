-- Add JSONB field for structured annotation data
-- Migration: Add content_jsonb and related fields to annotations table

-- Add new columns
ALTER TABLE public.annotations
ADD COLUMN IF NOT EXISTS content_jsonb JSONB NULL,
ADD COLUMN IF NOT EXISTS updated_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS resolved_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS reaction_type TEXT NULL;

-- Add GIN indexes for efficient JSONB querying
CREATE INDEX IF NOT EXISTS idx_annotations_content_jsonb_gin
ON public.annotations USING GIN (content_jsonb);

CREATE INDEX IF NOT EXISTS idx_annotations_content_jsonb_path
ON public.annotations USING GIN (content_jsonb jsonb_path_ops);

-- Composite index for AI suggestions lookup
CREATE INDEX IF NOT EXISTS idx_annotations_ai_suggestions
ON public.annotations (entity_type, entity_id, annotation_type, created_at DESC)
WHERE created_by_ai = true AND status = 'active';

-- Index for unresolved todos
CREATE INDEX IF NOT EXISTS idx_annotations_todos_unresolved
ON public.annotations (project_id, entity_id, due_date)
WHERE annotation_type = 'todo' AND resolved_at IS NULL;

-- Index for reaction types
CREATE INDEX IF NOT EXISTS idx_annotations_reactions
ON public.annotations (entity_type, entity_id, reaction_type)
WHERE annotation_type = 'reaction' AND status = 'active';

-- Migrate existing AI suggestion data from content (text) to content_jsonb
-- Only migrate valid JSON strings
UPDATE public.annotations
SET content_jsonb = content::jsonb
WHERE annotation_type = 'ai_suggestion'
  AND content IS NOT NULL
  AND content != ''
  AND content LIKE '{%'
  AND content_jsonb IS NULL;

-- Add comment explaining the dual fields
COMMENT ON COLUMN public.annotations.content IS 'Plain text content for comments, notes, etc. Use content_jsonb for structured data like AI suggestions.';
COMMENT ON COLUMN public.annotations.content_jsonb IS 'Structured JSONB content for AI suggestions, complex todos, etc. Enables efficient querying and indexing.';
COMMENT ON COLUMN public.annotations.updated_by_user_id IS 'User who last updated this annotation (for edit tracking).';
COMMENT ON COLUMN public.annotations.resolved_at IS 'Timestamp when todo was completed or issue resolved.';
COMMENT ON COLUMN public.annotations.resolved_by_user_id IS 'User who resolved/completed this annotation.';
COMMENT ON COLUMN public.annotations.due_date IS 'Due date for todo-type annotations.';
COMMENT ON COLUMN public.annotations.reaction_type IS 'Type of reaction emoji (👍, ❤️, etc.) for reaction-type annotations.';
