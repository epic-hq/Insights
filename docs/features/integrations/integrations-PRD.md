# External Integrations & Data Ingestion PRD

> **Status**: In Development
> **Last Updated**: 2024-12-11
> **Owner**: Product/Engineering
> **Schema**: `supabase/schemas/25_project_assets.sql`

---

## Vision

Transform Upsight into an **AI-native CRM** that automatically ingests, organizes, and surfaces customer intelligence from all touchpoints—spreadsheets, PDFs, meetings, emails, Slack, and more.

---

## Content Storage Architecture

### Decision: New `project_assets` Table

We evaluated three approaches for storing imported content (tables, PDFs, etc.):

| Approach | Verdict | Rationale |
|----------|---------|-----------|
| Extend `interviews` | ❌ Rejected | Semantically wrong - a spreadsheet isn't a "conversation". Pollutes interview queries. |
| Extend `project_sections` | ❌ Rejected | `kind` field overloaded. Sections are for markdown docs, not binary files. |
| **New `project_assets` table** | ✅ Chosen | Clean separation. Purpose-built for files. Extensible for PDFs, images, links. |

### Content Type Mapping

| Content | Table | Rationale |
|---------|-------|-----------|
| Interview recordings | `interviews` | Primary research, has transcript, participants |
| Voice memos | `interviews` | Same processing pipeline |
| Notes | `interviews` | Already works with `source_type: 'note'` |
| Research goal, background | `project_sections` | Project config/metadata |
| Decision questions | `project_sections` | Research structure |
| **Pasted spreadsheets** | `project_assets` | Imported data, not research |
| **Uploaded CSVs** | `project_assets` | Imported data |
| **PDFs** | `project_assets` | External documents |
| **Screenshots/images** | `project_assets` | Reference materials |

### Content View Architecture (UI)

The "Content" page (`/a/:accountId/:projectId/interviews`) provides a unified view with filters:

| Filter | Source | Shows |
|--------|--------|-------|
| **All** | `interviews` table | Conversations + Notes |
| **Conversations** | `interviews` where `media_type = 'interview'` | Calls, meetings |
| **Notes** | `interviews` where `source_type = 'note'` | Quick notes, voice memos |
| **Files** | `project_assets` table | Parsed tables, uploaded docs |

**Implementation**: `app/features/interviews/pages/index.tsx`

- Loader fetches both `interviews` and `project_assets` in parallel
- Filter state determines which data source to display
- Files tab renders `project_assets` with asset cards showing type, dimensions, and status
- Asset cards link to detail page for viewing/editing

### Asset Detail Page

**Route**: `/a/:accountId/:projectId/assets/:assetId`

**Implementation**: `app/features/assets/pages/detail.tsx`

**Features**:
- **TanStack Table** with dynamic columns from `table_data.headers`
- **Inline cell editing** - click any cell to edit, auto-saves on blur
- **Sorting** - click column headers to sort ascending/descending
- **Global search** - filter across all columns
- **Pagination** - 25/50/100/250 rows per page
- **CSV export** - download current data as CSV
- **Editable title & description** - inline edit in header section

**Data Flow**:
1. Agent pastes spreadsheet → `parseSpreadsheet` tool parses and saves to `project_assets`
2. Tool auto-generates title (from column names) and description (row/column summary)
3. User clicks asset card in Files tab → navigates to detail page
4. User edits cells → action handler updates `table_data` in database
5. User edits title/description → action handler updates metadata fields

**Agent Keywords** (for saving spreadsheets):
- "save this table"
- "save the spreadsheet"
- "import this data"
- Just paste CSV/TSV data directly

The agent uses `parseSpreadsheet` tool which automatically saves to `project_assets` with `saveToAssets: true`.

### CRM Import Flow

**Tool**: `importPeopleFromTable`

**Trigger**: When `parseSpreadsheet` returns `looksLikeContacts: true`, agent offers to import.

**Features**:

- **Auto-detect column mappings** - name, email, phone, company, title, etc.
- **Organization creation** - creates `organizations` from company column
- **Duplicate detection** - skips rows where email already exists
- **People-Organization linking** - creates `people_organizations` junction records

**Column Detection Patterns**:

| Field | Detected Columns |
|-------|------------------|
| name | name, fullname, contactname |
| email | email, emailaddress, mail |
| phone | phone, mobile, cell, telephone |
| company | company, organization, org, employer, account |
| title | title, jobtitle, position, designation |
| linkedin | linkedin, linkedinurl |

**Example Flow**:

