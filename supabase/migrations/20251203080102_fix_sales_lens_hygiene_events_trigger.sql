-- Drop the trigger that tries to set updated_at (which doesn't exist on this table)
DROP TRIGGER IF EXISTS set_sales_lens_hygiene_events_timestamp ON public.sales_lens_hygiene_events;

-- Hygiene events are immutable log entries, so they don't need updated_at
-- created_at has a default value of now(), so no trigger needed
