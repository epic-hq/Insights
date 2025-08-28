-- Clean up duplicate project_sections before adding unique constraint
-- Keep only the most recent entry for each (project_id, kind) pair
DELETE FROM public.project_sections 
WHERE id NOT IN (
    SELECT DISTINCT ON (project_id, kind) id
    FROM public.project_sections
    ORDER BY project_id, kind, created_at DESC
);

-- Now create the unique index
CREATE UNIQUE INDEX idx_project_sections_project_id_kind_unique ON public.project_sections USING btree (project_id, kind);


