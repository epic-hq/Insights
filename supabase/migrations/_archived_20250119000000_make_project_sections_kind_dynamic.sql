-- Make project_sections.kind field dynamic by removing FK constraint
-- This allows creation of arbitrary document types without schema changes

-- Drop the foreign key constraint on project_sections.kind
ALTER TABLE public.project_sections
  DROP CONSTRAINT IF EXISTS project_sections_kind_fkey;

-- Add a comment explaining the new flexible system
COMMENT ON COLUMN public.project_sections.kind IS
  'Document type identifier. Can be any text value. Common types are tracked in project_section_kinds table for reference, but FK constraint is removed to allow dynamic document types like positioning_statement, seo_strategy, etc.';

-- Keep project_section_kinds table as a reference/catalog but make it optional
COMMENT ON TABLE public.project_section_kinds IS
  'Reference catalog of common document types. Not enforced via FK - any kind value is allowed in project_sections.';

-- Add index on kind for performance since we removed the FK index
CREATE INDEX IF NOT EXISTS idx_project_sections_kind ON public.project_sections(kind);

-- Add a function to auto-register new kinds (optional - for tracking)
CREATE OR REPLACE FUNCTION public.register_project_section_kind()
RETURNS TRIGGER AS $$
BEGIN
  -- Automatically add new kinds to the reference table for tracking
  INSERT INTO public.project_section_kinds (id)
  VALUES (NEW.kind)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-register new kinds (optional - can be disabled if not wanted)
DROP TRIGGER IF EXISTS trg_register_section_kind ON public.project_sections;
CREATE TRIGGER trg_register_section_kind
  AFTER INSERT ON public.project_sections
  FOR EACH ROW
  EXECUTE FUNCTION public.register_project_section_kind();
