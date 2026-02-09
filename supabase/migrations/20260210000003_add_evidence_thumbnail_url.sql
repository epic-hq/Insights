-- Add thumbnail_url column to evidence table for per-evidence video frame thumbnails
alter table public.evidence add column if not exists thumbnail_url text;

comment on column public.evidence.thumbnail_url is 'R2 key for a video frame thumbnail captured at the evidence anchor timestamp.';
