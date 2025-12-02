-- Drop upload_jobs table
-- This table has been fully replaced by interviews.processing_metadata
-- All upload progress tracking now happens via processing_metadata JSONB column

-- Drop upload_jobs table and all dependencies
DROP TABLE IF EXISTS upload_jobs CASCADE;

-- Keep job_status enum for backwards compatibility with analysis_jobs
-- (will be removed in future when analysis_jobs is refactored)
