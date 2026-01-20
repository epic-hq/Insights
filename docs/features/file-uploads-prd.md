# PRD: File Uploads in ProjectStatusAgent

## Overview

Enable ProjectStatusAgent to accept file uploads (PDF, CSV, images, text documents), store them in Cloudflare R2, and process them intelligently based on content type. Processing includes text extraction, chunking with embeddings for semantic search, vision analysis for images, and structured data import for spreadsheets.

## Problem Statement

Currently, users can only provide data to ProjectStatusAgent via:
- Text paste (CSV data, notes)
- URLs (web content, video links)
- Voice conversations

Users frequently have valuable information locked in files:
- **PDFs**: Contracts, reports, research papers, competitor materials
- **Images**: Screenshots, whiteboard photos, competitor ads, UI mockups
- **CSVs/Spreadsheets**: Contact lists, competitive matrices, marketing plans
- **Text documents**: Meeting notes, strategy documents, interview transcripts

Without file upload support, users must manually copy-paste content or describe images verbally, losing fidelity and context.

## Goals

1. **Unified file ingestion**: Accept PDF, CSV, images, and text documents via chat
2. **Content-aware processing**: Apply appropriate extraction/analysis based on file type
3. **Searchable storage**: All content indexed with embeddings for semantic search
4. **Actionable imports**: CSV contacts/opportunities imported with full attribute preservation
5. **Agent-accessible**: Files become tools the agent can reference in future conversations

## User Stories

### Story 1: Upload a PDF Report
> "As a product manager, I want to upload a competitive analysis PDF so that the agent can reference it when discussing market positioning."

**Flow**:
1. User uploads `competitor-analysis.pdf`
2. System extracts text, chunks into semantic sections
3. Each chunk embedded and stored in `project_assets`
4. Agent confirms: "I've processed your competitive analysis (23 pages). I found sections on pricing, features, and market share. What would you like to explore?"

### Story 2: Upload a Contact List
> "As a sales lead, I want to upload my CSV of conference contacts so they're added to my CRM with all their attributes."

**Flow**:
1. User uploads `conference-leads.csv`
2. System parses, detects contact columns via AI mapping
3. Agent shows preview: "Found 47 contacts with name, email, company, title, and 3 custom fields (booth_visited, interest_level, follow_up_date). Import all?"
4. User confirms, contacts imported with custom fields as facets
5. Contacts searchable by any attribute

### Story 3: Upload a Competitor Screenshot
> "As a UX designer, I want to upload screenshots of competitor apps so the agent can analyze their design patterns."

**Flow**:
1. User uploads `competitor-pricing-page.png`
2. System sends to OpenAI Vision API
3. Agent responds: "I've analyzed the screenshot. This is [Competitor]'s pricing page showing 3 tiers: Starter ($29), Pro ($79), Enterprise (custom). The Pro tier is highlighted as 'Most Popular'. Notable features: usage-based add-ons, annual discount callout. Want me to add this to your competitive analysis?"

### Story 4: Upload Meeting Notes
> "As a researcher, I want to upload my handwritten meeting notes photo so the agent can extract action items."

**Flow**:
1. User uploads `whiteboard-notes.jpg`
2. Vision API extracts handwritten text
3. Agent responds: "I've transcribed your whiteboard notes. I found: 3 action items, 2 decision points, and 5 follow-up questions. Should I create tasks for the action items?"

## Technical Design

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ProjectStatusAgent                                 │
│                                                                             │
│  ┌─────────────┐    ┌──────────────────┐    ┌─────────────────────────┐   │
│  │ uploadFile  │───>│ FileProcessor    │───>│ project_assets          │   │
│  │    Tool     │    │ (Trigger.dev)    │    │ + embeddings            │   │
│  └─────────────┘    └──────────────────┘    └─────────────────────────┘   │
│                              │                                             │
│                              ▼                                             │
│              ┌───────────────┴───────────────┐                            │
│              │      Content-Aware Router      │                            │
│              └───────────────┬───────────────┘                            │
│                              │                                             │
│         ┌────────────┬───────┼───────┬────────────┐                       │
│         ▼            ▼       ▼       ▼            ▼                       │
│    ┌─────────┐ ┌─────────┐ ┌─────┐ ┌─────────┐ ┌─────────┐              │
│    │  PDF    │ │  Image  │ │ CSV │ │  Text   │ │  Other  │              │
│    │Extractor│ │ Vision  │ │Parse│ │ Chunker │ │ Storage │              │
│    └────┬────┘ └────┬────┘ └──┬──┘ └────┬────┘ └────┬────┘              │
│         │           │         │         │           │                     │
│         ▼           ▼         ▼         ▼           ▼                     │
│    ┌─────────────────────────────────────────────────────┐               │
│    │              Embedding & Indexing Pipeline          │               │
│    │  (text-embedding-3-small + full-text search)        │               │
│    └─────────────────────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1. New Tool: `uploadFileTool`

