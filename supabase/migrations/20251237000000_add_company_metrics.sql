-- Add company metrics columns to organizations table
-- These enable importing financial/funding data from CRM spreadsheets

alter table "public"."organizations" add column if not exists "market_cap" numeric;
alter table "public"."organizations" add column if not exists "funding_stage" text;
alter table "public"."organizations" add column if not exists "total_funding" numeric;
