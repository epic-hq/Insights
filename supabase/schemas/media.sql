
-- Media Files --------------------------------------------------
-- FUTURE

-- create table if not exists media_files (
--   id uuid primary key default gen_random_uuid(),
--   account_id uuid not null references accounts.accounts (id) on delete cascade,
--   interview_id uuid references interviews (id) on delete set null,
-- 	url text,
--   r2_path text not null,
--   file_name text not null,
--   mime_type text not null,
--   size_bytes bigint,
--   uploaded_by uuid references auth.users (id),
--   uploaded_at timestamptz not null default now()
-- );
--