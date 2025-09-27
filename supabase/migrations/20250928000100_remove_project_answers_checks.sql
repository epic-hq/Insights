set check_function_bodies = off;
set search_path = public;

alter table if exists public.project_answers
  drop constraint if exists project_answers_status_check,
  drop constraint if exists project_answers_origin_check,
  drop constraint if exists project_answers_confidence_check;
