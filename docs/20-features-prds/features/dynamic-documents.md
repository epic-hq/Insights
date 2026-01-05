# Dynamic Document System

The project_sections table now supports **dynamic document types** - you can create documents of any type without schema changes or configuration.

## Overview

Previously, every document type required:
1. Adding to `project_section_kinds` table
2. Adding config to `PROJECT_SECTIONS` in section-config.ts
3. Database migration

Now, you can create documents with any `kind` value instantly:
- `positioning_statement`
- `seo_strategy`
- `meeting_notes_2025-01-19`
- `customer_interview_acme_corp`
- Literally anything!

## Two Types of Sections

### 1. Structured Sections (Configured)

These are defined in `PROJECT_SECTIONS` config and have special UI handling:

**Setup/Research Fields:**
- `customer_problem` - Business problem being solved
- `target_orgs`, `target_roles` - ICP definition
- `offerings` - Products and services
- `competitors` - Competitive landscape
- `research_goal` - Research objective
- `decision_questions` - Strategic questions
- `assumptions`, `unknowns` - Research context
- `custom_instructions` - AI instructions

These power the Project Setup form and generate research structures.

### 2. Dynamic Documents (Unconfigured)

Everything else - no config needed! Common examples:

**Strategic Documents:**
- `positioning_statement` - Product positioning
- `market_analysis` - Market research
- `competitive_analysis` - Competitor deep-dive
- `product_roadmap` - Feature planning
- `business_plan` - Business strategy

**Marketing Documents:**
- `seo_strategy` - SEO keywords and approach
- `content_strategy` - Content calendar and themes
- `brand_guidelines` - Brand identity rules
- `messaging_framework` - Key messages
- `go_to_market` - GTM plan

**Product Documents:**
- `feature_specs` - Feature specifications
- `user_stories` - User story collection
- `technical_specs` - Technical design
- `design_docs` - Design documentation

**Research Documents:**
- `meeting_notes` - Meeting notes
- `research_notes` - Research observations
- `interview_notes` - Interview summaries
- `user_feedback` - Customer feedback
- `observation_log` - User observation notes

## Natural Language Understanding

The `manageDocuments` tool understands natural language! Users don't need to know technical field names.

**Users can say:**
- "Save our positioning" → creates `positioning_statement`
- "Document the SEO strategy" → creates `seo_strategy`
- "Write up meeting notes" → creates `meeting_notes`
- "Create a pricing doc" → creates `pricing_strategy`
- "Save the competitive analysis" → creates `competitive_analysis`

The agent automatically translates natural language to appropriate document kinds.

## Using Dynamic Documents

### With Mastra Agents

Use the `manageDocuments` tool in any agent:

```typescript
// Create a new document
await agent.tools.manageDocuments({
  operation: "create",
  kind: "positioning_statement",
  content: "# Product Positioning\n\nWe help...",
  metadata: { version: "1.0", author: "AI" }
})

// Update existing document
await agent.tools.manageDocuments({
  operation: "update",
  kind: "seo_strategy",
  content: "# SEO Strategy\n\nKeywords: ..."
})

// Create or update (upsert)
await agent.tools.manageDocuments({
  operation: "upsert",
  kind: "meeting_notes",
  content: "## Meeting with Customer\n\nDiscussed..."
})

// Read a document
const result = await agent.tools.manageDocuments({
  operation: "read",
  kind: "positioning_statement"
})

// List all documents
const result = await agent.tools.manageDocuments({
  operation: "list"
})
```

### Programmatically

Use the existing `upsertProjectSection` function:

```typescript
import { upsertProjectSection } from "~/features/projects/db"

await upsertProjectSection({
  supabase,
  data: {
    project_id: projectId,
    kind: "seo_strategy",
    content_md: "# SEO Strategy\n\n...",
    meta: { keywords: ["saas", "research", "insights"] }
  }
})
```

### Via API

The existing `/api/save-project-goals` endpoint works with any kind:

```typescript
const formData = new FormData()
formData.append("project_id", projectId)
formData.append("positioning_statement", "# Our Position\n\n...")
formData.append("seo_strategy", "# SEO\n\n...")

await fetch("/api/save-project-goals", {
  method: "POST",
  body: formData
})
```

## Database Changes

### Migration: `20250119000000_make_project_sections_kind_dynamic.sql`

1. Removed FK constraint: `project_sections.kind` → `project_section_kinds.id`
2. Added index on `kind` for performance
3. Added auto-registration trigger (optional) to track new kinds in reference table

