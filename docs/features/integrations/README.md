# External Integrations Strategy

> **Status**: Planning
> **Last Updated**: 2024-12-11
> **Owner**: Product/Engineering

## Vision

Transform Upsight into an **AI-native CRM** that automatically ingests, organizes, and surfaces customer intelligence from all touchpoints—spreadsheets, meetings, emails, Slack, and more.

---

## Use Case Priorities

### Tier 1: Core Data Ingestion (MVP)

| Priority | Use Case | Description | Effort | Status |
|----------|----------|-------------|--------|--------|
| **P0** | Copy-paste tabular data | User pastes CSV/TSV into chat, agent parses and displays as markdown table | 2 hrs | ✅ Done |
| **P0** | Display markdown tables | Streamdown renders GFM tables in agent responses | 0 hrs | ✅ Done |
| **P1** | Mini-tables for structured data | Inline-editable tables for market data, customer segments, competitor analysis. Multi-modal (links, images, numbers). Manages evidence + embeddings. | 8-12 hrs | 🔜 Planned |
| **P1** | AI-assisted table analysis | Agent reasons about tabular data, suggests insights, helps edit/transform | 4 hrs | 🔜 Planned |

### Tier 2: File & Cloud Ingestion

| Priority | Use Case | Description | Effort | Status |
|----------|----------|-------------|--------|--------|
| **P2** | CSV file upload | Drag-drop CSV files into chat, parse with PapaParse | 3-4 hrs | Planned |
| **P2** | Google Sheets link | Paste sheet URL, agent reads via Pica API | 2-3 hrs | Planned |
| **P3** | Excel file upload | Support .xlsx/.xls via SheetJS (7.5MB bundle) | 2 hrs | Deferred |

### Tier 3: CRM Import/Export

| Priority | Use Case | Description | Effort | Status |
|----------|----------|-------------|--------|--------|
| **P2** | Import customer list | Upload CSV with customer metadata (status, next steps, etc.), create People records | 6-8 hrs | Planned |
| **P3** | Export to CRM | Push data to Salesforce, HubSpot via Pica | 4-6 hrs | Future |

### Tier 4: Communication Ingestion

| Priority | Use Case | Description | Effort | Status |
|----------|----------|-------------|--------|--------|
| **P2** | Calendar integration | Get meeting notifications, generate daily briefs, trigger AI recorder | 8-12 hrs | Planned |
| **P3** | Slack ingestion | Import customer/team messages, integrate into knowledge base | 8-12 hrs | Future |
| **P3** | Email ingestion | Parse email threads, extract customer signals | 8-12 hrs | Future |

---

## Technical Architecture

### Integration Layer: Pica

We have a **Pica Pro license** which provides:

- **200+ integrations** (Google Sheets, Slack, Gmail, Calendar, Salesforce, etc.)
- **Mastra-native SDK** - direct integration with our agent framework
- **Managed OAuth** - no token handling required
- **25,000+ pre-built actions** with LLM-optimized descriptions

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
│  │parseSpreadsheet│  │ uploadFile     │  │ Pica ToolKit  │ │
│  │ (PapaParse)    │  │ (local parse)  │  │ (cloud APIs)  │ │
│  └───────┬────────┘  └───────┬────────┘  └───────┬───────┘ │
└──────────┼───────────────────┼───────────────────┼─────────┘
           │                   │                   │
           ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────────────┐
│                   Data Processing                            │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Normalize → Validate → Create Evidence → Generate Embed ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│                   Storage Layer                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐ │
│  │ evidence │  │ people   │  │ insights │  │ embeddings  │ │
│  └──────────┘  └──────────┘  └──────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Use Case Details

### 1. Mini-Tables for Structured Data

**Goal**: Allow users to create, view, and edit structured data inline in the app.

**Requirements**:

- Inline-editable table component (not just markdown display)
- Support for multi-modal cells (text, numbers, links, images)
- Auto-create evidence records from table rows
- Generate embeddings for semantic search
- Save to `project_sections` or dedicated table

