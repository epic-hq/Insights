-- =====================================================================
-- Consolidate Analysis Jobs into Interviews Table
-- =====================================================================
-- Both upload_jobs and analysis_jobs tables are being consolidated into
-- the interviews table using existing columns:
-- - interviews.status (interview_status enum)
-- - interviews.conversation_analysis (jsonb)
--
-- The conversation_analysis JSONB column will store:
-- - Upload metadata (file_name, external_url, assemblyai_id)
-- - Processing workflow state (current_step, completed_steps)
-- - Trigger.dev run tracking (trigger_run_id)
-- - Custom instructions
-- - Error information
-- =====================================================================

-- First, ensure all interviews have their analysis_jobs data migrated
-- to conversation_analysis JSONB column

UPDATE interviews
SET conversation_analysis = COALESCE(conversation_analysis, '{}'::jsonb) || jsonb_build_object(
    'trigger_run_id', aj.trigger_run_id,
    'workflow_state', aj.workflow_state,
    'completed_steps', aj.completed_steps,
    'current_step', aj.current_step,
    'evidence_count', aj.evidence_count,
    'custom_instructions', aj.custom_instructions,
    'last_error', aj.last_error,
    'transcript_data', aj.transcript_data,
    'migrated_from_analysis_job', aj.id,
    'migrated_at', now()
)
FROM analysis_jobs aj
WHERE interviews.id = aj.interview_id
  AND aj.status IN ('pending', 'in_progress', 'done', 'error', 'retry');

-- Drop analysis_jobs table
-- All tracking is now in interviews.status and interviews.conversation_analysis
DROP TABLE IF EXISTS analysis_jobs CASCADE;

-- =====================================================================
-- Documentation
-- =====================================================================
-- The interviews table now uses:
--
-- 1. interviews.status (enum) for high-level state:
--    - draft, processing, transcribed, ready, error
--
-- 2. interviews.conversation_analysis (jsonb) for detailed tracking:
--    {
--      "trigger_run_id": "run_abc123",
--      "current_step": "evidence_extraction",
--      "completed_steps": ["transcription", "upload"],
--      "custom_instructions": "Focus on pain points",
--      "transcript_data": {
--        "assemblyai_id": "transcript_xyz",
--        "file_name": "interview.mp4",
--        "external_url": "https://r2.cloudflare.com/..."
--      },
--      "workflow_state": { ... },
--      "evidence_count": 42,
--      "last_error": null
--    }
--
-- This consolidation:
-- - Simplifies schema (one less table)
-- - Single source of truth (interviews table)
-- - JSONB flexibility for any workflow metadata
-- - Easier queries (no joins needed)
-- =====================================================================

COMMENT ON COLUMN interviews.conversation_analysis IS 'JSONB column storing processing workflow state, upload metadata, trigger run IDs, custom instructions, and other analysis-related data. Replaces the dropped analysis_jobs table.';
