-- Add media_url field to interviews table
-- This syncs the remote database changes with local schema

ALTER TABLE public.interviews 
ADD COLUMN IF NOT EXISTS media_url text;
