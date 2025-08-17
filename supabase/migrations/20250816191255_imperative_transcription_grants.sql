-- Imperative SQL statements that cannot be handled by supabase db diff
-- These statements must be run manually after migrations
-- Run: psql $DATABASE_URL -f supabase/migrations/20250816191255_imperative_transcription_grants.sql

-- Make statements idempotent where possible
-- Organize by section and add comments for clarity

-- ===== TRANSCRIPTION PIPELINE =====
-- Service role grants for job queue workers
-- From: supabase/schemas/80_transcription_pipeline.sql

-- Grant permissions for upload_jobs table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'upload_jobs') THEN
        GRANT SELECT, INSERT, UPDATE ON upload_jobs TO service_role;
    END IF;
END$$;

-- Grant permissions for analysis_jobs table  
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'analysis_jobs') THEN
        GRANT SELECT, INSERT, UPDATE ON analysis_jobs TO service_role;
    END IF;
END$$;