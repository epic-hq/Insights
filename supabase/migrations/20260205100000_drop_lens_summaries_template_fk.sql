-- Drop the foreign key constraint on conversation_lens_summaries.template_key
-- so that cross-lens synthesis can use the special key '__cross_lens__'
-- which does not exist in conversation_lens_templates.

ALTER TABLE public.conversation_lens_summaries
  DROP CONSTRAINT IF EXISTS conversation_lens_summaries_template_key_fkey;
