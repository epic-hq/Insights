# Insights - Technical Design

## Data Flow

```
Interview uploaded
       ↓
Transcript generated
       ↓
Evidence extracted (quotes + timestamps + embeddings)
       ↓
Themes created via LLM
       ↓
Evidence linked to themes via vector similarity
       ↓
UI shows theme → evidence → video player
```

## Database

```sql
themes
├── id, name, statement
├── category, pain, jtbd (metadata)
└── project_id

evidence
├── id, verbatim, gist
├── anchors (JSON with timestamps, media_key)
├── embedding (vector for similarity search)
└── interview_id, project_id

theme_evidence (junction)
├── theme_id, evidence_id
├── confidence (similarity score)
└── rationale
```

## Evidence → Theme Linking

We use **semantic similarity**, not LLM-generated IDs (LLMs hallucinate UUIDs).

```typescript
// For each theme, find matching evidence
const searchQuery = `${theme.statement}. ${theme.inclusion_criteria}`
const embedding = await generateEmbedding(searchQuery)
const matches = await supabase.rpc("find_similar_evidence", {
  query_embedding: embedding,
  match_threshold: 0.40,  // similarity cutoff
  match_count: 50
})
```

## Video Playback

Evidence has `anchors` with timing info:
```json
{
  "start_ms": 45000,
  "media_key": "projects/abc/interviews/xyz/media.mp4"
}
```

`EvidenceCard` uses `SimpleMediaPlayer` to play from the exact timestamp.

## Refresh All

Runs three operations in sequence:

1. **Consolidate** - LLM groups themes, vector search links evidence
2. **Delete empty** - Remove themes with 0 evidence (cleanup)
3. **Enrich** - Add pain/jtbd/category metadata using linked evidence

## Key Files

| File | Purpose |
|------|---------|
| `app/features/themes/db.autoThemes.server.ts` | Theme consolidation + evidence linking |
| `app/features/evidence/components/EvidenceCard.tsx` | Evidence display with video player |
| `app/utils/media-url.client.ts` | Generate signed URLs for video playback |
| `supabase/schemas/34_embeddings.sql` | `find_similar_evidence` RPC |

## API

```
POST /api/consolidate-themes  → Merge themes + link evidence
POST /api/delete-empty-themes → Cleanup
POST /api/enrich-themes       → Add metadata
```
