-- Add missing RLS policies and grants for conversation_lens_templates
-- Idempotent migration - safe to re-run
-- The declarative schema can't handle GRANTs, so we manage them here

-- ─────────────────────────────────────────────────────────────────────
-- 1. RLS Policies (idempotent via DROP IF EXISTS)
-- ─────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Anyone can read active lens templates" ON public.conversation_lens_templates;
DROP POLICY IF EXISTS "Service role can manage lens templates" ON public.conversation_lens_templates;

CREATE POLICY "Anyone can read active lens templates"
  ON public.conversation_lens_templates
  FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Service role can manage lens templates"
  ON public.conversation_lens_templates
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────
-- 2. Table Grants (idempotent - GRANTs are safe to re-run)
-- ─────────────────────────────────────────────────────────────────────

-- conversation_lens_templates: readable by authenticated, full access for service_role
GRANT SELECT ON TABLE public.conversation_lens_templates TO authenticated;
GRANT ALL ON TABLE public.conversation_lens_templates TO service_role;

-- conversation_lens_analyses: full CRUD for authenticated (scoped by RLS)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.conversation_lens_analyses TO authenticated;
GRANT ALL ON TABLE public.conversation_lens_analyses TO service_role;