1. User pastes CSV with contacts
2. `parseSpreadsheet` parses and saves to `project_assets`
3. Agent sees `looksLikeContacts: true` and asks "Import these as People?"
4. User confirms
5. Agent calls `importPeopleFromTable` with `assetId`
6. Tool creates People and Organizations, returns summary

### Opportunity Import Flow

**Tool**: `importOpportunitiesFromTable`

**Trigger**: When `parseSpreadsheet` returns `looksLikeOpportunities: true`, agent offers to import.

**Features**:

- **Auto-detect column mappings** - deal name, amount, stage, close date, account, etc.
- **Organization creation** - creates `organizations` from account column
- **Duplicate detection** - skips rows where CRM external ID already exists
- **Opportunity-Organization linking** - links opportunities to organizations

**Column Detection Patterns**:

| Field | Detected Columns |
|-------|------------------|
| name/title | deal, opportunity, dealname, opportunityname |
| amount | amount, value, dealvalue, revenue, price |
| stage | stage, dealstage, status, phase |
| close_date | closedate, expectedclose, closingdate |
| account | account, company, organization, customer |
| probability | probability, winprobability, confidence |
| source | source, leadsource, origin, channel |
| crm_id | crmid, externalid, salesforceid, hubspotid |

**Example Flow**:

1. User pastes CSV with deals/opportunities
2. `parseSpreadsheet` parses and saves to `project_assets`
3. Agent sees `looksLikeOpportunities: true` and asks "Import these as Opportunities?"
4. User confirms
5. Agent calls `importOpportunitiesFromTable` with `assetId`
6. Tool creates Opportunities and Organizations, returns summary

### Schema Overview

```sql
-- See: supabase/schemas/25_project_assets.sql

create table project_assets (
    id uuid primary key,
    account_id uuid not null,
    project_id uuid not null,

    -- Classification
    asset_type asset_type not null,  -- 'table', 'pdf', 'document', 'image', 'link'
    title text not null,

    -- Storage
    media_url text,                   -- R2/S3 URL for binary files
    content_md text,                  -- Markdown representation
    content_raw text,                 -- Original raw content

    -- Structured data (for tables)
    table_data jsonb,                 -- {headers, rows, column_types}
    row_count int,
    column_count int,

    -- Processing & search
    status asset_status,
    embedding vector(1536),
    ...
);

-- Junction table for evidence extraction
create table asset_evidence (
    asset_id uuid references project_assets(id),
    evidence_id uuid references evidence(id),
    row_index int,                    -- Which row this evidence came from
    extraction_type text,             -- 'row', 'column_summary', 'document_summary'
    ...
);
```

### Evidence Generation Flow

```text
project_assets (table/PDF)
       │
       ▼ (AI extracts insights)
   evidence (one per row, or summary)
       │
       ├──► asset_evidence (provenance link)
       │
       ▼ (links to themes)
   theme_evidence
```

### Row Limits

| Limit | Value | Rationale |
|-------|-------|-----------|
| Display limit | 100 rows | Good UX, prevents UI slowdown |
| Storage limit | 1000 rows | Reasonable for analysis |
| File storage | Unlimited | Store original in R2, parse on demand |

---

## Use Case Priorities

### Tier 1: Core Data Ingestion (MVP)

| Priority | Use Case | Description | Effort | Status |
|----------|----------|-------------|--------|--------|
| **P0** | Copy-paste tabular data | User pastes CSV/TSV into chat, agent parses and displays as markdown table | 2 hrs | ✅ Done |
| **P0** | Display markdown tables | Streamdown renders GFM tables in agent responses | 0 hrs | ✅ Done |
| **P0** | Save to `project_assets` | Persist parsed tables for future reference | 2 hrs | ✅ Done |
| **P1** | AI-assisted table analysis | Agent reasons about tabular data, suggests insights | 4 hrs | ✅ Done |
| **P1** | People/Org import prompt | Detect contact data, offer CRM import | 4-6 hrs | ✅ Done |

### Tier 2: File & Cloud Ingestion

| Priority | Use Case | Description | Effort | Status |
|----------|----------|-------------|--------|--------|
| **P2** | CSV file upload | Drag-drop CSV files into chat | 3-4 hrs | Planned |
| **P2** | PDF upload & extraction | Upload PDF, extract text, create asset | 4-6 hrs | Planned |
| **P2** | Google Sheets link | Paste sheet URL, agent reads via Pica API | 2-3 hrs | Planned |
| **P3** | Excel file upload | Support .xlsx/.xls via SheetJS (7.5MB bundle) | 2 hrs | Deferred |

### Tier 3: CRM Import/Export

