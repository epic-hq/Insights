-- Fix existing system templates to be visible
-- Templates that have no account_id and no created_by are system templates
UPDATE public.conversation_lens_templates
SET is_system = true
WHERE account_id IS NULL
  AND created_by IS NULL
  AND template_key IN (
    'project-research',
    'customer-discovery',
    'user-testing',
    'product-insights',
    'sales-bant',
    'empathy-map-jtbd',
    'consulting-project'
  );
