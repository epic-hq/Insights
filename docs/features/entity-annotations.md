# Entity Annotations System

The annotations table provides a flexible system for attaching **entity-level notes, comments, todos, and AI suggestions** to any record in the system.

## Overview

**Use Cases:**
- Adding notes to people, organizations, and opportunities
- Creating follow-up todos for interviews
- Leaving comments on personas and insights
- AI-generated suggestions and recommendations
- Flagging entities for attention
- Reactions and social features

**Key Difference:**
- **Annotations** (this system): Entity-level notes attached to specific people, orgs, opportunities, etc.
- **Documents** (project_sections): Project-level strategic documents like positioning statements, SEO strategies, etc.

## Entity Types Supported

The `annotations` table supports polymorphic associations via `entity_type` and `entity_id`:

- `person` - Individual contacts
- `organization` - Companies and organizations
- `opportunity` - Sales/pipeline opportunities
- `interview` - Customer interviews
- `persona` - User personas
- `insight` - Research insights
- `project` - Projects themselves

## Annotation Types

The `annotation_type` field determines what kind of annotation it is:

- `note` - General notes and observations
- `comment` - Comments and discussions
- `todo` - Action items and follow-ups (supports `due_date`)
- `ai_suggestion` - AI-generated recommendations
- `flag` - Attention flags and markers
- `reaction` - Emoji reactions (supports `reaction_type`)

## Schema

```sql
CREATE TABLE public.annotations (
  id UUID PRIMARY KEY,
  account_id UUID NOT NULL,
  project_id UUID NOT NULL,

  -- Entity reference (polymorphic)
  entity_type TEXT NOT NULL,  -- person, organization, opportunity, etc.
  entity_id UUID NOT NULL,

  -- Annotation details
  annotation_type TEXT NOT NULL,  -- note, comment, todo, etc.
  content TEXT,                   -- Plain text/markdown content
  content_jsonb JSONB,           -- Structured data
  metadata JSONB DEFAULT '{}',

  -- Authorship
  created_by_user_id UUID,
  created_by_ai BOOLEAN DEFAULT FALSE,
  ai_model TEXT,

  -- Status and visibility
  status TEXT DEFAULT 'active',  -- active, archived, deleted
  visibility TEXT DEFAULT 'team', -- private, team, public

  -- Threading support
  parent_annotation_id UUID,
  thread_root_id UUID,

  -- Edit and resolution tracking
  updated_by_user_id UUID,
  resolved_at TIMESTAMPTZ,
  resolved_by_user_id UUID,

  -- Type-specific fields
  due_date TIMESTAMPTZ,    -- For todos
  reaction_type TEXT,      -- For reactions

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Using with Mastra Agents

### Tool: `manageAnnotations`

The `manageAnnotations` tool is available in both `projectStatusAgent` and `projectSetupAgent`.

**Operations:**
- `create` - Create a new annotation
- `update` - Update existing annotation
- `list` - List all annotations for an entity
- `delete` - Archive an annotation

### Examples

#### Creating a Note on a Person

```typescript
await agent.tools.manageAnnotations({
  operation: "create",
  entityType: "person",
  entityId: personId,
  annotationType: "note",
  content: "Follow up about pricing feedback from interview on 2025-01-15",
  metadata: { priority: "high", tags: ["pricing", "feedback"] }
})
```

#### Creating a Todo for an Opportunity

```typescript
await agent.tools.manageAnnotations({
  operation: "create",
  entityType: "opportunity",
  entityId: opportunityId,
  annotationType: "todo",
  content: "Send proposal and pricing deck",
  dueDate: "2025-01-25T00:00:00Z",
  metadata: { assignedTo: "sales_team" }
})
```

#### Listing Notes on an Organization

```typescript
const result = await agent.tools.manageAnnotations({
  operation: "list",
  entityType: "organization",
  entityId: orgId,
  filterByType: "note"  // Optional: filter by annotation type
})
// Returns: { annotations: [...] }
```

#### AI-Generated Suggestion on a Persona

```typescript
await agent.tools.manageAnnotations({
  operation: "create",
  entityType: "persona",
  entityId: personaId,
  annotationType: "ai_suggestion",
  content: "Consider expanding this persona to include early-stage startups based on recent interview patterns",
  contentJsonb: {
    reasoning: "3 out of 5 recent interviews match this profile",
    confidence: 0.85,
    relatedInterviews: [id1, id2, id3]
  }
})
```

### Natural Language Understanding

The tool understands natural language! Users don't need technical terminology.

**Users can say:**
- "Add a note to this person" → creates `note` annotation
- "Remind me to follow up" → creates `todo` annotation
- "Flag this opportunity" → creates `flag` annotation
- "Leave a comment on this interview" → creates `comment` annotation

**Agent Instructions:**

Both `projectStatusAgent` and `projectSetupAgent` have this workflow step:

> When users want to add notes, comments, or reminders to specific entities (people, organizations, opportunities, interviews), use "manageAnnotations" to create annotations. Examples: "add a note to this person", "remind me to follow up with this org", "flag this opportunity as high priority". Annotations are for entity-level notes and todos, different from project-level documents managed by manageDocuments.

## Database Features

### Row Level Security (RLS)

Annotations are protected by RLS policies:
- Users can only view/create annotations for their account's projects
- Annotations inherit access control from the project

### Indexes

Performance-optimized indexes:
```sql
idx_annotations_entity          -- (entity_type, entity_id)
idx_annotations_project         -- (project_id)
idx_annotations_type            -- (annotation_type)
idx_annotations_thread          -- (thread_root_id)
idx_annotations_ai_suggestions  -- For AI-created suggestions
idx_annotations_todos_unresolved -- For active todos with due dates
```

### Helper Functions

```sql
-- Get annotation counts by type
SELECT * FROM get_annotation_counts('person', person_id, project_id);
-- Returns: annotation_type | count