**Location**: `app/mastra/tools/upload-file.ts`

```typescript
export const uploadFileTool = createTool({
  id: "uploadFile",
  description: `Process and store an uploaded file. Supports:
- PDF: Extract text, chunk, embed for semantic search
- CSV/TSV: Parse, detect schema, optionally import as contacts/opportunities
- Images (PNG, JPG, WEBP): Vision analysis, extract text/insights
- Text (TXT, MD): Chunk and embed for search

Files are stored in R2 and indexed for future reference.`,

  inputSchema: z.object({
    fileUrl: z.string().describe("Presigned R2 URL or data URL of the uploaded file"),
    fileName: z.string().describe("Original filename with extension"),
    mimeType: z.string().describe("MIME type of the file"),
    purpose: z.string().optional().describe("User's stated purpose for this file"),
    autoImport: z.boolean().default(false).describe("If CSV with contacts/opportunities, auto-import"),
  }),

  execute: async (input, context) => {
    const accountId = context.requestContext.get("account_id")
    const projectId = context.requestContext.get("project_id")
    const userId = context.requestContext.get("user_id")

    // 1. Validate file type
    const fileType = detectFileType(input.fileName, input.mimeType)
    if (!SUPPORTED_TYPES.includes(fileType)) {
      return { success: false, error: `Unsupported file type: ${fileType}` }
    }

    // 2. Store raw file in R2
    const r2Key = `assets/${accountId}/${projectId}/${ulid()}.${getExtension(input.fileName)}`
    await uploadToR2FromUrl(input.fileUrl, r2Key)

    // 3. Create asset record (status: 'processing')
    const { data: asset } = await supabase.from('project_assets').insert({
      account_id: accountId,
      project_id: projectId,
      created_by: userId,
      name: input.fileName,
      asset_type: mapToAssetType(fileType),
      status: 'uploading',
      source_type: 'upload',
      media_key: r2Key,
      original_filename: input.fileName,
      mime_type: input.mimeType,
      processing_metadata: { purpose: input.purpose }
    }).select().single()

    // 4. Trigger async processing
    const result = await processFileUpload.triggerAndWait({
      assetId: asset.id,
      fileType,
      r2Key,
      autoImport: input.autoImport,
    })

    if (!result.ok) {
      return { success: false, error: result.error }
    }

    return {
      success: true,
      assetId: asset.id,
      assetUrl: generateProjectRoutes(projectId).assets.detail(asset.id),
      ...result.output
    }
  }
})
```

### 2. File Processing Pipeline (Trigger.dev)

**Location**: `src/trigger/assets/process-file-upload.ts`

```typescript
export const processFileUpload = schemaTask({
  id: "asset.process-file-upload",
  schema: z.object({
    assetId: z.string(),
    fileType: z.enum(['pdf', 'csv', 'image', 'text', 'other']),
    r2Key: z.string(),
    autoImport: z.boolean().default(false),
  }),

  run: async ({ assetId, fileType, r2Key, autoImport }) => {
    // Update status
    await updateAssetStatus(assetId, 'processing')

    try {
      // Route to appropriate processor
      switch (fileType) {
        case 'pdf':
          return await processPdf(assetId, r2Key)
        case 'csv':
          return await processCsv(assetId, r2Key, autoImport)
        case 'image':
          return await processImage(assetId, r2Key)
        case 'text':
          return await processText(assetId, r2Key)
        default:
          return await storeOnly(assetId, r2Key)
      }
    } catch (error) {
      await updateAssetStatus(assetId, 'error', { error: error.message })
      throw error
    }
  }
})
```