**Data types**:

- Sales data (revenue, pipeline, close dates)
- Customer segments (name, size, characteristics)
- Competitor analysis (features, pricing, positioning)
- Feature prioritization (impact, effort, status)

### 2. Calendar Integration (Meeting Prep)

**Goal**: Proactive daily briefs and AI recorder coordination.

**Flow**:

1. User connects Google Calendar via Pica
2. System polls for upcoming meetings (daily cron)
3. Before each meeting:
   - Identify attendees → match to People records
   - Pull relevant evidence, past conversations
   - Generate prep brief
4. At meeting time:
   - Trigger AI recorder to join (if enabled)
   - Post-meeting: auto-process transcript

**Pica actions needed**:

- `google-calendar.list-events`
- `google-calendar.get-event`

### 3. Slack/Email Ingestion

**Goal**: Capture customer signals from communication channels.

**Flow**:

1. User connects Slack workspace / Gmail via Pica
2. Agent can search/read messages on demand
3. Optional: webhook for real-time ingestion
4. Extract insights, link to People/Projects

**Pica actions needed**:

- `slack.search-messages`
- `slack.get-channel-history`
- `gmail.search-messages`
- `gmail.get-message`

---

## Implementation Roadmap

### Phase 1: Foundation (Current Sprint)

- [x] `parseSpreadsheet` tool for copy-paste CSV/TSV
- [x] Markdown table rendering via Streamdown
- [ ] Test end-to-end with agent

### Phase 2: Enhanced Tables

- [ ] PapaParse integration for better CSV parsing
- [ ] Mini-table UI component with inline editing
- [ ] Evidence creation from table rows
- [ ] Embedding generation for table content

### Phase 3: Cloud Integrations

- [ ] Pica SDK integration
- [ ] Google Sheets read tool
- [ ] Customer list import flow

### Phase 4: Communication Hub

- [ ] Calendar integration + daily briefs
- [ ] Slack message ingestion
- [ ] Email thread parsing

---

## Package Decisions

| Need | Package | Size | Notes |
|------|---------|------|-------|
| CSV parsing | **PapaParse** | 260 KB | Best-in-class, handles edge cases |
| Excel parsing | SheetJS | 7.5 MB | Deferred - heavy bundle |
| Cloud integrations | **Pica SDK** | ~50 KB | Pro license available |
| Table UI | TBD | - | Consider TanStack Table or custom |

---

## Open Questions

1. **Mini-table storage**: New table or extend `project_sections`?
2. **Evidence granularity**: One evidence per row, or per table?
we should probably limit
3. **Calendar polling**: Cron job or webhook?
Explain what is possible with picaos, and compare LOE.
4. **Slack scope**: All channels or user-selected?
just user-selected channels.

---

---

## Technical Designs

### Design 1: Save Spreadsheet as Interview Record

**Goal**: When user pastes tabular data, save it as a persistent record for future reference.

**Implementation**:

```typescript
// In parseSpreadsheet tool, after parsing:
const { data: record } = await supabaseAdmin
  .from("interviews")
  .insert({
    account_id: accountId,
    project_id: projectId,
    title: `Table: ${headers.slice(0, 3).join(", ")}...`,
    observations_and_notes: markdownTable,
    source_type: "note",
    media_type: "table",  // New media_type value
    status: "ready",
    conversation_analysis: {
      note_type: "spreadsheet",
      headers,
      row_count: rows.length,
      import_date: new Date().toISOString(),
      raw_content: content,  // Store original for re-parsing
    },
  })
  .select("id")
  .single();
```

**Effort**: ~2 hours

**Changes needed**:

1. Update `parseSpreadsheet` tool to save to `interviews` table
2. Add `media_type: "table"` to the insert
3. Return `recordId` and `recordUrl` in tool output
4. Update agent instructions to mention the saved record

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
