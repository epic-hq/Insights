-- Add source type, file extension, and person_id fields to interviews table
ALTER TABLE public.interviews
ADD COLUMN IF NOT EXISTS source_type text,
ADD COLUMN IF NOT EXISTS file_extension text,
ADD COLUMN IF NOT EXISTS person_id uuid REFERENCES people (id) ON DELETE SET NULL;

-- Add index for person_id lookups
CREATE INDEX IF NOT EXISTS idx_interviews_person_id ON public.interviews(person_id);

-- Add comments for documentation
COMMENT ON COLUMN public.interviews.source_type IS 'Source of the content: realtime_recording, audio_upload, video_upload, document, transcript';
COMMENT ON COLUMN public.interviews.file_extension IS 'File extension (mp3, mp4, pdf, csv, md, etc.)';
COMMENT ON COLUMN public.interviews.person_id IS 'Link to person if attached to specific contact';