### 3. Content Processors

#### 3.1 PDF Processor

**Dependencies**: `pdf-parse` or `@anthropic-ai/sdk` (Claude PDF support)

```typescript
async function processPdf(assetId: string, r2Key: string): Promise<ProcessResult> {
  // 1. Download from R2
  const pdfBuffer = await downloadFromR2(r2Key)

  // 2. Extract text (using pdf-parse or Claude's native PDF support)
  const extractedText = await extractPdfText(pdfBuffer)

  // 3. Chunk text semantically (by headers, paragraphs, page breaks)
  const chunks = await chunkDocument(extractedText, {
    maxChunkSize: 1000,      // ~1000 tokens per chunk
    overlapSize: 100,        // 100 token overlap for context
    preserveStructure: true, // Keep headers with their content
  })

  // 4. Generate embeddings for each chunk
  const embeddings = await generateEmbeddings(chunks.map(c => c.text))

  // 5. Store chunks as child assets or in asset_chunks table
  await storeChunks(assetId, chunks, embeddings)

  // 6. Generate summary
  const summary = await generateDocumentSummary(extractedText)

  // 7. Update parent asset
  await supabase.from('project_assets').update({
    status: 'ready',
    content_md: summary,
    processing_metadata: {
      pageCount: chunks.length,
      extractedCharacters: extractedText.length,
      chunkCount: chunks.length,
    }
  }).eq('id', assetId)

  return {
    type: 'pdf',
    summary,
    pageCount: chunks.length,
    searchable: true,
  }
}
```

#### 3.2 CSV Processor

**Leverages existing**: `parseSpreadsheet` tool logic

```typescript
async function processCsv(
  assetId: string,
  r2Key: string,
  autoImport: boolean
): Promise<ProcessResult> {
  // 1. Download and parse
  const csvContent = await downloadFromR2AsText(r2Key)

  // 2. Use existing parseSpreadsheet logic
  const parseResult = await parseSpreadsheetCore({
    csvContent,
    assetId,
    projectId,
  })

  // 3. Store table data
  await supabase.from('project_assets').update({
    status: 'ready',
    content_md: parseResult.markdownTable,
    content_raw: csvContent,
    table_data: {
      headers: parseResult.headers,
      rows: parseResult.rows,
      column_types: parseResult.columnTypes,
    },
    row_count: parseResult.rowCount,
    column_count: parseResult.columnCount,
    processing_metadata: {
      columnMapping: parseResult.columnMapping,
      looksLikeContacts: parseResult.looksLikeContacts,
      looksLikeOpportunities: parseResult.looksLikeOpportunities,
      suggestedFacets: parseResult.suggestedFacets,
      mappingConfidence: parseResult.mappingConfidence,
    }
  }).eq('id', assetId)

  // 4. Auto-import if requested and confident
  let importResult = null
  if (autoImport && parseResult.mappingConfidence > 0.8) {
    if (parseResult.looksLikeContacts) {
      importResult = await importPeopleFromAsset(assetId, parseResult)
    } else if (parseResult.looksLikeOpportunities) {
      importResult = await importOpportunitiesFromAsset(assetId, parseResult)
    }
  }

  // 5. Generate embedding for semantic search of table content
  const tableDescription = generateTableDescription(parseResult)
  const [embedding] = await generateEmbeddings([tableDescription])
  await supabase.from('project_assets').update({ embedding }).eq('id', assetId)

  return {
    type: 'csv',
    rowCount: parseResult.rowCount,
    columnCount: parseResult.columnCount,
    looksLikeContacts: parseResult.looksLikeContacts,
    looksLikeOpportunities: parseResult.looksLikeOpportunities,
    importResult,
    suggestedFacets: parseResult.suggestedFacets,
    preview: parseResult.markdownTable,
  }
}
```

#### 3.3 Image Processor

**Dependencies**: OpenAI Vision API (`gpt-4o`)

