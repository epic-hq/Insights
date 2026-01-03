-- Add columns for Recall.ai desktop SDK integration
-- These columns support recording uploads from the desktop app

-- recall_recording_id: Unique ID from Recall.ai for webhook/status tracking
ALTER TABLE interviews
  ADD COLUMN IF NOT EXISTS recall_recording_id TEXT UNIQUE;

-- meeting_platform: Where the meeting was recorded (google_meet, zoom, teams, etc.)
ALTER TABLE interviews
  ADD COLUMN IF NOT EXISTS meeting_platform TEXT;

-- transcript_url: Temporary URL for Recall transcript download
ALTER TABLE interviews
  ADD COLUMN IF NOT EXISTS transcript_url TEXT;

-- Create index for fast lookup by recall_recording_id
CREATE INDEX IF NOT EXISTS idx_interviews_recall_recording_id
  ON interviews(recall_recording_id)
  WHERE recall_recording_id IS NOT NULL;

-- Comment on columns for documentation
COMMENT ON COLUMN interviews.recall_recording_id IS 'Unique recording ID from Recall.ai Desktop SDK';
COMMENT ON COLUMN interviews.meeting_platform IS 'Meeting platform where recording was captured (google_meet, zoom, teams, etc.)';
COMMENT ON COLUMN interviews.transcript_url IS 'Temporary URL for downloading transcript from Recall.ai';
