-- Add workflow state columns to analysis_jobs table for v2 modular interview processing
-- These columns enable stateful orchestration with resume capability

-- Add workflow_state column (stores complete workflow state as JSON)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'analysis_jobs'
        AND column_name = 'workflow_state'
    ) THEN
        ALTER TABLE "public"."analysis_jobs" ADD COLUMN "workflow_state" jsonb;
    END IF;
END $$;

-- Add completed_steps column (array of completed step names)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'analysis_jobs'
        AND column_name = 'completed_steps'
    ) THEN
        ALTER TABLE "public"."analysis_jobs" ADD COLUMN "completed_steps" text[];
    END IF;
END $$;

-- Add current_step column (current workflow step name)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'analysis_jobs'
        AND column_name = 'current_step'
    ) THEN
        ALTER TABLE "public"."analysis_jobs" ADD COLUMN "current_step" text;
    END IF;
END $$;

-- Add evidence_count column (number of evidence units extracted)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'analysis_jobs'
        AND column_name = 'evidence_count'
    ) THEN
        ALTER TABLE "public"."analysis_jobs" ADD COLUMN "evidence_count" integer;
    END IF;
END $$;

-- Create index on workflow_state for faster queries
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_workflow_state
ON "public"."analysis_jobs" USING gin (workflow_state);

-- Create index on current_step for filtering active workflows
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_current_step
ON "public"."analysis_jobs" (current_step)
WHERE current_step IS NOT NULL;
