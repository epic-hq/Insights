-- Insights ----------------------------------------------------------
create table if not exists insights (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts.accounts (id) on delete cascade,
  interview_id uuid references interviews (id),
  name text not null,
  category text not null,
  journey_stage text,
  impact smallint check (impact between 1 and 5),
  novelty smallint check (novelty between 1 and 5),
  jtbd text,
	details text,
	evidence text,
  motivation text,
  pain text,
  desired_outcome text,
  emotional_response text,
  opportunity_ideas text[],
  confidence text check (confidence in ('low','medium','high')),
  contradictions text,
	related_tags text[],
  embedding vector(1536), -- jtbd embedding to aid searching
  created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

-- Indexes for performance based on common queries
CREATE INDEX idx_insights_account_id ON public.insights(account_id);
CREATE INDEX idx_insights_interview_id ON public.insights(interview_id);
CREATE INDEX idx_insights_name ON public.insights(name);
CREATE INDEX idx_insights_category ON public.insights(category);
CREATE INDEX idx_insights_journey_stage ON public.insights(journey_stage);
CREATE INDEX idx_insights_embedding_hnsw ON public.insights
USING hnsw (embedding vector_l2_ops)
WITH (m = 16, ef_construction = 64);

-- protect the timestamps by setting created_at and updated_at to be read-only and managed by a trigger
CREATE TRIGGER set_insights_timestamp
    BEFORE INSERT OR UPDATE ON public.insights
    FOR EACH ROW
EXECUTE PROCEDURE accounts.trigger_set_timestamps();

-- protect the updated_by and created_by columns by setting them to be read-only and managed by a trigger
CREATE TRIGGER set_insights_user_tracking
    BEFORE INSERT OR UPDATE ON public.insights
    FOR EACH ROW
EXECUTE PROCEDURE accounts.trigger_set_user_tracking();

create index if not exists idx_insights_account_id on public.insights using btree (account_id) tablespace pg_default;

-- enable RLS on the table
ALTER TABLE public.insights ENABLE ROW LEVEL SECURITY;

-- Because RLS is enabled, this table will NOT be accessible to any users by default
-- You must create a policy for each user that should have access to the table
-- Here are a few example policies that you may find useful when working with accounts

-------------
-- Users should be able to read records that are owned by an account they belong to
--------------
create policy "Account members can select" on public.insights
    for select
    to authenticated
    using (
    account_id IN ( SELECT accounts.get_accounts_with_role())
    );

----------------
-- Users should be able to create records that are owned by an account they belong to
----------------
create policy "Account members can insert" on public.insights
    for insert
    to authenticated
    with check (
    account_id IN ( SELECT accounts.get_accounts_with_role())
    );

---------------
-- Users should be able to update records that are owned by an account they belong to
---------------
create policy "Account members can update" on public.insights
    for update
    to authenticated
    using (
    account_id IN ( SELECT accounts.get_accounts_with_role())
    );

----------------
-- Only account OWNERS should be able to delete records that are owned by an account they belong to
----------------
create policy "Account owners can delete" on public.insights
    for delete
    to authenticated
    using (
    account_id IN ( SELECT accounts.get_accounts_with_role('owner'))
    );


-- Comments ----------------------------------------------------------

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts.accounts (id) on delete cascade,
  insight_id uuid not null references insights (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes for performance based on common queries
CREATE INDEX idx_comments_account_id ON public.comments(account_id);
CREATE INDEX idx_comments_insight_id ON public.comments(insight_id);

-- protect the timestamps by setting created_at and updated_at to be read-only and managed by a trigger
CREATE TRIGGER set_comments_timestamp
    BEFORE INSERT OR UPDATE ON public.comments
    FOR EACH ROW
EXECUTE PROCEDURE accounts.trigger_set_timestamps();

-- protect the updated_by and created_by columns by setting them to be read-only and managed by a trigger
CREATE TRIGGER set_comments_user_tracking
    BEFORE INSERT OR UPDATE ON public.comments
    FOR EACH ROW
EXECUTE PROCEDURE accounts.trigger_set_user_tracking();

create index if not exists idx_comments_account_id on public.comments using btree (account_id) tablespace pg_default;

-- enable RLS on the table
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- Because RLS is enabled, this table will NOT be accessible to any users by default
-- You must create a policy for each user that should have access to the table
-- Here are a few example policies that you may find useful when working with accounts

-------------
-- Users should be able to read records that are owned by an account they belong to
--------------
create policy "Account members can select" on public.comments
    for select
    to authenticated
    using (
    account_id IN ( SELECT accounts.get_accounts_with_role())
    );

----------------
-- Users should be able to create records that are owned by an account they belong to
----------------
create policy "Account members can insert" on public.comments
    for insert
    to authenticated
    with check (
    account_id IN ( SELECT accounts.get_accounts_with_role())
    );

---------------
-- Only comment authors should be able to update their own comments
---------------
create policy "Comment authors can update their own comments" on public.comments
    for update
    to authenticated
    using (
    user_id = auth.uid()
    );

----------------
-- Only account OWNERS should be able to delete records that are owned by an account they belong to
----------------
create policy "Account owners can delete" on public.comments
    for delete
    to authenticated
    using (
    account_id IN ( SELECT accounts.get_accounts_with_role('owner'))
    );


-- Quotes NA. using inside insights table for now
-- create table if not exists quotes (
--   id uuid primary key default gen_random_uuid(),
--   account_id uuid not null references accounts.accounts (id) on delete cascade,
--   insight_id uuid not null references insights (id) on delete cascade,
--   quote text not null,
--   timestamp_sec int,
--   created_at timestamptz not null default now(),
-- 	updated_at timestamptz not null default now()
-- );

-- Themes ---------------------------------------------------------------------

-- FUTURE
-- create table if not exists themes (
--   id uuid primary key default gen_random_uuid(),
--   account_id uuid not null references accounts.accounts (id) on delete cascade,
--   name text not null,
--   category text,
--   color_hex text,
--   embedding vector(1536),
--   created_at timestamptz not null default now(),
-- 	updated_at timestamptz not null default now()
-- );
