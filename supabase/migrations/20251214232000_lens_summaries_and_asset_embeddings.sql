-- Migration to add conversation_lens_summaries table and project_assets embedding columns
-- These schemas exist locally but weren't migrated to remote

-- ============================================================================
-- 1. Conversation Lens Summaries Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.conversation_lens_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  template_key text NOT NULL REFERENCES public.conversation_lens_templates(template_key) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts.accounts(id) ON DELETE CASCADE,

  -- Synthesis data
  synthesis_data jsonb NOT NULL DEFAULT '{}',
  executive_summary text,
  key_takeaways jsonb DEFAULT '[]',
  recommendations jsonb DEFAULT '[]',
  conflicts_to_review jsonb DEFAULT '[]',

  -- Metadata
  interview_count int NOT NULL DEFAULT 0,
  overall_confidence float,
  custom_instructions text,

  -- Processing info
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'stale')),
  error_message text,
  processed_at timestamptz,
  processed_by text,
  trigger_run_id text,

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Unique constraint: one summary per project+template
  CONSTRAINT unique_project_template_summary UNIQUE (project_id, template_key)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lens_summaries_project ON public.conversation_lens_summaries(project_id);
CREATE INDEX IF NOT EXISTS idx_lens_summaries_template ON public.conversation_lens_summaries(template_key);
CREATE INDEX IF NOT EXISTS idx_lens_summaries_status ON public.conversation_lens_summaries(status);

-- Auto-update timestamps
DROP TRIGGER IF EXISTS set_conversation_lens_summaries_timestamp ON public.conversation_lens_summaries;
CREATE TRIGGER set_conversation_lens_summaries_timestamp
  BEFORE INSERT OR UPDATE ON public.conversation_lens_summaries
  FOR EACH ROW
  EXECUTE PROCEDURE accounts.trigger_set_timestamps();

-- Also try the alternate trigger name that diff is looking for
DROP TRIGGER IF EXISTS update_lens_summaries_updated_at ON public.conversation_lens_summaries;

-- RLS Policies
ALTER TABLE public.conversation_lens_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read lens summaries for their accounts" ON public.conversation_lens_summaries;
CREATE POLICY "Users can read lens summaries for their accounts"
  ON public.conversation_lens_summaries FOR SELECT TO authenticated
  USING (
    account_id IN (SELECT accounts.get_accounts_with_role())
  );

DROP POLICY IF EXISTS "Users can create lens summaries for their accounts" ON public.conversation_lens_summaries;
CREATE POLICY "Users can create lens summaries for their accounts"
  ON public.conversation_lens_summaries FOR INSERT TO authenticated
  WITH CHECK (
    account_id IN (SELECT accounts.get_accounts_with_role())
  );

DROP POLICY IF EXISTS "Users can update lens summaries for their accounts" ON public.conversation_lens_summaries;
CREATE POLICY "Users can update lens summaries for their accounts"
  ON public.conversation_lens_summaries FOR UPDATE TO authenticated
  USING (
    account_id IN (SELECT accounts.get_accounts_with_role())
  )
  WITH CHECK (
    account_id IN (SELECT accounts.get_accounts_with_role())
  );

DROP POLICY IF EXISTS "Service role can manage all lens summaries" ON public.conversation_lens_summaries;
CREATE POLICY "Service role can manage all lens summaries"
  ON public.conversation_lens_summaries FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.conversation_lens_summaries IS 'AI-synthesized insights from multiple conversation lens analyses for a project';

-- ============================================================================
-- 2. Project Assets Embedding Columns
-- ============================================================================

-- Add embedding columns to project_assets if they don't exist
ALTER TABLE public.project_assets
ADD COLUMN IF NOT EXISTS embedding vector(1536),
ADD COLUMN IF NOT EXISTS embedding_model text DEFAULT 'text-embedding-3-small',
ADD COLUMN IF NOT EXISTS embedding_generated_at timestamptz;

-- Create HNSW index for fast similarity search
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'project_assets' AND indexname = 'project_assets_embedding_idx'
    ) THEN
        CREATE INDEX project_assets_embedding_idx ON public.project_assets
        USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64);
    END IF;
END $$;
