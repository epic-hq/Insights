-- Add lens_visibility column to interviews table
-- Controls whether lenses are visible at private (user only) or account level

ALTER TABLE public.interviews
ADD COLUMN IF NOT EXISTS lens_visibility text DEFAULT 'account'
CHECK (lens_visibility IN ('private', 'account'));

COMMENT ON COLUMN public.interviews.lens_visibility IS
  'Controls lens visibility: private (user only) or account (shared)';

-- Add interview_type column if missing
ALTER TABLE public.interviews
ADD COLUMN IF NOT EXISTS interview_type text;

COMMENT ON COLUMN public.interviews.interview_type IS
  'Type of interview: interview, voice_memo, note, meeting';

-- Create trigger to auto-set voice memos and notes to private
CREATE OR REPLACE FUNCTION public.set_default_lens_visibility()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.interview_type IN ('voice_memo', 'note', 'voice-memo') THEN
    NEW.lens_visibility := 'private';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger only if it doesn't exist
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'interview_lens_visibility_trigger') THEN
    CREATE TRIGGER interview_lens_visibility_trigger
      BEFORE INSERT ON public.interviews
      FOR EACH ROW
      EXECUTE FUNCTION public.set_default_lens_visibility();
  END IF;
END $$;
