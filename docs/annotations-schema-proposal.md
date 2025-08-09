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