```typescript
async function processImage(assetId: string, r2Key: string): Promise<ProcessResult> {
  // 1. Get presigned URL for OpenAI
  const imageUrl = await createR2PresignedUrl({ key: r2Key, expiresInSeconds: 3600 })

  // 2. Send to OpenAI Vision for analysis
  const analysis = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{
      role: "user",
      content: [
        {
          type: "image_url",
          image_url: { url: imageUrl.url }
        },
        {
          type: "text",
          text: `Analyze this image comprehensively. Extract:
1. Type of content (screenshot, photo, diagram, chart, handwritten notes, etc.)
2. All visible text (OCR)
3. Key information and data points
4. If it's a UI/screenshot: describe the interface, features shown, pricing if visible
5. If it's a chart/graph: extract the data and trends
6. If it's handwritten: transcribe all text
7. Any logos, brands, or company names visible
8. Relevant insights for business/product research

Format as structured JSON with sections for: type, extracted_text, key_insights, entities (companies, people, products), and raw_description.`
        }
      ]
    }],
    response_format: { type: "json_object" },
    max_tokens: 4096,
  })

  const visionResult = JSON.parse(analysis.choices[0].message.content)

  // 3. Generate thumbnail (optional - for gallery view)
  // Could use sharp or a Cloudflare Worker for resizing

  // 4. Create searchable content from analysis
  const searchableContent = [
    visionResult.extracted_text,
    visionResult.raw_description,
    visionResult.key_insights?.join(' '),
  ].filter(Boolean).join('\n\n')

  // 5. Generate embedding
  const [embedding] = await generateEmbeddings([searchableContent])

  // 6. Update asset
  await supabase.from('project_assets').update({
    status: 'ready',
    content_md: formatVisionResultAsMarkdown(visionResult),
    processing_metadata: {
      visionAnalysis: visionResult,
      imageType: visionResult.type,
      extractedEntities: visionResult.entities,
    },
    embedding,
  }).eq('id', assetId)

  return {
    type: 'image',
    imageType: visionResult.type,
    extractedText: visionResult.extracted_text,
    insights: visionResult.key_insights,
    entities: visionResult.entities,
  }
}
```

#### 3.4 Text Document Processor

```typescript
async function processText(assetId: string, r2Key: string): Promise<ProcessResult> {
  // 1. Download text content
  const textContent = await downloadFromR2AsText(r2Key)

  // 2. Detect format (markdown, plain text, etc.)
  const format = detectTextFormat(textContent)

  // 3. Chunk based on format
  const chunks = await chunkDocument(textContent, {
    maxChunkSize: 1000,
    overlapSize: 100,
    format, // Respects markdown headers, etc.
  })

  // 4. Generate embeddings
  const embeddings = await generateEmbeddings(chunks.map(c => c.text))

  // 5. Store chunks
  await storeChunks(assetId, chunks, embeddings)

  // 6. Generate summary
  const summary = await generateDocumentSummary(textContent)

  // 7. Update asset
  await supabase.from('project_assets').update({
    status: 'ready',
    content_md: textContent,
    processing_metadata: {
      format,
      wordCount: textContent.split(/\s+/).length,
      chunkCount: chunks.length,
    },
    embedding: embeddings[0], // Use first chunk or summary embedding
  }).eq('id', assetId)

  return {
    type: 'text',
    format,
    summary,
    wordCount: textContent.split(/\s+/).length,
  }
}
```

### 4. Database Schema Changes

#### 4.1 New Table: `asset_chunks`

For storing document chunks with individual embeddings:

```sql
-- File: supabase/schemas/26_asset_chunks.sql

CREATE TABLE asset_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES project_assets(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  content text NOT NULL,

  -- Metadata
  start_char integer,           -- Position in original document
  end_char integer,
  page_number integer,          -- For PDFs
  section_header text,          -- Parent heading if any

  -- Search
  embedding vector(1536),
  content_tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,

  created_at timestamptz DEFAULT now(),

  UNIQUE(asset_id, chunk_index)
);

-- Indexes
CREATE INDEX idx_asset_chunks_asset_id ON asset_chunks(asset_id);
CREATE INDEX idx_asset_chunks_embedding ON asset_chunks USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_asset_chunks_tsv ON asset_chunks USING gin(content_tsv);
```

#### 4.2 Update `project_assets` Table

Add fields if not present:

