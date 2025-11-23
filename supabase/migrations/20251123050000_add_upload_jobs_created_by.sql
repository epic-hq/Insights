-- Add created_by field to upload_jobs table
ALTER TABLE public.upload_jobs
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_upload_jobs_created_by ON upload_jobs(created_by);
