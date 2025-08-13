# Annotations System Schema Proposal

## Overview

A generalized annotations system to handle comments, votes, AI suggestions, flags, and other metadata across all entities (insights, personas, opportunities, interviews, people, etc.).

## Core Tables

### 1. `annotations` Table

```sql
CREATE TABLE annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  -- Entity reference (polymorphic)
  entity_type TEXT NOT NULL, -- 'insight', 'persona', 'opportunity', 'interview', 'person', etc.
  entity_id UUID NOT NULL,   -- ID of the referenced entity

  -- Annotation metadata
  annotation_type TEXT NOT NULL, -- 'comment', 'ai_suggestion', 'flag', 'note', 'todo', etc.
  content TEXT,                  -- Main content (comment text, suggestion, etc.)
  metadata JSONB,                -- Additional structured data

  -- Authorship
  created_by_user_id UUID REFERENCES auth.users(id),
  created_by_ai BOOLEAN DEFAULT FALSE,
  ai_model TEXT,                 -- Which AI model created this (if AI-generated)

  -- Status and visibility
  status TEXT DEFAULT 'active', -- 'active', 'archived', 'deleted'
  visibility TEXT DEFAULT 'team', -- 'private', 'team', 'public'

  -- Threading support
  parent_annotation_id UUID REFERENCES annotations(id),
  thread_root_id UUID REFERENCES annotations(id),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_entity_type CHECK (entity_type IN ('insight', 'persona', 'opportunity', 'interview', 'person')),
  CONSTRAINT valid_annotation_type CHECK (annotation_type IN ('comment', 'ai_suggestion', 'flag', 'note', 'todo', 'reaction')),
  CONSTRAINT valid_status CHECK (status IN ('active', 'archived', 'deleted')),
  CONSTRAINT valid_visibility CHECK (visibility IN ('private', 'team', 'public'))
);

-- Indexes for performance
CREATE INDEX idx_annotations_entity ON annotations(entity_type, entity_id);
CREATE INDEX idx_annotations_project ON annotations(project_id);
CREATE INDEX idx_annotations_type ON annotations(annotation_type);
CREATE INDEX idx_annotations_thread ON annotations(thread_root_id);
```

### 2. `votes` Table

```sql
CREATE TABLE votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  -- Entity reference (polymorphic)
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,

  -- Vote data
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vote_value INTEGER NOT NULL CHECK (vote_value IN (-1, 1)), -- -1 for downvote, 1 for upvote

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one vote per user per entity
  UNIQUE(user_id, entity_type, entity_id)
);

-- Indexes
CREATE INDEX idx_votes_entity ON votes(entity_type, entity_id);
CREATE INDEX idx_votes_user ON votes(user_id);
```

### 3. `entity_flags` Table (for hide/archive/status)

```sql
CREATE TABLE entity_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  -- Entity reference
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,

  -- Flag data
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flag_type TEXT NOT NULL, -- 'hidden', 'archived', 'starred', 'priority', etc.
  flag_value BOOLEAN DEFAULT TRUE,
  metadata JSONB, -- Additional flag-specific data

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one flag type per user per entity
  UNIQUE(user_id, entity_type, entity_id, flag_type),

  CONSTRAINT valid_flag_type CHECK (flag_type IN ('hidden', 'archived', 'starred', 'priority'))
);

-- Indexes
CREATE INDEX idx_entity_flags_entity ON entity_flags(entity_type, entity_id);
CREATE INDEX idx_entity_flags_user ON entity_flags(user_id, flag_type);
```

## Row Level Security (RLS) Policies

```sql
-- Annotations RLS
ALTER TABLE annotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view annotations in their projects" ON annotations
  FOR SELECT USING (
    project_id IN (
      SELECT p.id FROM projects p
      WHERE p.account_id = auth.jwt() ->> 'account_id'
    )
  );

CREATE POLICY "Users can create annotations in their projects" ON annotations
  FOR INSERT WITH CHECK (
    project_id IN (
      SELECT p.id FROM projects p
      WHERE p.account_id = auth.jwt() ->> 'account_id'
    )
    AND account_id = (auth.jwt() ->> 'account_id')::uuid
  );

-- Similar policies for votes and entity_flags...
```

## Benefits of This Approach

### 1. **Polymorphic Design**

