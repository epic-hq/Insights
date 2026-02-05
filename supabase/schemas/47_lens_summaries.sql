-- ============================================================================
-- Lens Summaries - Cross-interview synthesis for aggregated lens views
-- ============================================================================
-- Stores AI-synthesized insights from multiple conversation_lens_analyses
-- One summary per project+template_key combination
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.conversation_lens_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  template_key text NOT NULL,  -- No FK: allows special keys like '__cross_lens__' for cross-lens synthesis
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

-- Auto-update timestamps using the standard accounts trigger
CREATE TRIGGER set_conversation_lens_summaries_timestamp
  BEFORE INSERT OR UPDATE ON public.conversation_lens_summaries
  FOR EACH ROW
  EXECUTE PROCEDURE accounts.trigger_set_timestamps();

-- RLS Policies
ALTER TABLE public.conversation_lens_summaries ENABLE ROW LEVEL SECURITY;

-- Read access for account members
CREATE POLICY "Users can read lens summaries for their accounts"
  ON public.conversation_lens_summaries FOR SELECT TO authenticated
  USING (
    account_id IN (SELECT accounts.get_accounts_with_role())
  );

-- Insert/Update for account members
CREATE POLICY "Users can create lens summaries for their accounts"
  ON public.conversation_lens_summaries FOR INSERT TO authenticated
  WITH CHECK (
    account_id IN (SELECT accounts.get_accounts_with_role())
  );

CREATE POLICY "Users can update lens summaries for their accounts"
  ON public.conversation_lens_summaries FOR UPDATE TO authenticated
  USING (
    account_id IN (SELECT accounts.get_accounts_with_role())
  )
  WITH CHECK (
    account_id IN (SELECT accounts.get_accounts_with_role())
  );

-- Service role can do everything
CREATE POLICY "Service role can manage all lens summaries"
  ON public.conversation_lens_summaries FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Comments
COMMENT ON TABLE public.conversation_lens_summaries IS 'AI-synthesized insights from multiple conversation lens analyses for a project';
COMMENT ON COLUMN public.conversation_lens_summaries.synthesis_data IS 'Full synthesis result from SynthesizeLensInsights BAML function';
COMMENT ON COLUMN public.conversation_lens_summaries.executive_summary IS 'Extracted executive summary for quick display in UI';
COMMENT ON COLUMN public.conversation_lens_summaries.status IS 'stale means underlying analyses changed and re-synthesis recommended';
