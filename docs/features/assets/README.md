# Project Assets Feature

## Overview

Project Assets (`project_assets` table) store user-uploaded and AI-generated files, tables, and documents within a project. Assets support:

- **Tabular data** with inline editing, sorting, search, and CSV export
- **Document content** (markdown, imported PDFs, web content)
- **Vector embeddings** for semantic search via the AI agent

## Database Schema

```sql
-- Core table: supabase/schemas/35_asset_evidence.sql
create table project_assets (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id),
  project_id uuid not null references projects(id),

  -- Content
  title text not null,
  description text,
  asset_type asset_type not null, -- 'table', 'document', 'file', 'image'
  content_md text,                -- Markdown representation

  -- Table-specific
  table_data jsonb,               -- { headers: string[], rows: Record<string, string>[] }
  row_count int,
  column_count int,

  -- Metadata
  source_type text,               -- 'user_upload', 'ai_generated', 'import'
  status text default 'ready',

  -- Vector search
  embedding vector(1536),         -- OpenAI text-embedding-3-small

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Semantic search RPC
create function find_similar_assets(
  query_embedding vector(1536),
  project_id_param uuid,
  match_threshold float default 0.5,
  match_count int default 10
) returns table (id uuid, title text, ..., similarity float);
```

## Feature Modules

### UI Components

| File | Purpose |
|------|---------|
| `app/features/assets/pages/detail.tsx` | Asset detail page with inline table editing |
| `app/features/assets/routes.ts` | Route definitions |
| `app/features/interviews/pages/index.tsx` | Files tab showing project assets |

### AI Agent Tools

| Tool | Purpose |
|------|---------|
| `saveTableToAssets` | Create NEW tables (competitive matrices, feature comparisons) |
| `updateTableAsset` | Modify existing tables (add/remove rows, update cells, add columns) |
| `parseSpreadsheet` | Parse user-pasted CSV/TSV data into assets |
| `semanticSearchAssets` | Search assets by natural language query |

### Background Tasks

| Task | Purpose |
|------|---------|
| `src/trigger/asset/indexAsset.ts` | Generate embeddings for semantic search |

## User Flows

### 1. AI-Generated Tables

```
User: "Create a competitive matrix comparing Notion, Confluence, and Coda"
  ↓
Agent calls saveTableToAssets with headers + rows
  ↓
Asset saved to project_assets with asset_type='table'
  ↓
Trigger task generates embedding for semantic search
  ↓
Table appears in Files tab with inline editing
```

### 2. User-Pasted Spreadsheet Data

```
User pastes CSV/TSV data into chat
  ↓
Agent calls parseSpreadsheet to detect structure
  ↓
If looksLikeContacts=true, offers to import as People
  ↓
Asset saved to project_assets
  ↓
User can edit inline, export to CSV
```

### 3. Modifying Existing Tables

```
User: "Add a row for Monday.com to the competitive matrix"
  ↓
Agent calls updateTableAsset with:
  - assetId (from URL or previous tool result)
  - operation: "addRows"
  - newRows: [{ "Tool": "Monday.com", ... }]
  ↓
Asset updated in place, UI refreshes automatically
```

## Table Data Structure

```typescript
interface TableData {
  headers: string[]           // Column names
  rows: Record<string, string>[] // Array of row objects
}

// Example:
{
  headers: ["Feature", "Us", "Competitor A"],
  rows: [
    { "Feature": "Pricing", "Us": "$10/mo", "Competitor A": "$15/mo" },
    { "Feature": "API", "Us": "Yes", "Competitor A": "No" }
  ]
}
```

## Inline Editing

The detail page (`app/features/assets/pages/detail.tsx`) supports:

- **Cell editing**: Click any cell to edit inline
- **Add row**: Button adds empty row at bottom
- **Add column**: Dialog prompts for column name
- **Delete**: Via action menu
- **Export CSV**: Downloads table as CSV file

Changes are saved via form actions:

```typescript
// Action handlers in detail.tsx
case "update-cell":     // Update single cell value
case "add-row":         // Add empty row
case "add-column":      // Add new column with default values
case "delete":          // Delete entire asset
```

## Semantic Search

Assets are indexed for semantic search:

1. **Embedding generation**: `indexAsset` trigger task creates embeddings
2. **Search**: Agent uses `semanticSearchAssets` tool with natural language
3. **RPC**: `find_similar_assets` performs vector similarity search

```typescript
// Agent tool usage
const results = await semanticSearchAssets({
  query: "competitive analysis tables",
  projectId: "...",
  limit: 10
})
```

## Agent Instructions

The agent follows these rules for table operations:

1. **Create NEW table** → Use `saveTableToAssets`
2. **Modify EXISTING table** → Use `updateTableAsset` (never create new)
3. **Get assetId** → From URL (`/assets/{assetId}`) or previous tool result
4. **Don't redraw** → UI auto-refreshes after updates

## Related Documentation

- [Supabase Guide](../../supabase-howto.md) - Database migrations
- [CRUD Patterns](../../crud-pattern-howto.md) - Data operation patterns
- [Trigger.dev Deployment](../../trigger-dev-deployment.md) - Background task deployment
