---
type: quick-spec
status: ready
feature: Transcript Upload — PDF & TXT Support
parent_prd: prd.md
estimated_effort: 2-4 hours
---

# Spec: Transcript Upload via Existing Path (PDF + TXT)

**Date:** 2026-02-12
**Scope:** Extend `/api/upload-file` to extract text from PDF files and process them through the evidence pipeline, alongside existing TXT support.
**Source Tier:** Tier 1 (Customer Voice) — these are actual meeting transcripts.

---

## Current State

**What works now:**
- `app/routes/api.upload-file.tsx` handles file uploads
- Text files (.txt, .md, .markdown) are detected via `isTextFile` check
- Text content is read, stored as `transcript`, and triggers v2 orchestrator with `resumeFrom: "evidence"`
- Source type is set to `"document"` for text files

**What's missing:**
- PDF files (`application/pdf`, `.pdf`) fall through to the audio/video branch
- No `pdf-parse` package installed — no text extraction from PDFs
- No source type distinction between "transcript" and "document" (both use `"document"`)

---

## Changes Required

### 1. Install `pdf-parse`

```bash
pnpm add pdf-parse
pnpm add -D @types/pdf-parse
```

**Package:** `pdf-parse` — ~500KB, server-side PDF text extraction. Already identified in integrations PRD as the package to use.

### 2. Update `app/routes/api.upload-file.tsx`

#### A. Extend file type detection (line ~84)

```typescript
// BEFORE
const isTextFile =
  file.type.startsWith("text/") ||
  file.name.endsWith(".txt") ||
  file.name.endsWith(".md") ||
  file.name.endsWith(".markdown");

// AFTER
const isTextFile =
  file.type.startsWith("text/") ||
  file.name.endsWith(".txt") ||
  file.name.endsWith(".md") ||
  file.name.endsWith(".markdown");

const isPdfFile =
  file.type === "application/pdf" ||
  file.name.endsWith(".pdf");

const isDocumentFile = isTextFile || isPdfFile;
```

#### B. Update source type detection (line ~96-110)

```typescript
// Add PDF to source type detection
if (isTextFile) {
  sourceType = "transcript";  // Changed from "document" — this IS a transcript
}
if (isPdfFile) {
  sourceType = "transcript";  // PDF transcript
}
```

> **Note:** Using `"transcript"` instead of `"document"` for uploaded transcripts. The `source_type` enum already supports this value per `MediaTypeIcon.tsx`. This distinguishes "uploaded transcript files" from "imported documents" (which will use `"document"` when the connector feature ships).

#### C. Add PDF text extraction branch (inside the `isDocumentFile` block, line ~150)

```typescript
if (isDocumentFile) {
  let textContent: string;

  if (isPdfFile) {
    // Extract text from PDF
    consola.log("Extracting text from PDF:", file.name);
    const { default: pdfParse } = await import("pdf-parse");
    const buffer = Buffer.from(await file.arrayBuffer());
    const pdfData = await pdfParse(buffer);
    textContent = pdfData.text;

    if (!textContent || textContent.trim().length === 0) {
      return Response.json(
        { error: "PDF appears to be scanned/image-based. Text-based PDFs are supported." },
        { status: 400 }
      );
    }

    consola.log(`PDF extracted: ${pdfData.numpages} pages, ${textContent.length} characters`);
  } else {
    // Existing text file handling
    consola.log("Processing text/markdown file:", file.name);
    textContent = await file.text();
  }

  if (!textContent || textContent.trim().length === 0) {
    return Response.json({ error: "File is empty or could not be read" }, { status: 400 });
  }

  transcriptData = safeSanitizeTranscriptPayload({
    full_transcript: textContent.trim(),
    audio_duration: null,
    file_type: isPdfFile ? "pdf" : "text",
    original_filename: file.name,
  });
  mediaUrl = "";

  // For PDFs, also store the original in R2 for reference/download
  if (isPdfFile) {
    const { mediaUrl: storedPdfUrl } = await storeAudioFile({
      projectId,
      interviewId: interview.id,
      source: file,
      originalFilename: file.name,
      contentType: file.type,
    });
    if (storedPdfUrl) {
      mediaUrl = storedPdfUrl;
    }
  }
}
```

#### D. Update interview title for PDF uploads (line ~118)

```typescript
title: isDocumentFile
  ? `${isPdfFile ? "PDF" : "Text"} Transcript - ${format(new Date(), "yyyy-MM-dd")}`
  : interviewTitle,
```

### 3. Update `app/features/onboarding/components/UploadScreen.tsx`

Add PDF to the accepted file types in the file input:

```typescript
// Find the file input accept attribute and add PDF
accept="audio/*,video/*,.txt,.md,.markdown,.pdf,application/pdf"
```

### 4. Update `app/components/ui/MediaTypeIcon.tsx`

Ensure the `transcript` source type has appropriate icon handling (may already work — verify).

---

## Data Flow

```
User uploads transcript.pdf or transcript.txt
  │
  ▼
api.upload-file.tsx
  ├── Detect: isPdfFile or isTextFile
  ├── Extract text (pdf-parse for PDF, file.text() for TXT)
  ├── Create interview record (source_type: "transcript")
  ├── Store original PDF in R2 (if PDF)
  ├── Save transcript text to interview.transcript
  │
  ▼
v2 orchestrator (resumeFrom: "evidence", skipSteps: ["upload"])
  ├── Evidence extraction from transcript text
  ├── Person resolution
  ├── Embedding generation
  │
  ▼
Searchable evidence in semantic search + agent context
```

---

## Edge Cases

| Case | Handling |
|------|----------|
| Scanned/image-only PDF | Return error: "PDF appears to be scanned/image-based" |
| Empty PDF | Return error: "File is empty or could not be read" |
| Very large PDF (>100 pages) | Process anyway — pdf-parse handles it; evidence extraction may truncate |
| PDF with mixed content (text + images) | Extract text portions only; images ignored |
| `.txt` file with non-UTF-8 encoding | `file.text()` handles most encodings; edge case for binary files |
| Duplicate upload of same file | No dedup — creates new interview (consistent with current audio behavior) |

---

## Testing

1. **Upload .txt transcript** — verify it creates interview with `source_type: "transcript"`, triggers evidence extraction, appears in search
2. **Upload .pdf transcript** — verify text extraction, interview creation, evidence extraction, original PDF downloadable from R2
3. **Upload scanned PDF** — verify clean error message
4. **Upload empty .txt** — verify error handling
5. **Verify in UI** — uploaded transcript appears in content list, DocumentViewer shows extracted text, evidence appears on detail page

---

## Files to Modify

| File | Change | Effort |
|------|--------|--------|
| `package.json` | Add `pdf-parse` + `@types/pdf-parse` | 5 min |
| `app/routes/api.upload-file.tsx` | PDF detection, text extraction, source type update | 1 hr |
| `app/features/onboarding/components/UploadScreen.tsx` | Add `.pdf` to accepted file types | 5 min |
| `app/components/ui/MediaTypeIcon.tsx` | Verify `transcript` type icon | 10 min |

**Total estimated effort:** 2-4 hours including testing.

---

## Note
Automatic speaker diarization from text (future — would need AI to identify speakers in plain text)
- PM note: **In Scope** this should go through our standard pipeline which can handle it

## Out of Scope

- OCR for scanned PDFs (future — would need Tesseract or cloud OCR)
- PDF table extraction (future — use existing `parseSpreadsheet` for structured data)
- Source tier classification UI (covered by main data connectors PRD)
