-- Annotations System Schema
-- Generalized system for comments, votes, AI suggestions, flags across all entities

-- 1. ANNOTATIONS TABLE
-- Handles comments, AI suggestions, notes, TODOs, reactions
CREATE TABLE IF NOT EXISTS public.annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts.accounts(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

  -- Entity reference (polymorphic)
  entity_type TEXT NOT NULL CHECK (entity_type IN ('insight', 'persona', 'opportunity', 'interview', 'person', 'project', 'organization', 'task')),
  entity_id UUID NOT NULL,

  -- Annotation metadata
  annotation_type TEXT NOT NULL CHECK (annotation_type IN ('comment', 'ai_suggestion', 'flag', 'note', 'todo', 'reaction')),
  content TEXT, -- Plain text content for comments, notes, etc.
  content_jsonb JSONB, -- Structured JSONB content for AI suggestions, complex todos, etc.
  metadata JSONB DEFAULT '{}',

  -- Authorship - use auth.uid() for user_id to support multi-user accounts
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_ai BOOLEAN DEFAULT FALSE,
  ai_model TEXT,

  -- Status and visibility
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
  visibility TEXT DEFAULT 'team' CHECK (visibility IN ('private', 'team', 'public')),

  -- Threading support for conversations
  parent_annotation_id UUID REFERENCES public.annotations(id) ON DELETE CASCADE,
  thread_root_id UUID REFERENCES public.annotations(id) ON DELETE CASCADE,

  -- Edit and resolution tracking
  updated_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  resolved_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Todo-specific fields
  due_date TIMESTAMPTZ,

  -- Reaction-specific fields
  reaction_type TEXT, -- Emoji or reaction identifier

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. VOTES TABLE
-- Standard voting system for any entity
CREATE TABLE IF NOT EXISTS public.votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts.accounts(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

  -- Entity reference (polymorphic)
  entity_type TEXT NOT NULL CHECK (entity_type IN ('insight', 'persona', 'opportunity', 'interview', 'person', 'project', 'organization', 'task')),
  entity_id UUID NOT NULL,

  -- Vote data - use auth.uid() for user_id to support multi-user accounts
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vote_value INTEGER NOT NULL CHECK (vote_value IN (-1, 1)), -- -1 downvote, 1 upvote

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one vote per user per entity
  UNIQUE(user_id, entity_type, entity_id)
);

-- 3. ENTITY_FLAGS TABLE
-- User-specific flags (hide, archive, star, priority) without affecting other users
CREATE TABLE IF NOT EXISTS public.entity_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts.accounts(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

  -- Entity reference (polymorphic)
  entity_type TEXT NOT NULL CHECK (entity_type IN ('insight', 'persona', 'opportunity', 'interview', 'person', 'project', 'organization', 'task')),
  entity_id UUID NOT NULL,

  -- Flag data - use auth.uid() for user_id to support multi-user accounts
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flag_type TEXT NOT NULL CHECK (flag_type IN ('hidden', 'archived', 'starred', 'priority')),
  flag_value BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one flag type per user per entity
  UNIQUE(user_id, entity_type, entity_id, flag_type)
);

-- INDEXES for performance
CREATE INDEX IF NOT EXISTS idx_annotations_entity ON public.annotations(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_annotations_project ON public.annotations(project_id);
CREATE INDEX IF NOT EXISTS idx_annotations_type ON public.annotations(annotation_type);
CREATE INDEX IF NOT EXISTS idx_annotations_thread ON public.annotations(thread_root_id);
CREATE INDEX IF NOT EXISTS idx_annotations_user ON public.annotations(created_by_user_id);

-- JSONB indexes for efficient querying of structured content
CREATE INDEX IF NOT EXISTS idx_annotations_content_jsonb_gin ON public.annotations USING GIN (content_jsonb);
CREATE INDEX IF NOT EXISTS idx_annotations_content_jsonb_path ON public.annotations USING GIN (content_jsonb jsonb_path_ops);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_annotations_ai_suggestions ON public.annotations (entity_type, entity_id, annotation_type, created_at DESC)
WHERE created_by_ai = true AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_annotations_todos_unresolved ON public.annotations (project_id, entity_id, due_date)
WHERE annotation_type = 'todo' AND resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_annotations_reactions ON public.annotations (entity_type, entity_id, reaction_type)
WHERE annotation_type = 'reaction' AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_votes_entity ON public.votes(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_votes_user ON public.votes(user_id);
CREATE INDEX IF NOT EXISTS idx_votes_project ON public.votes(project_id);

CREATE INDEX IF NOT EXISTS idx_entity_flags_entity ON public.entity_flags(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_flags_user ON public.entity_flags(user_id, flag_type);
CREATE INDEX IF NOT EXISTS idx_entity_flags_project ON public.entity_flags(project_id);

-- ENABLE ROW LEVEL SECURITY
ALTER TABLE public.annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_flags ENABLE ROW LEVEL SECURITY;

-- Policy: Allow account members to insert annotations for any account they are a member of
create policy "Account members can insert annotations"
    on public.annotations
    for insert
    with check (
        auth.uid() = created_by_user_id
        or exists (
            select 1 from accounts.account_user
            where account_user.user_id = auth.uid()
              and account_user.account_id = annotations.account_id
        )
        or auth.role() = 'service_role'
    );

-- Policy: Allow account members to select annotations in their account
create policy "Account members can view annotations"
    on public.annotations
    for select
    using (
        exists (
            select 1 from accounts.account_user
            where account_user.user_id = auth.uid()
              and account_user.account_id = annotations.account_id
        )
        or auth.role() = 'service_role'
    );
-- HELPER FUNCTIONS

-- Function to get annotation counts for an entity
CREATE OR REPLACE FUNCTION public.get_annotation_counts(
  p_entity_type TEXT,
  p_entity_id UUID,
  p_project_id UUID
)
RETURNS TABLE(
  annotation_type TEXT,
  count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.annotation_type,
    COUNT(*) as count
  FROM public.annotations a
  WHERE a.entity_type = p_entity_type
    AND a.entity_id = p_entity_id
    AND a.project_id = p_project_id
    AND a.status = 'active'
  GROUP BY a.annotation_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get vote counts for an entity
CREATE OR REPLACE FUNCTION public.get_vote_counts(
  p_entity_type TEXT,
  p_entity_id UUID,
  p_project_id UUID
)
RETURNS TABLE(
  upvotes BIGINT,
  downvotes BIGINT,
  total_votes BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(CASE WHEN v.vote_value = 1 THEN 1 ELSE 0 END), 0) as upvotes,
    COALESCE(SUM(CASE WHEN v.vote_value = -1 THEN 1 ELSE 0 END), 0) as downvotes,
    COUNT(*) as total_votes
  FROM public.votes v
  WHERE v.entity_type = p_entity_type
    AND v.entity_id = p_entity_id
    AND v.project_id = p_project_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's vote for an entity
CREATE OR REPLACE FUNCTION public.get_user_vote(
  p_entity_type TEXT,
  p_entity_id UUID,
  p_project_id UUID
)
RETURNS INTEGER AS $$
DECLARE
  user_vote INTEGER;
BEGIN
  SELECT vote_value INTO user_vote
  FROM public.votes
  WHERE entity_type = p_entity_type
    AND entity_id = p_entity_id
    AND project_id = p_project_id
    AND user_id = auth.uid();

  RETURN COALESCE(user_vote, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's flags for an entity
CREATE OR REPLACE FUNCTION public.get_user_flags(
  p_entity_type TEXT,
  p_entity_id UUID,
  p_project_id UUID
)
RETURNS TABLE(
  flag_type TEXT,
  flag_value BOOLEAN,
  metadata JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ef.flag_type,
    ef.flag_value,
    ef.metadata
  FROM public.entity_flags ef
  WHERE ef.entity_type = p_entity_type
    AND ef.entity_id = p_entity_id
    AND ef.project_id = p_project_id
    AND ef.user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Enable RLS and add basic policies for the votes table
-- Generated 2025-08-09

alter table public.votes
    enable row level security;

-- ───────────────────────────────────────────────────────────
-- SELECT: users can read votes that belong to their account
-- ───────────────────────────────────────────────────────────
create policy "Users can view votes in their account"
    on public.votes
    for select
    using (
        auth.uid() = user_id
        or auth.role() = 'service_role'
    );

-- ───────────────────────────────────────────────────────────
-- INSERT: a user may cast a vote for their own uid
-- ───────────────────────────────────────────────────────────
create policy "Users can create votes with their uid"
    on public.votes
    for insert
    with check (
        auth.uid() = user_id
        or auth.role() = 'service_role'
    );

-- ───────────────────────────────────────────────────────────
-- UPDATE: a user may change or remove their own vote
-- ───────────────────────────────────────────────────────────
create policy "Users can update their own votes"
    on public.votes
    for update
    using (
        auth.uid() = user_id
        or auth.role() = 'service_role'
    )
    with check (
        auth.uid() = user_id
        or auth.role() = 'service_role'
    );

-- ───────────────────────────────────────────────────────────
-- DELETE: a user may delete their own vote
-- ───────────────────────────────────────────────────────────
create policy "Users can delete their own votes"
    on public.votes
    for delete
    using (
        auth.uid() = user_id
        or auth.role() = 'service_role'
    );