```sql
-- Additional processing fields
ALTER TABLE project_assets ADD COLUMN IF NOT EXISTS
  chunk_count integer DEFAULT 0;

ALTER TABLE project_assets ADD COLUMN IF NOT EXISTS
  vision_analysis jsonb;
```

### 5. Search Integration

#### 5.1 Update `semanticSearchAssets` Tool

Extend to search chunks:

```typescript
// In semantic search, also search chunks
const chunkResults = await supabase.rpc('search_asset_chunks', {
  query_embedding: queryEmbedding,
  match_threshold: 0.7,
  match_count: 10,
  p_project_id: projectId,
})

// Combine and dedupe results
const allResults = combineAssetAndChunkResults(assetResults, chunkResults)
```

#### 5.2 New RPC: `search_asset_chunks`

```sql
CREATE OR REPLACE FUNCTION search_asset_chunks(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  p_project_id uuid DEFAULT NULL
)
RETURNS TABLE (
  chunk_id uuid,
  asset_id uuid,
  asset_name text,
  content text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ac.id as chunk_id,
    ac.asset_id,
    pa.name as asset_name,
    ac.content,
    1 - (ac.embedding <=> query_embedding) as similarity
  FROM asset_chunks ac
  JOIN project_assets pa ON pa.id = ac.asset_id
  WHERE
    (p_project_id IS NULL OR pa.project_id = p_project_id)
    AND 1 - (ac.embedding <=> query_embedding) > match_threshold
  ORDER BY ac.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

### 6. Frontend: File Upload Component

**Location**: `app/components/chat/file-upload-button.tsx`

```tsx
interface FileUploadButtonProps {
  onFileSelected: (file: File, purpose?: string) => void
  acceptedTypes?: string[]
  maxSizeMB?: number
}

export function FileUploadButton({
  onFileSelected,
  acceptedTypes = ['.pdf', '.csv', '.tsv', '.txt', '.md', '.png', '.jpg', '.jpeg', '.webp'],
  maxSizeMB = 50
}: FileUploadButtonProps) {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    // Validate size
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(`File too large. Maximum size is ${maxSizeMB}MB`)
      return
    }

    // Validate type
    const ext = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!acceptedTypes.includes(ext)) {
      toast.error(`Unsupported file type: ${ext}`)
      return
    }

    onFileSelected(file)
  }

  return (
    <div
      className={cn(
        "relative",
        isDragging && "ring-2 ring-primary"
      )}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setIsDragging(false)
        const file = e.dataTransfer.files[0]
        if (file) handleFile(file)
      }}
    >
      <Button
        variant="ghost"
        size="icon"
        onClick={() => inputRef.current?.click()}
      >
        <Paperclip className="h-4 w-4" />
      </Button>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={acceptedTypes.join(',')}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
        }}
      />
    </div>
  )
}
```

### 7. Agent Instructions Update

Add to ProjectStatusAgent instructions:

```markdown
## File Upload Handling

When a user uploads a file, use the `uploadFile` tool to process it:

### PDF Documents
- Extracts all text and chunks for semantic search
- Great for: reports, contracts, research papers, competitor materials
- After upload: Summarize key findings and ask what the user wants to explore

### CSV/Spreadsheet Files
- Parses and analyzes column structure
- Detects if it looks like contacts or opportunities
- If contacts: Offer to import to CRM with all attributes as searchable fields
- If data table: Save as asset for reference
- Custom columns become facets (e.g., "interest_level", "event_attended")

### Images
- Sends to vision AI for comprehensive analysis
- Extracts: text (OCR), UI elements, charts/data, logos, insights
- Great for: competitor screenshots, whiteboard photos, ads, mockups
- After analysis: Summarize findings and suggest next actions

### Text Documents
- Chunks and embeds for semantic search
- Preserves markdown structure if present
- Great for: meeting notes, strategy docs, transcripts

