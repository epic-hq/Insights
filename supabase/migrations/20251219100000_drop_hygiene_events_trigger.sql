-- Drop the timestamp trigger from sales_lens_hygiene_events
-- This table is an append-only event log and doesn't have an updated_at column
drop trigger if exists set_sales_lens_hygiene_events_timestamp on public.sales_lens_hygiene_events;
