# Web Research & Note Indexing

This document describes the web research capabilities and note indexing features that enable semantic search across all types of evidence.

## Overview

The Insights platform supports two main types of evidence sources:

1. **Primary Sources (Interviews)**: Direct conversations with customers, users, or stakeholders
2. **Secondary Sources (Notes/Documents)**: Web research, meeting notes, market reports, and other documents

Both types are indexed for semantic search using OpenAI embeddings, allowing users to query across all evidence in natural language.

## Web Research Tool

### Capabilities

The web research tool (`webResearchTool`) enables AI agents to:

1. Search the web using Exa.ai for market research, competitor analysis, and industry trends
2. Automatically save results as notes for future reference
3. Create evidence records with embeddings for semantic search
4. Return a concise TLDR with a link to the full note

### How It Works

1. **Search**: Uses Exa.ai to find relevant web pages based on a query
2. **Save Note**: Creates an interview record with `source_type: "note"` and `media_type: "web_research"`
3. **Create Evidence**: For each search result, creates an evidence record with:
   - `source_type: "secondary"`
   - `method: "market_report"`
   - OpenAI `text-embedding-3-small` embeddings (1536 dimensions)
4. **Return TLDR**: Returns a brief summary: "X sources found. Key: 1. Title; 2. Title; 3. Title"

### Usage via AI Agent

Users can ask the project status agent to perform web research:

```
"Research the latest trends in B2B SaaS pricing"
"Find information about competitor X's product features"
"Search for market size data on vertical Y"
```

The agent will:
1. Perform the search
2. Return a brief TLDR (not a verbose summary)
3. Provide a link to the full research note

## Note Indexing

### The Index Now Button

Notes that aren't automatically indexed can be manually indexed via the "Index Now" button on the note detail page. This:

1. Extracts evidence using BAML's `ExtractEvidenceFromDocument` function
2. Generates embeddings for each evidence unit
3. Stores evidence records linked to the note
4. Updates the note with indexing metadata

### How to Index a Note

1. Navigate to the note detail page
2. Click the "Index Now" button in the header
3. Wait for the background task to complete (~10-30 seconds)
4. The badge will update to show "X evidence indexed"

### What Gets Extracted

The BAML extraction identifies:

- **Gist**: A 12-word headline capturing the essence
- **Verbatim**: Key quote or excerpt (50 words max)
- **Context Summary**: Why this matters (1-2 sentences)
- **Empathy Map Facets**: Pains, gains, thinks, feels (optional)

### Trigger Task

The indexing is performed by the `note.index` Trigger.dev task:

```typescript
// API: POST /api/index-note
// Body: { interviewId: "uuid", maxEvidence: 15 }

// Task: src/trigger/note/indexNote.ts
// ID: "note.index"
```

## Evidence Differentiation

### Visual Indicators

Evidence cards show the source type:

- **Interview** (blue badge with mic icon): Primary source from direct conversation
- **Note** (amber badge with file icon): Secondary source from documents

### Database Fields

| Field | Interview Evidence | Note Evidence |
|-------|-------------------|---------------|
| `source_type` | `"primary"` | `"secondary"` |
| `method` | `"interview"` | `"market_report"` or `"other"` |
| `interview.source_type` | `"upload"` or `"recording"` | `"note"` |
| `interview.media_type` | `"interview"` | `"web_research"`, `"note"`, etc. |

### Semantic Search

Both types of evidence are searchable via:

1. **`semanticSearchEvidence`** tool: Natural language search across all evidence
2. **`find_similar_evidence`** SQL function: Vector similarity search
3. **AI Agent queries**: "What have customers said about X?" searches both interviews and notes

## Architecture

```
User Request
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│                    AI Agent (Mastra)                        │
├─────────────────────────────────────────────────────────────┤
│  webResearchTool                                            │
│  ├── Exa.ai search                                          │
│  ├── Create note (interviews table, source_type="note")     │
│  ├── Create evidence records with embeddings                │
│  └── Return TLDR + link                                     │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Semantic Search                          │
├─────────────────────────────────────────────────────────────┤
│  find_similar_evidence(query_embedding, ...)                │
│  ├── pgvector cosine similarity                             │
│  └── Returns evidence from both interviews AND notes        │
└─────────────────────────────────────────────────────────────┘
```

## Configuration

### Environment Variables

```env
# Required for web research
EXA_API_KEY=your-exa-api-key

# Required for embeddings
OPENAI_API_KEY=your-openai-api-key
```

### BAML Functions

- `ExtractEvidenceFromDocument`: Extracts evidence from plain text documents
- Location: `baml_src/extract_evidence_from_document.baml`

### Trigger Tasks

- `note.index`: Indexes a note for semantic search
- Location: `src/trigger/note/indexNote.ts`

## Best Practices

1. **Keep web research focused**: Specific queries yield better results
2. **Review indexed evidence**: Check that extracted evidence is accurate
3. **Link related content**: Connect notes to relevant interviews or people
4. **Re-index after edits**: If note content changes significantly, re-index

## Future Improvements

- [ ] Auto-index notes on save (after delay)
- [ ] Bulk indexing for imported documents
- [ ] Citation linking to source URLs
- [ ] Confidence scoring for extracted evidence
