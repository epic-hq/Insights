-- Fix queue processors to properly handle Edge Function errors
-- Current issue: invoke_edge_function doesn't check HTTP response, messages deleted on failure

-- Create improved version that checks HTTP response status
CREATE OR REPLACE FUNCTION public.invoke_edge_function_with_retry(func_name text, payload jsonb)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  req_id bigint;
  response_status int;
  response_body text;
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
    RETURN false;
  END IF;

  -- Make HTTP request
  SELECT id INTO req_id
  FROM net.http_post(
    format('https://rbginqvgkonnoktrttqv.functions.supabase.co/%s', func_name),
    payload,
    '{}'::jsonb,
    jsonb_build_object(
      'Authorization', 'Bearer ' || supabase_anon_key,
      'Content-Type', 'application/json'
    ),
    30000  -- Increased timeout to 30 seconds for OpenAI calls
  );

  -- Wait a moment for response (pg_net is async)
  PERFORM pg_sleep(0.5);

  -- Check response status
  SELECT status_code, content::text
  INTO response_status, response_body
  FROM net.http_request_queue
  WHERE id = req_id;

  -- Log the response for debugging
  IF response_status IS NULL THEN
    RAISE WARNING 'No response received for % (req_id: %)', func_name, req_id;
    RETURN false;
  END IF;

  IF response_status >= 200 AND response_status < 300 THEN
    RETURN true;
  ELSE
    RAISE WARNING 'Edge function % failed with status %: %', func_name, response_status, response_body;
    RETURN false;
  END IF;
END;
$$;

-- Update embedding queue processor to handle errors
CREATE OR REPLACE FUNCTION public.process_embedding_queue()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  job record;
  success boolean;
  count_success int := 0;
  count_failed int := 0;
BEGIN
  FOR job IN
    SELECT * FROM pgmq.read(
      'insights_embedding_queue',
      10,  -- Increased batch size from 5 to 10
      60   -- Increased visibility timeout to 60 seconds
    )
  LOOP
    -- Try to invoke edge function
    success := public.invoke_edge_function_with_retry('embed', job.message::jsonb);

    IF success THEN
      -- Delete message only on success
      PERFORM pgmq.delete(
        'insights_embedding_queue',
        job.msg_id
      );
      count_success := count_success + 1;
    ELSE
      -- Message will become visible again after timeout
      count_failed := count_failed + 1;

      -- If read count is too high, archive the message to prevent infinite retries
      IF job.read_ct >= 5 THEN
        RAISE WARNING 'Archiving message % after % failed attempts', job.msg_id, job.read_ct;
        PERFORM pgmq.archive(
          'insights_embedding_queue',
          job.msg_id
        );
      END IF;
    END IF;
  END LOOP;

  RETURN format('Processed %s message(s): %s succeeded, %s failed',
                count_success + count_failed, count_success, count_failed);
END;
$$;

-- Update person facet embedding queue processor
CREATE OR REPLACE FUNCTION public.process_person_facet_embedding_queue()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  job record;
  success boolean;
  count_success int := 0;
  count_failed int := 0;
BEGIN
  FOR job IN
    SELECT * FROM pgmq.read(
      'person_facet_embedding_queue',
      10,  -- Increased batch size
      60   -- Increased visibility timeout
    )
  LOOP
    -- Try to invoke edge function
    success := public.invoke_edge_function_with_retry('embed-person-facet', job.message::jsonb);

    IF success THEN
      -- Delete message only on success
      PERFORM pgmq.delete(
        'person_facet_embedding_queue',
        job.msg_id
      );
      count_success := count_success + 1;
    ELSE
      -- Message will become visible again after timeout
      count_failed := count_failed + 1;

      -- Archive after 5 failed attempts
      IF job.read_ct >= 5 THEN
        RAISE WARNING 'Archiving person facet message % after % failed attempts', job.msg_id, job.read_ct;
        PERFORM pgmq.archive(
          'person_facet_embedding_queue',
          job.msg_id
        );
      END IF;
    END IF;
  END LOOP;

  RETURN format('Processed %s person facet message(s): %s succeeded, %s failed',
                count_success + count_failed, count_success, count_failed);
END;
$$;

-- Update facet embedding queue processor (for evidence facets)
CREATE OR REPLACE FUNCTION public.process_facet_embedding_queue()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  job record;
  success boolean;
  count_success int := 0;
  count_failed int := 0;
BEGIN
  FOR job IN
    SELECT * FROM pgmq.read(
      'facet_embedding_queue',
      10,
      60
    )
  LOOP
    success := public.invoke_edge_function_with_retry('embed-facet', job.message::jsonb);

    IF success THEN
      PERFORM pgmq.delete(
        'facet_embedding_queue',
        job.msg_id
      );
      count_success := count_success + 1;
    ELSE
      count_failed := count_failed + 1;

      IF job.read_ct >= 5 THEN
        RAISE WARNING 'Archiving facet message % after % failed attempts', job.msg_id, job.read_ct;
        PERFORM pgmq.archive(
          'facet_embedding_queue',
          job.msg_id
        );
      END IF;
    END IF;
  END LOOP;

  RETURN format('Processed %s facet message(s): %s succeeded, %s failed',
                count_success + count_failed, count_success, count_failed);
END;
$$;

COMMENT ON FUNCTION public.invoke_edge_function_with_retry IS 'Invokes Edge Function and returns true on success, false on failure';
COMMENT ON FUNCTION public.process_embedding_queue IS 'Process insights/themes embedding queue with error handling and retry logic';
COMMENT ON FUNCTION public.process_person_facet_embedding_queue IS 'Process person facet embedding queue with error handling and retry logic';
