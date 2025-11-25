-- Fix RLS issue with register_project_section_kind trigger
-- The trigger needs SECURITY DEFINER to bypass RLS when auto-registering new section kinds

CREATE OR REPLACE FUNCTION public.register_project_section_kind()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Automatically add new kinds to the reference table for tracking
  INSERT INTO public.project_section_kinds (id)
  VALUES (NEW.kind)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
