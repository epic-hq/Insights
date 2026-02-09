-- Allow service_role to interact with pgmq queues used by interview triggers.
-- This is required for integration testing and backend workflows that run with service_role JWTs.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'pgmq') THEN
    GRANT USAGE ON SCHEMA pgmq TO service_role;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pgmq TO service_role;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA pgmq TO service_role;
    GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA pgmq TO service_role;
  END IF;
END
$$;