| Priority | Use Case | Description | Effort | Status |
|----------|----------|-------------|--------|--------|
| **P2** | Import customer list | Upload CSV with customer metadata, create People records | 6-8 hrs | Planned |
| **P3** | Export to CRM | Push data to Salesforce, HubSpot via Pica | 4-6 hrs | Future |

### Tier 4: Communication Ingestion

| Priority | Use Case | Description | Effort | Status |
|----------|----------|-------------|--------|--------|
| **P2** | Calendar integration | Get meeting notifications, generate daily briefs | 8-12 hrs | Planned |
| **P3** | Slack ingestion | Import customer/team messages (user-selected channels) | 8-12 hrs | Future |
| **P3** | Email ingestion | Parse email threads, extract customer signals | 8-12 hrs | Future |

---

## Technical Architecture

### Data Flow

```text
┌─────────────────────────────────────────────────────────────┐
│                     User Interface                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Copy-Paste  │  │ File Drop   │  │ Integration Links   │ │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘ │
└─────────┼────────────────┼───────────────────┼─────────────┘
          │                │                   │
          ▼                ▼                   ▼
┌─────────────────────────────────────────────────────────────┐
│                   Agent Tools Layer                          │
│  ┌────────────────┐  ┌────────────────┐  ┌───────────────┐ │
│  │parseSpreadsheet│  │ uploadAsset    │  │ Pica ToolKit  │ │
│  └───────┬────────┘  └───────┬────────┘  └───────┬───────┘ │
└──────────┼───────────────────┼───────────────────┼─────────┘
           │                   │                   │
           ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────────────┐
│                   Storage Layer                              │
│  ┌────────────────┐  ┌──────────┐  ┌──────────┐            │
│  │ project_assets │  │ evidence │  │ people   │            │
│  │ (tables, PDFs) │  │          │  │          │            │
│  └───────┬────────┘  └────▲─────┘  └────▲─────┘            │
│          │                │             │                   │
│          └────────────────┴─────────────┘                   │
│              asset_evidence (provenance)                    │
└─────────────────────────────────────────────────────────────┘
```

### Integration Layer: Pica

We have a **Pica Pro license** which provides:

- **200+ integrations** (Google Sheets, Slack, Gmail, Calendar, Salesforce, etc.)
- **Mastra-native SDK** - direct integration with our agent framework
- **Managed OAuth** - no token handling required
- **25,000+ pre-built actions** with LLM-optimized descriptions

---

## Implementation Roadmap

### Phase 1: Foundation ✅

- [x] `parseSpreadsheet` tool for copy-paste CSV/TSV
- [x] Markdown table rendering via Streamdown
- [x] `project_assets` schema created

### Phase 2: Persistence (Current)

- [x] Update `parseSpreadsheet` to save to `project_assets`
- [x] Contact detection (looksLikeContacts, contactColumns in output)
- [ ] Add tool progress streaming via `writer.custom()`
- [ ] `importPeopleFromTable` batch tool for People import

### Phase 3: File Uploads

- [ ] PDF upload + text extraction
- [ ] CSV/Excel file upload
- [ ] Evidence extraction from assets

### Phase 4: Cloud Integrations

- [ ] Pica SDK integration
- [ ] Google Sheets read tool
- [ ] Calendar integration + daily briefs

---

## Package Decisions

| Need | Package | Size | Notes |
|------|---------|------|-------|
| CSV parsing | **PapaParse** | 260 KB | Best-in-class, handles edge cases |
| PDF extraction | **pdf-parse** | ~500 KB | Server-side text extraction |
| Excel parsing | SheetJS | 7.5 MB | Deferred - heavy bundle |
| Cloud integrations | **Pica SDK** | ~50 KB | Pro license available |

---

## Technical Designs

### Design 1: Save Spreadsheet to `project_assets`

**Goal**: When user pastes tabular data, save it as a persistent asset.

**Implementation**:

```typescript
// In parseSpreadsheet tool, after parsing:
const { data: asset } = await supabaseAdmin
  .from("project_assets")
  .insert({
    account_id: accountId,
    project_id: projectId,
    asset_type: "table",
    title: `Table: ${headers.slice(0, 3).join(", ")}...`,
    content_md: markdownTable,
    content_raw: content,  // Original CSV for re-parsing
    table_data: { headers, rows: sampleRows },
    row_count: rows.length,
    column_count: headers.length,
    source_type: "paste",
    status: "ready",
  })
  .select("id")
  .single();

// Return asset info
return {
  ...existingOutput,
  assetId: asset.id,
  assetUrl: `${HOST}/a/${accountId}/${projectId}/assets/${asset.id}`,
};
```

