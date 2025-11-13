-- Compatibility views that expose themes as "insights"
-- NOTE: These views are created by migration 20251220120000_themes_canonical.sql
-- This schema file is kept for reference but does not create the views
-- to avoid schema ordering issues (themes.pain column added in migration)

-- Views created in migration:
-- - public.insights_current
-- - public.insights_with_priority
