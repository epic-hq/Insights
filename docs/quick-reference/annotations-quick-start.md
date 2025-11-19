# Annotations Quick Start

Quick reference for using the entity annotations system in agents and code.

## Overview

**Annotations** = Entity-level notes attached to people, orgs, opportunities, etc.
**Documents** = Project-level strategic docs like positioning, SEO strategy, etc.

## Agent Usage

Both `projectStatusAgent` and `projectSetupAgent` have the `manageAnnotations` tool.

### Creating Annotations

```typescript
// Add a note to a person
await manageAnnotations({
  operation: "create",
  entityType: "person",
  entityId: "uuid-here",
  annotationType: "note",
  content: "Mentioned interest in enterprise features during call"
})

// Create a todo for follow-up
await manageAnnotations({
  operation: "create",
  entityType: "opportunity",
  entityId: "uuid-here",
  annotationType: "todo",
  content: "Send pricing proposal",
  dueDate: "2025-01-30T00:00:00Z"
})

// Flag an organization as high priority
await manageAnnotations({
  operation: "create",
  entityType: "organization",
  entityId: "uuid-here",
  annotationType: "flag",
  content: "High priority - enterprise opportunity",
  metadata: { priority: "high", reason: "Fortune 500 company" }
})
```

### Listing Annotations

```typescript
// Get all annotations for a person
const result = await manageAnnotations({
  operation: "list",
  entityType: "person",
  entityId: "uuid-here"
})

// Get only notes
const notes = await manageAnnotations({
  operation: "list",
  entityType: "person",
  entityId: "uuid-here",
  filterByType: "note"
})
```

### Updating Annotations

```typescript
await manageAnnotations({
  operation: "update",
  annotationId: "annotation-uuid",
  content: "Updated note content",
  metadata: { updated_reason: "new information from interview" }
})
```

## Natural Language Examples

Users can say these things to the agent:

- **"Add a note to this person"** → agent creates `note` annotation
- **"Remind me to follow up with Sarah"** → agent creates `todo` annotation
- **"Flag this opportunity as urgent"** → agent creates `flag` annotation
- **"Leave a comment on this interview"** → agent creates `comment` annotation

The agent automatically translates natural language to the right annotation type.

## Entity Types

| Entity Type | Description |
|------------|-------------|
| `person` | Individual contacts |
| `organization` | Companies |
| `opportunity` | Sales opportunities |
| `interview` | Customer interviews |
| `persona` | User personas |
| `insight` | Research insights |
| `project` | Projects |

## Annotation Types

| Type | Description | Special Fields |
|------|-------------|----------------|
| `note` | General notes and observations | - |
| `comment` | Comments and discussions | Threading support |
| `todo` | Action items and follow-ups | `dueDate` |
| `ai_suggestion` | AI-generated recommendations | `contentJsonb` for structured data |
| `flag` | Attention flags and markers | - |
| `reaction` | Emoji reactions | `reactionType` |

## Programmatic Usage

### Direct Database Access

```typescript
import { supabaseAdmin } from "~/lib/supabase/client.server"

// Create
const { data } = await supabaseAdmin
  .from("annotations")
  .insert({
    account_id: accountId,
    project_id: projectId,
    entity_type: "person",
    entity_id: personId,
    annotation_type: "note",
    content: "Met at SaaStr conference",
    created_by_ai: false,
    metadata: { event: "SaaStr 2025" }
  })
  .select()
  .single()

// List
const { data: annotations } = await supabaseAdmin
  .from("annotations")
  .select("*")
  .eq("entity_type", "person")
  .eq("entity_id", personId)
  .eq("status", "active")
  .order("created_at", { ascending: false })
```

## Common Patterns

### Todo with Due Date

```typescript
await manageAnnotations({
  operation: "create",
  entityType: "opportunity",
  entityId: oppId,
  annotationType: "todo",
  content: "Send contract and onboarding materials",
  dueDate: "2025-02-15T00:00:00Z",
  metadata: {
    priority: "high",
    assignedTo: "sales_team"
  }
})
```

### AI-Generated Suggestion

```typescript
await manageAnnotations({
  operation: "create",
  entityType: "persona",
  entityId: personaId,
  annotationType: "ai_suggestion",
  content: "Consider splitting this persona into SMB and Enterprise segments",
  contentJsonb: {
    reasoning: "Interview patterns show distinct pain points by company size",
    confidence: 0.87,
    supportingEvidence: [evidenceId1, evidenceId2]
  }
})
```

### Note with Rich Metadata

```typescript
await manageAnnotations({
  operation: "create",
  entityType: "person",
  entityId: personId,
  annotationType: "note",
  content: "Strong advocate for the product, willing to provide referrals",
  metadata: {
    tags: ["champion", "referral_source"],
    sentiment: "positive",
    nps_score: 9,
    source: "follow_up_call"
  }
})
```

## Threading

```typescript
// Create root comment
const root = await manageAnnotations({
  operation: "create",
  entityType: "interview",
  entityId: interviewId,
  annotationType: "comment",
  content: "Excellent insights on enterprise pricing"
})

// Reply to comment
await manageAnnotations({
  operation: "create",
  entityType: "interview",
  entityId: interviewId,
  annotationType: "comment",
  content: "Agreed - we should adjust our pricing deck",
  metadata: {
    parentAnnotationId: root.annotation.id,
    threadRootId: root.annotation.id
  }
})
```

## Best Practices

1. **Use descriptive content** - Write clear, actionable notes
2. **Add metadata** - Store structured data like tags, priorities, sources
3. **Set due dates on todos** - Always include `dueDate` for action items
4. **Mark AI annotations** - Set `created_by_ai: true` for agent-generated content
5. **Use threading** - Link related comments for discussions
6. **Archive, don't delete** - Set `status: 'deleted'` instead of hard deleting

## Quick Reference

```typescript
// Create note
{ operation: "create", entityType: "person", entityId, annotationType: "note", content }

// Create todo
{ operation: "create", entityType: "opportunity", entityId, annotationType: "todo", content, dueDate }

// List all
{ operation: "list", entityType, entityId }

// List filtered
{ operation: "list", entityType, entityId, filterByType: "note" }

// Update
{ operation: "update", annotationId, content }

// Delete (archive)
{ operation: "delete", annotationId }
```

## Related Docs

- [Full Entity Annotations Documentation](../features/entity-annotations.md)
- [Dynamic Documents System](../features/dynamic-documents.md)
- Schema: `supabase/schemas/40_annotations.sql`
- Tool: `app/mastra/tools/manage-annotations.ts`
