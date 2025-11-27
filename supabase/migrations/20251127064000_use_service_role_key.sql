-- Use SERVICE_ROLE_KEY instead of ANON_KEY for Edge Function calls
-- This bypasses RLS and allows the Edge Function to update any table

CREATE OR REPLACE FUNCTION public.invoke_edge_function_async(func_name text, payload jsonb)
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
  req_id bigint;
  service_role_key text;
BEGIN
  -- Get service role key from vault (has full permissions)
  SELECT decrypted_secret
  INTO service_role_key
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_SERVICE_ROLE_KEY'
  ORDER BY created_at DESC
  LIMIT 1;

  IF service_role_key IS NULL THEN
    RAISE WARNING 'SUPABASE_SERVICE_ROLE_KEY not found in vault';
    RETURN NULL;
  END IF;

  -- Fire HTTP request with service role key
  req_id := net.http_post(
    format('https://rbginqvgkonnoktrttqv.functions.supabase.co/%s', func_name),
    payload,
    '{}'::jsonb,
    jsonb_build_object(
      'Authorization', 'Bearer ' || service_role_key,
      'Content-Type', 'application/json'
    ),
    30000
  );

  RETURN req_id;
END;
$$;

COMMENT ON FUNCTION public.invoke_edge_function_async IS 'Fire Edge Function request with service role key for full database access';
