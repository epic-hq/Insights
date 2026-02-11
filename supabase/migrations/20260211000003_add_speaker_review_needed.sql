-- Add speaker_review_needed flag for placeholder speaker detection
-- When AssemblyAI returns generic speakers (Speaker A, Speaker B, etc.),
-- we flag the interview for review and create a hygiene task.

ALTER TABLE interviews
ADD COLUMN IF NOT EXISTS speaker_review_needed boolean DEFAULT false;

COMMENT ON COLUMN interviews.speaker_review_needed IS 'True when placeholder speakers (Speaker A, Speaker B, etc.) are detected. Creates hygiene task for user review.';

-- Index for filtering interviews that need speaker review
CREATE INDEX IF NOT EXISTS idx_interviews_speaker_review_needed
  ON interviews(speaker_review_needed)
  WHERE speaker_review_needed = true;
