-- Add 'evidence' to entity_type constraints for annotations, votes, and entity_flags tables
-- This allows evidence to be voted on (verify/reject) and flagged (archive/star) from the evidence detail page

ALTER TABLE public.annotations DROP CONSTRAINT IF EXISTS annotations_entity_type_check;
ALTER TABLE public.annotations ADD CONSTRAINT annotations_entity_type_check
  CHECK (entity_type IN ('insight', 'persona', 'opportunity', 'interview', 'person', 'project', 'organization', 'task', 'evidence'));

ALTER TABLE public.votes DROP CONSTRAINT IF EXISTS votes_entity_type_check;
ALTER TABLE public.votes ADD CONSTRAINT votes_entity_type_check
  CHECK (entity_type IN ('insight', 'persona', 'opportunity', 'interview', 'person', 'project', 'organization', 'task', 'evidence'));

ALTER TABLE public.entity_flags DROP CONSTRAINT IF EXISTS entity_flags_entity_type_check;
ALTER TABLE public.entity_flags ADD CONSTRAINT entity_flags_entity_type_check
  CHECK (entity_type IN ('insight', 'persona', 'opportunity', 'interview', 'person', 'project', 'organization', 'task', 'evidence'));
