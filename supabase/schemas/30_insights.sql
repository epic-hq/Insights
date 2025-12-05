-- Insights ----------------------------------------------------------
create table if not exists insights (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts.accounts (id) on delete cascade,
  interview_id uuid, -- FK intentionally dropped (20251222093000) - allows deleting interviews without blocking
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
	project_id uuid references projects (id) on delete cascade,
  embedding vector(1536), -- jtbd embedding to aid searching
  created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	created_by uuid references auth.users (id) on delete cascade,
	updated_by uuid references auth.users (id) on delete cascade
);


-- Table comment
comment on table insights is 'LLM/BAML-extracted user research insights tied to interviews/accounts.';

-- Column comments
comment on column insights.id                 is 'Primary key.';
comment on column insights.account_id         is 'Owning account (tenant). Cascades on delete.';
comment on column insights.interview_id       is 'Source interview that produced this insight.';

comment on column insights.name               is 'Short (≤5 words) label for the insight.';
comment on column insights.details            is 'Context/background: causes of pain, behavior specifics, desired outcomes. Sentences or bullets.';
comment on column insights.pain               is 'Pain or friction the user experiences.';
comment on column insights.desired_outcome    is 'Outcome/benefit the user wants to achieve.';
comment on column insights.evidence           is 'Verbatim quote w/ timestamp from interviewee.';
comment on column insights.emotional_response is 'Perceived strength of feeling: Low | Neutral | High.';
comment on column insights.motivation         is 'Underlying motivation driving the insight.';
comment on column insights.category           is 'General category bucket for the insight.';
comment on column insights.journey_stage      is 'User journey stage (e.g. Awareness, Onboarding, Planning, Learning, Assessing, Progress, Community, Support, Other).';
comment on column insights.impact             is 'Impact/severity to user or biz value (1 minor → 5 critical).';
comment on column insights.novelty            is 'Uniqueness/“surprise” factor (1 common → 5 breakthrough).';
comment on column insights.jtbd               is 'Job-to-be-done phrasing: “When I…, I want to…, so I can…”.';
comment on column insights.opportunity_ideas  is 'Potential opportunity ideas sparked by this insight.';
comment on column insights.confidence         is 'Our confidence in the insight (low | medium | high).';
comment on column insights.contradictions     is 'Explicit/implicit contradictions or notable omissions.';
comment on column insights.related_tags       is 'Conceptual tags/keywords (not UI feature names).';
comment on column insights.embedding          is '1536-dim vector embedding (e.g., of JTBD) for semantic search.';
comment on column insights.created_at         is 'Row creation timestamp.';
comment on column insights.updated_at         is 'Row last-updated timestamp.';

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
