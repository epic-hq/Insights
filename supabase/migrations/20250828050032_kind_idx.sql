CREATE INDEX idx_project_sections_project_id_kind_key ON public.project_sections USING btree (project_id, kind);


