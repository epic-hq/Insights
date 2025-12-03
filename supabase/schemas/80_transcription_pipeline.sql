-- ============================================================================
-- DEPRECATED: analysis_jobs table has been consolidated into interviews.conversation_analysis
-- Migration: 20251202150000_consolidate_analysis_jobs.sql
-- Date: December 2, 2024
-- ============================================================================
--
-- All workflow state, progress tracking, and metadata previously stored in
-- analysis_jobs is now in the interviews.conversation_analysis JSONB column:
--
-- interviews.conversation_analysis structure:
-- {
--   "trigger_run_id": "run_xxx",          -- Trigger.dev run ID
--   "workflow_state": {                   -- V2 modular workflow state
--     "interviewId": "uuid",
--     "evidenceIds": ["uuid", ...],
--     "evidenceUnits": [...],
--     "personId": "uuid",
--     "completedSteps": ["upload", "evidence", ...],
--     "currentStep": "insights",
--     "lastUpdated": "timestamp"
--   },
--   "completed_steps": ["upload", ...],   -- Top-level for convenience
--   "current_step": "insights",           -- Top-level for convenience
--   "progress": 75,                       -- 0-100
--   "status_detail": "Generating insights...",
--   "last_error": "error message",
--   "custom_instructions": "user instructions",
--   "transcript_data": {...},             -- From upload flow
--   "canceled_at": "timestamp",
--   "failed_at": "timestamp"
-- }
--
-- interviews.processing_metadata is also used for some processing state
-- ============================================================================

-- Job status enum (kept for backwards compatibility with existing code)
DO $$ BEGIN
  CREATE TYPE job_status AS ENUM ('pending','in_progress','done','error','retry');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
