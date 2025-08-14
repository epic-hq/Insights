-- Annotations System Schema
-- Generalized system for comments, votes, AI suggestions, flags across all entities

-- 1. ANNOTATIONS TABLE
-- Handles comments, AI suggestions, notes, TODOs, reactions
CREATE TABLE IF NOT EXISTS public.annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts.accounts(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

  -- Entity reference (polymorphic)
  entity_type TEXT NOT NULL CHECK (entity_type IN ('insight', 'persona', 'opportunity', 'interview', 'person')),
  entity_id UUID NOT NULL,

  -- Annotation metadata
  annotation_type TEXT NOT NULL CHECK (annotation_type IN ('comment', 'ai_suggestion', 'flag', 'note', 'todo', 'reaction')),
  content TEXT,
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
  entity_type TEXT NOT NULL CHECK (entity_type IN ('insight', 'persona', 'opportunity', 'interview', 'person')),
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
  entity_type TEXT NOT NULL CHECK (entity_type IN ('insight', 'persona', 'opportunity', 'interview', 'person')),
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
    COALESCE(COUNT(*), 0) as total_votes
  FROM public.votes v
  WHERE v.entity_type = p_entity_type
    AND v.entity_id = p_entity_id
    AND v.project_id = p_project_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's vote for an entity
drop function if exists public.get_user_vote(text, uuid, uuid);
CREATE OR REPLACE FUNCTION public.get_user_vote(
  p_entity_type TEXT,
  p_entity_id UUID,
  p_project_id UUID
)
RETURNS TABLE(
  vote_value INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT v.vote_value
  FROM public.votes v
  WHERE v.entity_type = p_entity_type
    AND v.entity_id = p_entity_id
    AND v.project_id = p_project_id
    AND v.user_id = auth.uid();
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
  SELECT ef.flag_type, ef.flag_value, ef.metadata
  FROM public.entity_flags ef
  WHERE ef.entity_type = p_entity_type
    AND ef.entity_id = p_entity_id
    AND ef.project_id = p_project_id
    AND ef.user_id = auth.uid()
    AND ef.flag_value = TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;