-- Fix auto_cleanup_jobs_on_ready function to remove any old upload_jobs references
-- The trigger was previously trying to update a deleted upload_jobs table

-- Drop and recreate the function to ensure clean state
DROP TRIGGER IF EXISTS trigger_cleanup_jobs_on_ready ON public.interviews;
DROP FUNCTION IF EXISTS public.auto_cleanup_jobs_on_ready();

-- Recreate the function without upload_jobs references
CREATE OR REPLACE FUNCTION public.auto_cleanup_jobs_on_ready()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'ready' AND (OLD.status IS NULL OR OLD.status != 'ready') THEN
    -- Ensure processing_metadata is set correctly
    NEW.processing_metadata = jsonb_set(COALESCE(NEW.processing_metadata, '{}'::jsonb), '{completed_at}', to_jsonb(NOW()::text));
    NEW.processing_metadata = jsonb_set(NEW.processing_metadata, '{current_step}', '"complete"');
    NEW.processing_metadata = jsonb_set(NEW.processing_metadata, '{progress}', '100');

    -- Ensure conversation_analysis is updated
    NEW.conversation_analysis = jsonb_set(COALESCE(NEW.conversation_analysis, '{}'::jsonb), '{current_step}', '"complete"');
    NEW.conversation_analysis = jsonb_set(NEW.conversation_analysis, '{progress}', '100');
    NEW.conversation_analysis = jsonb_set(NEW.conversation_analysis, '{status_detail}', '"Analysis complete"');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER trigger_cleanup_jobs_on_ready
  BEFORE UPDATE ON public.interviews
  FOR EACH ROW
  WHEN (NEW.status = 'ready')
  EXECUTE FUNCTION public.auto_cleanup_jobs_on_ready();