### Best Practices
1. Always confirm what you found after processing
2. Offer relevant next actions (import, analyze, compare)
3. Link uploaded content to existing project context
4. Use semantic search to find relevant uploaded content when answering questions
```

## Implementation Plan

### Phase 1: Core Infrastructure (Week 1)

| Task | File(s) | Description |
|------|---------|-------------|
| 1.1 | `supabase/schemas/26_asset_chunks.sql` | Create chunks table + indexes |
| 1.2 | `app/utils/chunking.server.ts` | Document chunking utilities |
| 1.3 | `src/trigger/assets/process-file-upload.ts` | Main processing task |
| 1.4 | `app/mastra/tools/upload-file.ts` | Agent tool definition |

### Phase 2: Processors (Week 2)

| Task | File(s) | Description |
|------|---------|-------------|
| 2.1 | `src/trigger/assets/processors/pdf.ts` | PDF extraction + chunking |
| 2.2 | `src/trigger/assets/processors/image.ts` | OpenAI Vision integration |
| 2.3 | `src/trigger/assets/processors/csv.ts` | Leverage parseSpreadsheet |
| 2.4 | `src/trigger/assets/processors/text.ts` | Text chunking + embedding |

### Phase 3: Search & UI (Week 3)

| Task | File(s) | Description |
|------|---------|-------------|
| 3.1 | `supabase/migrations/xxx_search_chunks.sql` | Chunk search RPC |
| 3.2 | `app/mastra/tools/semantic-search-assets.ts` | Extend to search chunks |
| 3.3 | `app/components/chat/file-upload-button.tsx` | Upload UI component |
| 3.4 | `app/features/chat/components/chat-input.tsx` | Integrate upload button |

### Phase 4: Agent Integration (Week 4)

| Task | File(s) | Description |
|------|---------|-------------|
| 4.1 | `app/mastra/agents/project-status-agent.ts` | Add tool + instructions |
| 4.2 | `app/routes/api.upload-asset.tsx` | Direct upload API endpoint |
| 4.3 | Testing & refinement | End-to-end testing |

## File Types & Processing Matrix

| Type | Extensions | Processing | Output | Searchable By |
|------|------------|------------|--------|---------------|
| PDF | `.pdf` | Text extraction, chunking, embedding | Chunks + summary | Full text, semantic |
| CSV | `.csv`, `.tsv` | Parse, AI column mapping, optional import | Table data, facets | Headers, content, facets |
| Image | `.png`, `.jpg`, `.jpeg`, `.webp` | Vision analysis, OCR | Analysis JSON + markdown | Extracted text, description |
| Text | `.txt`, `.md` | Chunking, embedding | Chunks + full text | Full text, semantic |

## Success Metrics

1. **Processing success rate**: >95% of uploads processed without error
2. **Search relevance**: Uploaded content appears in relevant semantic searches
3. **Import accuracy**: >90% of CSV contacts imported with correct field mapping
4. **Vision accuracy**: Image analysis captures key information (manual spot-check)
5. **User adoption**: Track upload tool usage in agent conversations

## Security Considerations

1. **File validation**: Strict MIME type + extension checking
2. **Size limits**: 50MB default, configurable per account
3. **Malware scanning**: Consider ClamAV integration for uploaded files
4. **Access control**: Files inherit project-level permissions
5. **R2 security**: Presigned URLs with short expiry for processing

## Open Questions

1. **Chunk size tuning**: 1000 tokens optimal or should we experiment?
2. **Vision model choice**: GPT-4o vs Claude 3 for image analysis?
3. **PDF extraction**: pdf-parse vs Claude native PDF vs external service?
4. **Thumbnail generation**: Generate for gallery view or on-demand?
5. **Rate limiting**: Per-user upload limits to prevent abuse?

## Dependencies

- `pdf-parse` or similar for PDF text extraction
- OpenAI API for vision analysis (`gpt-4o`)
- Existing: `@trigger.dev/sdk`, R2 utilities, embedding pipeline

## Appendix: MIME Type Mapping

```typescript
const SUPPORTED_TYPES = {
  // PDF
  'application/pdf': 'pdf',

  // CSV/Spreadsheets
  'text/csv': 'csv',
  'text/tab-separated-values': 'csv',
  'application/vnd.ms-excel': 'csv',

  // Images
  'image/png': 'image',
  'image/jpeg': 'image',
  'image/webp': 'image',
  'image/gif': 'image',

  // Text
  'text/plain': 'text',
  'text/markdown': 'text',
  'text/x-markdown': 'text',
}
```
