BEGIN;

ALTER TABLE public.interview_people
  ADD COLUMN IF NOT EXISTS transcript_key text,
  ADD COLUMN IF NOT EXISTS display_name text;

CREATE INDEX IF NOT EXISTS idx_interview_people_transcript ON public.interview_people (transcript_key);

COMMIT;
