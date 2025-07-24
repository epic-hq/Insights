-- Kept for migration history compatibility with remote database.
-- Original purpose: ensure any stale view is removed before recreating via later migrations.

DROP VIEW IF EXISTS "public"."persona_distribution";