**Effort**: ~2 hours

---

### Design 2: Prompt for People/Org Import

**Goal**: When spreadsheet looks like contact data, offer to import into CRM.

**Detection heuristics** (check headers):

- Contains: `name`, `email`, `phone`, `company`, `organization`, `title`, `role`
- At least 2 of these present = likely contact data

**Implementation Options**:

| Option | Approach | Pros | Cons |
|--------|----------|------|------|
| **A: Agent prompts** | Agent detects pattern, asks user, then calls `upsertPerson` in loop | Simple, no new code | Slow for many rows, token-heavy |
| **B: Batch import tool** | New `importPeopleFromTable` tool that bulk-inserts | Fast, efficient | New tool to build |
| **C: Sub-agent** | Dedicated `dataImportAgent` handles CRM imports | Clean separation | Over-engineering for now |

**Recommendation**: **Option B** - Create a dedicated `importPeopleFromTable` tool.

```typescript
// New tool: import-people-from-table.ts
export const importPeopleFromTableTool = createTool({
  id: "import-people-from-table",
  description: "Bulk import people from parsed spreadsheet data into the CRM",
  inputSchema: z.object({
    rows: z.array(z.record(z.string(), z.string())),
    columnMapping: z.object({
      name: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      company: z.string().optional(),
      title: z.string().optional(),
      // ... other mappings
    }),
    sourceRecordId: z.string().optional().describe("ID of the table record this came from"),
  }),
  // ... bulk insert logic
});
```

**Agent instruction update**:

```text
When parseSpreadsheet returns data that looks like contacts (has name, email, company columns):
1. Ask user: "This looks like contact data. Would you like me to import these X people into your CRM?"
2. If yes, call importPeopleFromTable with appropriate column mapping
3. Report results: "Imported X people, Y organizations created"
```

**Effort**: ~4-6 hours

---

### Design 3: Tool Status Streaming Updates

**Problem**: Long-running tools (1-2 min) show only "Thinking..." with no progress.

**Solution**: Use Mastra's `writer.custom()` to stream progress updates.

**How it works**:

```typescript
// In tool execute function:
execute: async ({ context, writer, runtimeContext }) => {
  // Stream progress update
  await writer?.custom({
    type: "tool-progress",
    data: {
      tool: "parseSpreadsheet",
      status: "parsing",
      message: "Parsing 500 rows...",
      progress: 25,
    },
    transient: true,  // Don't persist in message history
  });

  // ... do work ...

  await writer?.custom({
    type: "tool-progress",
    data: {
      tool: "parseSpreadsheet",
      status: "analyzing",
      message: "Detecting column types...",
      progress: 50,
    },
    transient: true,
  });

  // ... more work ...

  return result;
}
```

**Client-side handling**:

```typescript
// In ProjectStatusAgentChat.tsx
const [toolProgress, setToolProgress] = useState<ToolProgress | null>(null);

const { messages } = useChat({
  onData: ({ data, type }) => {
    if (type === "tool-progress") {
      setToolProgress(data);
    }
  },
});

// In render:
{toolProgress && (
  <div className="flex items-center gap-2 text-sm text-muted-foreground">
    <Spinner />
    <span>{toolProgress.message}</span>
    {toolProgress.progress && (
      <Progress value={toolProgress.progress} className="w-20" />
    )}
  </div>
)}
```

**Effort**: ~3-4 hours

**Changes needed**:

1. Update `parseSpreadsheet` tool to use `writer.custom()`
2. Add `onData` handler to `ProjectStatusAgentChat`
3. Create `ToolProgressIndicator` component
4. Apply pattern to other long-running tools

---

## Sub-Agent Strategy Recommendation

**Question**: Should we use a sub-agent for CRM imports?

**Recommendation**: **No, not yet.**

**Rationale**:

| Factor | Sub-Agent | Direct Tool |
|--------|-----------|-------------|
| Complexity | High - agent orchestration | Low - single tool call |
| Latency | Slower - extra LLM call | Faster - direct execution |
| Error handling | Complex - agent may hallucinate | Simple - deterministic |
| When to use | Complex multi-step workflows | Single-purpose operations |

**When to introduce sub-agents**:

- When import requires multi-step reasoning (e.g., deduplication decisions)
- When user interaction is needed mid-process
- When orchestrating multiple tools with conditional logic

**For now**: Keep it simple with a batch import tool. The main agent can handle the "ask user → call tool" flow.

---

## Related Docs

- [Task System](../task-system-technical-design.md)
- [Interview Processing](../../interview-processing-flows.md)
- [Supabase How-To](../../supabase-howto.md)