- Single system handles annotations for ALL entities
- Easy to add new entity types without schema changes
- Consistent API across all entities

### 2. **Flexible Annotation Types**

- **Comments**: `annotation_type = 'comment'`, content = comment text
- **AI Suggestions**: `annotation_type = 'ai_suggestion'`, content = suggestion, metadata = context
- **Flags/Notes**: `annotation_type = 'note'` or `'flag'`
- **TODOs**: `annotation_type = 'todo'`, content = task description

### 3. **Threading Support**

- `parent_annotation_id` for replies
- `thread_root_id` for efficient thread queries
- Enables AI to participate in conversations

### 4. **Voting System**

- Separate table for clean vote aggregation
- Supports upvote/downvote on any entity
- Prevents duplicate votes per user

### 5. **User-Specific Flags**

- Hide/archive/star per user without affecting others
- Extensible flag types
- Metadata field for flag-specific data

## API Integration Examples

### React Hook for Annotations

```typescript
const useAnnotations = (entityType: string, entityId: string) => {
  // Fetch annotations, handle optimistic updates
  // Support filtering by annotation_type
}

const useVotes = (entityType: string, entityId: string) => {
  // Fetch vote counts and user's vote
  // Handle optimistic voting
}

const useEntityFlags = (entityType: string, entityId: string) => {
  // Fetch user's flags for entity
  // Handle hide/archive/star actions
}
```

### Database Helper Functions

```typescript
class AnnotationManager {
  async addComment(entityType, entityId, content, userId) { }
  async addAISuggestion(entityType, entityId, suggestion, context) { }
  async voteOnEntity(entityType, entityId, userId, voteValue) { }
  async flagEntity(entityType, entityId, userId, flagType, value) { }
  async getAnnotationsForEntity(entityType, entityId, filters) { }
}
```

## Migration Strategy

1. **Create new tables** with the schema above
2. **Migrate existing comments** from `comments` table to `annotations`
3. **Update InsightCardV2** to use new annotation system
4. **Create reusable components** for annotations/voting
5. **Apply to other entities** (personas, opportunities, etc.)

This approach provides a solid foundation for the annotation system described in your product requirements while being highly scalable and maintainable.

## Project Review

The current implementation differs from the original proposal mainly in security and runtime behaviour:

• Tables & columns match the proposal, but no row-level-security (RLS) policies reached the database.

• Hooks now rely entirely on server round-trips (no optimistic updates).

• projectId must come from currentProjectContext; earlier missing-value bugs triggered RLS errors.

• A new migration (20250809074854_create_votes_policies.sql) now enables RLS for votes,

- [ ] but annotations and entity_flags still lack RLS policies.

### Lessons learned

Always ship RLS policies with the initial table migration or every write fails silently (42501).
Avoid putting function references (fetcher.load) in useEffect dependency arrays—React recreates them and triggers request loops.
Optimistic UI is fragile unless every failure path rolls back; falling back to server truth was faster and safer.
Fetch context (projectId, accountId) must be resolved once and memoised; undefined context values cause both frontend loops and RLS rejections.
Database migrations should be additive; earlier migration dropped policies without adding new ones, breaking prod.
Outstanding gaps / work to finish

- [x] Add RLS policies for annotations and entity_flags.

- [ ] Fix middleware RLS errors.

```bash

AuthApiError: Request rate limit reached
    at handleError (/Users/richardmoy/Code/ai/Insights/node_modules/.pnpm/@supabase+auth-js@2.71.1/node_modules/@supabase/auth-js/src/lib/fetch.ts:102:9)
    at processTicksAndRejections (node:internal/process/task_queues:105:5)
    at _handleRequest (/Users/richardmoy/Code/ai/Insights/node_modules/.pnpm/@supabase+auth-js@2.71.1/node_modules/@supabase/auth-js/src/lib/fetch.ts:195:5)
    at _request (/Users/richardmoy/Code/ai/Insights/node_modules/.pnpm/@supabase+auth-js@2.71.1/node_modules/@supabase/auth-js/src/lib/fetch.ts:157:16)
    at /Users/richardmoy/Code/ai/Insights/node_modules/.pnpm/@supabase+auth-js@2.71.1/node_modules/@supabase/auth-js/src/GoTrueClient.ts:2113:18
    at /Users/richardmoy/Code/ai/Insights/node_modules/.pnpm/@supabase+auth-js@2.71.1/node_modules/@supabase/auth-js/src/lib/helpers.ts:228:26 {
  __isAuthError: true,
  status: 429,
  code: 'over_request_rate_limit'
```

