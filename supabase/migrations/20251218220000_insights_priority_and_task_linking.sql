-- Add priority column to themes table for insight triage
-- 1 = High, 2 = Medium, 3 = Low (matches task priority)
ALTER TABLE public.themes
ADD COLUMN IF NOT EXISTS priority integer DEFAULT 3;

ALTER TABLE public.themes
ADD CONSTRAINT themes_priority_check
CHECK (priority >= 1 AND priority <= 3) NOT VALID;

ALTER TABLE public.themes VALIDATE CONSTRAINT themes_priority_check;

-- Add source_theme_id to tasks table for linking tasks back to insights
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS source_theme_id uuid REFERENCES public.themes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_source_theme
ON public.tasks(source_theme_id)
WHERE source_theme_id IS NOT NULL;
