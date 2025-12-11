-- Make content_md nullable so structured data can be stored in meta only
ALTER TABLE public.project_sections ALTER COLUMN content_md DROP NOT NULL;
