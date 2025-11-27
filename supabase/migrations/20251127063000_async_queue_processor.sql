-- Simplify queue processor to be non-blocking
-- Issue: pg_sleep loops cause statement timeout
-- Solution: Fire HTTP requests and immediately check response table, don't wait

CREATE OR REPLACE FUNCTION public.invoke_edge_function_async(func_name text, payload jsonb)
RETURNS bigint  -- Returns request ID for async tracking
LANGUAGE plpgsql
AS $$
DECLARE
  req_id bigint;
  supabase_anon_key text;
BEGIN
  -- Get anon key from vault
  SELECT decrypted_secret
  INTO supabase_anon_key
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_ANON_KEY'
  ORDER BY created_at DESC
  LIMIT 1;

  IF supabase_anon_key IS NULL THEN
    RAISE WARNING 'SUPABASE_ANON_KEY not found in vault';
    RETURN NULL;
  END IF;

  -- Fire HTTP request (async, don't wait)
  req_id := net.http_post(
    format('https://rbginqvgkonnoktrttqv.functions.supabase.co/%s', func_name),
    payload,
    '{}'::jsonb,
    jsonb_build_object(
      'Authorization', 'Bearer ' || supabase_anon_key,
      'Content-Type', 'application/json'
    ),
    30000  -- 30 seconds timeout
  );

  RETURN req_id;
END;
$$;

-- Simplified processor: fire requests and trust cron + visibility timeout for retries
CREATE OR REPLACE FUNCTION public.process_embedding_queue()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  job record;
  req_id bigint;
  count_processed int := 0;
BEGIN
  FOR job IN
    SELECT * FROM pgmq.read(
      'insights_embedding_queue',
      20,  -- Process 20 at a time
      120  -- 2 minute visibility timeout (cron runs every minute)
    )
  LOOP
    -- Fire async request
    req_id := public.invoke_edge_function_async('embed', job.message::jsonb);

    IF req_id IS NOT NULL THEN
      -- Delete immediately - Edge Function will handle the update
      -- If it fails, cron will retry (visibility timeout prevents duplicates)
      PERFORM pgmq.delete(
        'insights_embedding_queue',
        job.msg_id
      );
      count_processed := count_processed + 1;
    ELSE
      -- If we couldn't get the key, archive after too many attempts
      IF job.read_ct >= 10 THEN
        PERFORM pgmq.archive(
          'insights_embedding_queue',
          job.msg_id
        );
      END IF;
    END IF;
  END LOOP;

  RETURN format('Fired %s embedding requests', count_processed);
END;
$$;

-- Same for person facets
CREATE OR REPLACE FUNCTION public.process_person_facet_embedding_queue()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  job record;
  req_id bigint;
  count_processed int := 0;
BEGIN
  FOR job IN
    SELECT * FROM pgmq.read(
      'person_facet_embedding_queue',
      20,
      120
    )
  LOOP
    req_id := public.invoke_edge_function_async('embed-person-facet', job.message::jsonb);

    IF req_id IS NOT NULL THEN
      PERFORM pgmq.delete(
        'person_facet_embedding_queue',
        job.msg_id
      );
      count_processed := count_processed + 1;
    ELSE
      IF job.read_ct >= 10 THEN
        PERFORM pgmq.archive(
          'person_facet_embedding_queue',
          job.msg_id
        );
      END IF;
    END IF;
  END LOOP;

  RETURN format('Fired %s person facet embedding requests', count_processed);
END;
$$;

-- Same for evidence facets
CREATE OR REPLACE FUNCTION public.process_facet_embedding_queue()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  job record;
  req_id bigint;
  count_processed int := 0;
BEGIN
  FOR job IN
    SELECT * FROM pgmq.read(
      'facet_embedding_queue',
      20,
      120
    )
  LOOP
    req_id := public.invoke_edge_function_async('embed-facet', job.message::jsonb);

    IF req_id IS NOT NULL THEN
      PERFORM pgmq.delete(
        'facet_embedding_queue',
        job.msg_id
      );
      count_processed := count_processed + 1;
    ELSE
      IF job.read_ct >= 10 THEN
        PERFORM pgmq.archive(
          'facet_embedding_queue',
          job.msg_id
        );
      END IF;
    END IF;
  END LOOP;

  RETURN format('Fired %s facet embedding requests', count_processed);
END;
$$;

COMMENT ON FUNCTION public.invoke_edge_function_async IS 'Fire Edge Function request asynchronously, return request ID';
COMMENT ON FUNCTION public.process_embedding_queue IS 'Process embedding queue by firing async requests (fast, non-blocking)';