### Schema Changes: `supabase/schemas/10_projects.sql`

1. `project_section_kinds` is now a reference catalog, not enforced via FK
2. Common dynamic document types added to reference table
3. Auto-registration function tracks new kinds automatically

## Important Note: Unique Constraint

Currently, `project_sections` has a unique index on `(project_id, kind)`.

This means:
- ✅ One `positioning_statement` per project
- ✅ One `seo_strategy` per project
- ❌ Cannot have multiple `meeting_notes` documents

**Future Enhancement:** If you need multiple documents of the same kind (e.g., multiple meeting notes), we can:
1. Remove the unique constraint
2. Add a `slug` or `title` field for identification
3. Update UI to list multiple documents per kind

For now, use unique kind values like:
- `meeting_notes_2025_01_19`
- `meeting_notes_acme_corp`
- `interview_notes_user_123`

## Agent Instructions

When configuring agents to use this system:

```typescript
export const myAgent = new Agent({
  name: "myAgent",
  instructions: `
You can create and manage documents of any type using the manageDocuments tool.

Common document types:
- Strategic: positioning_statement, market_analysis, competitive_analysis
- Marketing: seo_strategy, content_strategy, brand_guidelines
- Product: feature_specs, technical_specs, design_docs
- Research: meeting_notes, interview_notes, user_feedback

Examples:
- Create SEO strategy: manageDocuments({ operation: "create", kind: "seo_strategy", content: "..." })
- Update positioning: manageDocuments({ operation: "update", kind: "positioning_statement", content: "..." })
- List all docs: manageDocuments({ operation: "list" })
`,
  tools: {
    manageDocuments: manageDocumentsTool,
    // ... other tools
  }
})
```

## Best Practices

1. **Use descriptive kind values**: `seo_strategy` not `seo`, `meeting_notes_2025_01_19` not `notes`
2. **Keep markdown clean**: Use proper markdown formatting for better readability
3. **Use metadata**: Store structured data in `meta` field (author, version, tags, etc.)
4. **Leverage auto-registration**: New kinds are automatically tracked in `project_section_kinds` table
5. **For multiple similar docs**: Use unique suffixes (`meeting_notes_1`, `meeting_notes_2`) until we support multiple documents per kind

## Example Use Cases

### AI-Generated Content

```typescript
// Agent generates positioning statement
await manageDocuments({
  operation: "upsert",
  kind: "positioning_statement",
  content: `# Product Positioning

## Problem
${customerProblem}

## Solution
${offerings}

## Target Market
${targetRoles.join(", ")}

## Differentiators
${competitors.map(c => `- Better than ${c} because...`).join("\n")}`,
  metadata: { generated_by: "ai", version: "1.0" }
})
```

### Meeting Notes

```typescript
// User uploads meeting notes via chat/voice
await manageDocuments({
  operation: "create",
  kind: `meeting_notes_${new Date().toISOString().split('T')[0]}`,
  content: transcribedNotes,
  metadata: {
    attendees: ["John", "Jane"],
    duration_minutes: 45,
    topics: ["product", "roadmap"]
  }
})
```

### Document Evolution

```typescript
// Version 1
await manageDocuments({
  operation: "create",
  kind: "seo_strategy",
  content: "...",
  metadata: { version: "1.0" }
})

// Version 2 (updates replace)
await manageDocuments({
  operation: "update",
  kind: "seo_strategy",
  content: "... updated content ...",
  metadata: { version: "2.0", updated_by: "agent" }
})
```

## Migration Guide

### Before (Rigid)

```typescript
// 1. Add to project_section_kinds table via migration
// 2. Add to PROJECT_SECTIONS config
// 3. Deploy migration
// 4. Use in code

// Migration:
insert into project_section_kinds (id) values ('new_doc_type');

// Config:
export const PROJECT_SECTIONS = [
  // ...
  { kind: "new_doc_type", type: "string", defaultValue: "" }
]
```

### After (Dynamic)

```typescript
// Just use it!
await manageDocuments({
  operation: "create",
  kind: "new_doc_type",
  content: "..."
})

// That's it! No migration, no config needed.
```

## Future Enhancements

1. **Multiple docs per kind**: Remove unique constraint, add slug/title field
2. **Document templates**: Pre-defined templates for common doc types
3. **Version history**: Track document versions over time
4. **Document relationships**: Link related documents
5. **Rich editing UI**: Markdown editor with voice/chat control
6. **Document search**: Full-text search across all documents
7. **Export/Import**: Bulk document operations
8. **Sharing**: Share documents between projects/teams
