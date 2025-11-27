-- Fix invoke_edge_function_with_retry to use correct response table

CREATE OR REPLACE FUNCTION public.invoke_edge_function_with_retry(func_name text, payload jsonb)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  req_id bigint;
  response_status int;
  response_content text;
  response_error text;
  response_timeout boolean;
  supabase_anon_key text;
  wait_counter int := 0;
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

  -- Make HTTP request (returns request ID directly)
  req_id := net.http_post(
    format('https://rbginqvgkonnoktrttqv.functions.supabase.co/%s', func_name),
    payload,
    '{}'::jsonb,
    jsonb_build_object(
      'Authorization', 'Bearer ' || supabase_anon_key,
      'Content-Type', 'application/json'
    ),
    30000  -- 30 seconds timeout for OpenAI calls
  );

  -- Wait for response (pg_net is async) - poll up to 35 seconds
  LOOP
    SELECT status_code, content, error_msg, timed_out
    INTO response_status, response_content, response_error, response_timeout
    FROM net._http_response
    WHERE id = req_id;

    -- Exit if we got a response
    EXIT WHEN response_status IS NOT NULL OR response_timeout IS NOT NULL OR response_error IS NOT NULL;

    -- Wait 1 second between checks
    PERFORM pg_sleep(1);
    wait_counter := wait_counter + 1;

    -- Give up after 35 seconds
    IF wait_counter >= 35 THEN
      RAISE WARNING 'Timeout waiting for response from % (req_id: %)', func_name, req_id;
      RETURN false;
    END IF;
  END LOOP;

  -- Check for timeout
  IF response_timeout THEN
    RAISE WARNING 'Edge function % timed out (req_id: %)', func_name, req_id;
    RETURN false;
  END IF;

  -- Check for error
  IF response_error IS NOT NULL THEN
    RAISE WARNING 'Edge function % error: % (req_id: %)', func_name, response_error, req_id;
    RETURN false;
  END IF;

  -- Check status code
  IF response_status >= 200 AND response_status < 300 THEN
    RETURN true;
  ELSE
    RAISE WARNING 'Edge function % failed with status %: % (req_id: %)',
                  func_name, response_status, LEFT(response_content, 200), req_id;
    RETURN false;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.invoke_edge_function_with_retry IS 'Invokes Edge Function via pg_net and waits for response, returns true on success';