- [ ] Create companion Supabase functions (get_user_vote, get_vote_counts, etc.) in migrations—currently referenced but not version-controlled.
Bundle the per-entity data fetch into one RPC or REST endpoint to cut request volume.
Share a single server Supabase client per request (pass through Remix context) so Auth is contacted once. (getting 429 errors)

- [ ] Add composite indexes on (entity_type, entity_id, project_id) for faster filters.

- [ ] Threading helpers (thread_root_id, includeThreads) work, but no SQL to cascade deletes from root → replies.

- [ ] Unit tests exist but need CI run (they reference hard-coded UUIDs).

- [ ] Documentation: update API examples to reflect no optimistic UI and new /api/votes behaviour.

Once these tasks are complete, the doc and code will be fully aligned.

## Enhancement:AnnotationViews

**FUTURE!!**

Goal: Performance and reduce client work

Create SQL views that join insights with:

votes aggregate (upvotes, downvotes, total, current user’s vote)
annotation counts (comments, threads)
These views inherit RLS from base tables, work in list and detail queries, and eliminate N-per-card requests.

Declarative schema (Supabase SQL)
Place in something like: supabase/schemas/35_insight_meta_views.sql

```sql
-- Votes aggregate for all entities. Uses auth.uid() for user-specific vote.
create or replace view public.vote_aggregates as
select
  v.entity_type,
  v.entity_id,
  v.project_id,
  sum(case when v.vote_value = 1 then 1 else 0 end)        as upvotes,
  sum(case when v.vote_value = -1 then 1 else 0 end)       as downvotes,
  count(*)                                                 as total_votes,
  coalesce(max(case when v.user_id = auth.uid() then v.vote_value end), 0) as user_vote
from public.votes v
group by v.entity_type, v.entity_id, v.project_id;

comment on view public.vote_aggregates is
  'Aggregate vote counts per entity with user-specific vote via auth.uid().';

-- Annotation counts for all entities.
-- Assumes annotations(entity_type, entity_id, project_id, annotation_type, parent_id)
create or replace view public.annotation_counts as
select
  a.entity_type,
  a.entity_id,
  a.project_id,
  count(*) filter (where a.annotation_type = 'comment')     as comments_count,
  count(*) filter (where a.parent_id is null)               as threads_count
from public.annotations a
group by a.entity_type, a.entity_id, a.project_id;

comment on view public.annotation_counts is
  'Counts of comments and top-level threads per entity.';

-- Insights with meta: join insights + votes + annotation counts.
create or replace view public.insights_with_meta as
select
  i.*,
  coalesce(va.upvotes, 0)        as upvotes,
  coalesce(va.downvotes, 0)      as downvotes,
  coalesce(va.total_votes, 0)    as total_votes,
  coalesce(va.user_vote, 0)      as user_vote,
  coalesce(ac.comments_count, 0) as comments_count,
  coalesce(ac.threads_count, 0)  as threads_count
from public.insights i
left join public.vote_aggregates va
  on va.entity_type = 'insight'
 and va.entity_id   = i.id
 and va.project_id  = i.project_id
left join public.annotation_counts ac
  on ac.entity_type = 'insight'
 and ac.entity_id   = i.id
 and ac.project_id  = i.project_id;

comment on view public.insights_with_meta is
  'Insights enriched with vote aggregates and annotation counts.';

-- Optional: expose only selected columns if needed
-- and/or add explicit GRANTs (RLS on base tables still applies).
```

**How to use**
List page loader:

- select from public.insights_with_meta filtered by project_id, with pagination.
- Detail loader:
select one row from public.insights_with_meta where id = $1 and project_id = $2.
- Why this helps
One query returns all needed list/detail UI fields, including user_vote via auth.uid().
Leverages RLS on base tables (no service role required).
Eliminates per-card client fetches and 429 storms.
Still composes cleanly with useLoaderData().
- Notes
If annotations schema differs (e.g., different thread key), adjust parent_id logic.
If you later need performance beyond live views, introduce a materialized view + cron/trigger refresh. Start with standard views.
