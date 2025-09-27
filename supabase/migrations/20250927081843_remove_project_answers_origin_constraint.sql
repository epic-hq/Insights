-- Remove the origin check constraint from project_answers table
-- This allows the application to handle origin values more flexibly
alter table "public"."project_answers" drop constraint if exists "project_answers_origin_check";