-- Remove stage check constraint to allow free-form stage values

alter table "public"."tasks" drop constraint if exists "tasks_stage_check";