-- Get user's vote for an entity (voting system included)
SELECT get_user_vote('opportunity', opp_id, project_id);
-- Returns: -1, 0, or 1

-- Get user's flags for an entity
SELECT * FROM get_user_flags('interview', interview_id, project_id);
-- Returns: flag_type, flag_value, metadata
```

## Votes and Flags

The annotations system includes two related tables:

### Votes Table
Standard upvote/downvote system for any entity:
```typescript
// Vote on an opportunity
await supabase.from('votes').insert({
  entity_type: 'opportunity',
  entity_id: oppId,
  vote_value: 1  // 1 for upvote, -1 for downvote
})
```

### Entity Flags Table
User-specific flags that don't affect other users:
```typescript
// Star a person for quick access
await supabase.from('entity_flags').insert({
  entity_type: 'person',
  entity_id: personId,
  flag_type: 'starred',
  flag_value: true
})
```

Flag types: `hidden`, `archived`, `starred`, `priority`

## Migration from Notes Table

**Old approach (NOT IMPLEMENTED):**
- Separate `notes` table with limited functionality
- Required new table creation and migrations

**New approach (CURRENT):**
- Use existing `annotations` table with `annotation_type = 'note'`
- Already has all needed fields (content, metadata, entity associations)
- Supports threading, reactions, todos, and more
- No migration needed - just use it!

## Threading Support

Annotations support conversation threading:

```typescript
// Create root annotation
const root = await agent.tools.manageAnnotations({
  operation: "create",
  entityType: "person",
  entityId: personId,
  annotationType: "comment",
  content: "Great insights from the interview!"
})

// Reply to annotation
await agent.tools.manageAnnotations({
  operation: "create",
  entityType: "person",
  entityId: personId,
  annotationType: "comment",
  content: "Agreed! Should we schedule a follow-up?",
  metadata: {
    parentAnnotationId: root.annotation.id,
    threadRootId: root.annotation.id
  }
})
```

## Best Practices

1. **Use the right annotation type**:
   - `note` for observations and free-form notes
   - `todo` for actionable follow-ups (include `dueDate`)
   - `comment` for discussions and feedback
   - `ai_suggestion` for AI-generated insights
   - `flag` for attention markers

2. **Leverage metadata**:
   - Store structured data like tags, priorities, assignees
   - Keep searchable content in `content` field
   - Use `content_jsonb` for complex structured data

3. **Set appropriate visibility**:
   - `team` (default) - visible to all account members
   - `private` - only visible to creator
   - `public` - visible outside account (future use)

4. **Mark AI-created annotations**:
   - `created_by_ai: true` for agent-generated annotations
   - Include `ai_model` name for transparency

5. **Use threading for discussions**:
   - Link related annotations with `parent_annotation_id`
   - Track conversation roots with `thread_root_id`

## UI Integration (Future)

Potential UI components:
- Annotation sidebar showing notes/comments for current entity
- Todo list widget showing all unresolved todos
- Activity feed showing recent annotations
- Quick note composer in entity detail pages
- Inline comment bubbles on entity cards

## API Examples

### Programmatic Usage

```typescript
import { supabaseAdmin } from "~/lib/supabase/client.server"

// Create annotation
const { data, error } = await supabaseAdmin
  .from("annotations")
  .insert({
    account_id: accountId,
    project_id: projectId,
    entity_type: "person",
    entity_id: personId,
    annotation_type: "note",
    content: "Met at conference - interested in enterprise plan",
    created_by_ai: false,
    metadata: { source: "conference", event: "SaaStr 2025" }
  })
  .select()
  .single()

// List annotations
const { data: annotations } = await supabaseAdmin
  .from("annotations")
  .select("*")
  .eq("entity_type", "person")
  .eq("entity_id", personId)
  .eq("status", "active")
  .order("created_at", { ascending: false })

// Update annotation
await supabaseAdmin
  .from("annotations")
  .update({
    content: "Updated note content",
    updated_at: new Date().toISOString()
  })
  .eq("id", annotationId)

// Archive annotation (soft delete)
await supabaseAdmin
  .from("annotations")
  .update({ status: "deleted" })
  .eq("id", annotationId)
```

## Related Documentation

- [Dynamic Documents System](./dynamic-documents.md) - Project-level strategic documents
- [Document Vocabulary Reference](../quick-reference/document-vocabulary.md) - Natural language mapping for documents
- Annotations schema: `supabase/schemas/40_annotations.sql`
- Tool implementation: `app/mastra/tools/manage-annotations.ts`
