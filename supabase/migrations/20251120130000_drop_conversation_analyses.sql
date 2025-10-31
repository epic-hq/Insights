-- Drop legacy conversation analysis artifacts now that analysis lives on interviews
DO $$BEGIN
  DROP TABLE IF EXISTS public.conversation_analyses;
EXCEPTION WHEN undefined_table THEN
  NULL;
END$$;

DO $$BEGIN
  DROP TYPE IF EXISTS public.conversation_analysis_status;
EXCEPTION WHEN undefined_object THEN
  NULL;
END$$;
