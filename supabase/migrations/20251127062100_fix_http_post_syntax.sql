-- Fix invoke_edge_function_with_retry - net.http_post returns bigint directly

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

  -- Make HTTP request (returns request ID directly)
  req_id := net.http_post(
    format('https://rbginqvgkonnoktrttqv.functions.supabase.co/%s', func_name),
    payload,
    '{}'::jsonb,
    jsonb_build_object(
      'Authorization', 'Bearer ' || supabase_anon_key,
      'Content-Type', 'application/json'
    ),
    30000  -- Increased timeout to 30 seconds for OpenAI calls
  );

  -- Wait for response (pg_net is async)
  PERFORM pg_sleep(1);

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
    RAISE WARNING 'Edge function % failed with status %: %', func_name, response_status, LEFT(response_body, 200);
    RETURN false;
  END IF;
END;
$$;
