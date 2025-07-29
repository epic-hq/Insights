-- Ensure pg_cron extension is available (Supabase uses the "extensions" schema)
create extension if not exists pg_cron with schema extensions;

-- Make sure we can reference the cron tables/functions without schema prefix
set search_path = public, extensions;

-- -----------------------------------------------------------------------------
-- Schedule the embedding-queue processor to run every minute.
-- Use an idempotent DO block so the migration can be rerun safely.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  _exists boolean;
BEGIN
  -- Check if a cron job already exists for process_embedding_queue
  SELECT EXISTS (
    SELECT 1
    FROM cron.job
    WHERE command = 'select public.process_embedding_queue()'
  ) INTO _exists;

  IF NOT _exists THEN
    PERFORM cron.schedule('*/1 * * * *', 'select public.process_embedding_queue()');
  END IF;
END;
$$;
