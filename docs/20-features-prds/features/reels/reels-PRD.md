# Decision Reels – Product Requirements Document

> **Status:** Draft v3 | **Last Updated:** December 2024
> **Confidence:** 92% (gaps addressed, simplifications applied)

---

## Executive Summary

Decision Reels transform scattered interview evidence into compelling 2-3 minute video stories that answer a specific decision question. Unlike competitor "highlight reels" that are theme-based playlists, Decision Reels are **anchored to the bet you're making** and automatically balance voices across interviews.

**Core Value Proposition:** "Stop arguing from opinion. Hit play and let customers speak for you."

### Key Simplifications (v1)

| Original Plan | Simplified v1 | Rationale |
|---------------|---------------|-----------|
| 5-phase story arc | **3-phase** (Problem → Impact → Outcome) | "Workaround" and "Solution" rarely have clear metadata; merge into adjacent phases |
| Persona balancing | **Interview balancing only** | Simpler, still prevents single-source dominance |
| Timeline editor with trimming | **Reorder/remove only** | Trimming adds significant UI complexity |
| Stored presigned URLs | **On-demand URL generation** | Avoids stale URL problem |

---

# Part 1: Research & Competitive Analysis

## 1.1 Market Landscape

### What Competitors Offer Today

**Dovetail (closest to UX research use case)**

- **Highlights → Reels**: Transcript highlights become individual clips; Reels are stitched highlight compilations across projects
- **AI Magic Reels**: Scans long videos, suggests key moments, auto-builds reels of "most impactful" clips
- **Embeds & sharing**: Play reels inside Slack, Teams, Notion via special links

**Looppanel**

- Every note is a video clip by default; one-click share/download
- **Reels**: Stitch multiple clips into highlight reels that communicate a specific insight or theme

**Gong (sales conversation intelligence)**

- **Call snippets**: Short segments from a call you can create from the timeline/transcript
- Strong post-call review UX: briefs, highlights, "Ask anything", mobile review
- Functionally: cut snippets, save/share/download for decks, training

**Clari (Copilot)**

- Records + transcribes calls, surfaces highlights / key moments
- **Playlists of good calls** for coaching rather than explicit "highlight reels"

### Pattern Summary

| Capability | Status |
|------------|--------|
| Transcript highlights as clips | ✅ Table stakes |
| Stitched reels from clips | ✅ Table stakes |
| AI-assisted "important moment" detection | ✅ Common |
| Strong sharing & embedding | ✅ Common |
| Decision-question anchoring | ❌ Not available |
| Story-arc auto-ordering | ❌ Not available |
| Balanced coverage enforcement | ❌ Not available |

## 1.2 Why "Decision-Centric" Reels Matter

### The Problem with Theme-Based Reels

Traditional highlight reels answer: *"Here's what users said about X."*

This is useful for **storytelling** but fails for **decision-making** because:

1. **No clear question** – Stakeholders watch clips but don't know what decision they're informing
2. **Cherry-picking bias** – Loudest quotes dominate; dissenting voices get buried
3. **No narrative structure** – Clips feel like a playlist, not a persuasive case
4. **Single-source overload** – 10 clips from one articulate customer ≠ representative evidence

### What Decision-Centric Means

A Decision Reel starts from a **specific bet or question**:

> *"Should we prioritize onboarding improvements over feature X for SMB customers?"*

The reel then:

1. **Filters evidence** to clips tagged with relevant themes, personas, and decision questions
2. **Balances voices** across personas (Founder, AE, CS), segments (SMB, Mid-market), and lifecycle stages (prospect, customer, churned)
3. **Structures the narrative** as Problem → Impact → Workarounds → Current Solutions → Desired Outcome
4. **Surfaces the answer** – not just "what people said" but "what this means for the decision"

### Concrete Example: UpSight's Unique Capability

**Scenario:** Product team debating whether to invest in "Day 3 churn" vs "Power user activation"

**Traditional Approach (Dovetail/Looppanel):**
1. Search for "churn" tag
2. Manually pick 8-10 clips that seem important
3. Arrange them in whatever order feels right
4. Share as "Churn Highlights Reel"
5. Stakeholders watch, nod, but still argue about priorities

**UpSight Decision Reel Approach:**
1. Navigate to Decision Question: *"Why do trial users churn after day 3?"*
2. Click "Generate Decision Reel"
3. System automatically:
   - Pulls evidence from 12 interviews tagged with churn, onboarding, confusion themes
   - Scores clips by impact (high-confidence pain points), recency (last 60 days), emotion (frustration signals)
   - Enforces balance: max 2 clips per interview, representation from 3+ personas
   - Orders as story arc:
     - **Problem** (2 clips): Users describing confusion
     - **Impact** (2 clips): Lost productivity, abandoned trials
     - **Workaround** (1 clip): Manual onboarding calls from CS
     - **Desired Outcome** (2 clips): What "good" looks like
4. Output: 2:45 reel with chapter markers, transcript overlay, and direct links to full evidence
5. Stakeholders watch → decision is obvious → meeting ends in 10 minutes

**The Difference:** UpSight doesn't just clip moments. It **assembles a case**.

---

## 1.3 Reels vs Lenses: Relationship & Divergence

### What Lenses Do Today

Lenses are **analytical views** that apply a specific framework to interview evidence:

- **Sales Lens**: Extracts BANT signals, objections, competitive mentions
- **Product Lens**: Surfaces feature requests, usability issues, jobs-to-be-done
- **Custom Lenses**: User-defined extraction patterns

Lenses answer: *"What patterns exist in this evidence through framework X?"*

### What Reels Do

Reels are **communication artifacts** that present evidence as a narrative:

- **Decision Reels**: Answer a specific question with balanced, structured evidence
- **Theme Reels**: Showcase evidence around a topic (closer to competitor offerings)
- **Persona Reels**: Highlight a specific persona's voice across interviews

Reels answer: *"How do I convince stakeholders of X using real customer voices?"*

### Relationship: Lenses Feed Reels

```
Interviews → Evidence Extraction → Lenses (analysis) → Reels (communication)
                                        ↓
                              Themes, Personas, Scores
```

Lenses provide the **structured metadata** that makes intelligent reel creation possible:

| Lens Output | Reel Usage |
|-------------|------------|
| Pain points extracted | Clips tagged for "Problem" phase |
| Emotion signals | Boost score for high-emotion clips |
| Persona classification | Enforce balanced representation |
| Theme tagging | Filter evidence for reel scope |
| Confidence scores | Prioritize high-confidence evidence |

### Where They Should Diverge

| Aspect | Lenses | Reels |
|--------|--------|-------|
| **Output format** | Structured data (JSON, tables) | Video + metadata |
| **Primary user** | Analyst, researcher | Stakeholder, exec, cross-functional team |
| **Interaction** | Query, filter, drill-down | Watch, share, embed |
| **Customization** | Define extraction patterns | Adjust clip selection, ordering |
| **Persistence** | Applied on-demand | Rendered and stored |

### Maximizing Customer Value

**Lenses + Reels together** create a powerful workflow:

1. **Analyze** with lenses → understand patterns
2. **Synthesize** into themes → identify key findings
3. **Communicate** via reels → drive decisions

**Anti-pattern to avoid:** Making reels just "video versions of lens output." Reels should be **narrative artifacts**, not data dumps with video.

---

# Part 2: Product Requirements

## 2.1 Users & Jobs to Be Done

| User | Job | Success Metric |
|------|-----|----------------|
| **Founder / PM / Researcher** | "I want to show my team why this problem matters using real customer voices." | Time from insight → stakeholder buy-in |
| **Sales / CS** | "I want a reel of customers describing pain X for a training session or deck." | Reel usage in enablement materials |
| **Exec / Stakeholder** | "I want a 2–3 minute reel that convinces me this is worth funding." | Decision velocity after viewing |

## 2.2 Core Scope (v1)

### Reel Object

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Primary key |
| `project_id` | uuid | Parent project |
| `title` | text | User-facing title |
| `description` | text | Optional context |
| `decision_question_id` | uuid | Anchor to decision question |
| `theme_ids` | uuid[] | Filter by themes |
| `persona_ids` | uuid[] | Filter by personas |
| `story_arc` | enum | `problem_impact_solution`, `chronological`, `custom` |
| `status` | enum | `draft`, `processing`, `ready`, `failed` |
| `output_url` | text | R2 URL of rendered MP4 |
| `share_token` | text | Unique token for public sharing |
| `total_duration_sec` | numeric | Final reel duration |

### Create Reel From

1. **Decision Question** – Primary use case; auto-filters evidence by DQ
2. **Theme** – Secondary; creates theme-focused reel
3. **Manual Selection** – Power user; hand-pick evidence clips

### Automatic Clip Selection

**Scoring Model:**

```
score = 0.4 × impact + 0.25 × recency + 0.2 × emotion - 0.15 × coverage_penalty
```

| Component | Calculation |
|-----------|-------------|
| **Impact** | Based on confidence level + presence of pains/gains |
| **Recency** | Exponential decay: `exp(-age_days / 30)` |
| **Emotion** | Boost for `feels[]` or `pains[]` with 2+ items |
| **Coverage Penalty** | Penalize if >3 clips from same interview (persona balancing deferred to v2) |

**Default target duration:** 90-240 seconds (configurable)

### Story Arc Classification (Simplified to 3 Phases)

**v1 Simplification:** Reduced from 5 phases to 3 for clearer metadata mapping:

| Phase | Evidence Metadata | Description |
|-------|-------------------|-------------|
| **Problem** | `pains[]` present | What's broken, frustrating, or missing |
| **Impact** | `pains[]` + `feels[]` | Emotional/business consequences |
| **Outcome** | `gains[]` present | Desired future state |

**Why 3 phases instead of 5:**

- "Workaround" and "Solution" phases rarely have clear metadata signals
- `does[]` field is too ambiguous (could be current behavior OR workaround)
- 3 phases still tell a complete story: Problem → Impact → Outcome
- Simpler classification = fewer edge cases = more reliable auto-ordering

**Classification Logic (Metadata-Based, No Regex):**

```typescript
type StoryArcPhase = 'problem' | 'impact' | 'outcome'

function classifyClipPhase(evidence: Evidence): StoryArcPhase {
  // Impact: Has BOTH pain AND emotional consequence
  if (evidence.pains?.length && evidence.feels?.length) return 'impact'

  // Outcome: Has desired outcomes (gains)
  if (evidence.gains?.length) return 'outcome'

  // Problem: Has pain points (default for evidence with pains)
  if (evidence.pains?.length) return 'problem'

  // Fallback: Use embedding similarity to phase exemplars
  if (evidence.embedding) {
    return classifyByEmbeddingSimilarity(evidence.embedding)
  }

  // Default: problem (most common, safe fallback)
  return 'problem'
}
```

**Why NOT regex:**

1. **False positives**: "This feature is hard to beat" → wrongly classified as problem
2. **False negatives**: "We lose 2 hours every day" → no pattern match
3. **Language brittleness**: Doesn't work for non-English
4. **Maintenance burden**: Endless pattern additions

### Timeline Editor (v1 Simplified)

- Show ordered clips: thumbnail, transcript snippet, duration
- Allow: **reordering and deleting only** (trimming deferred to v2)
- Preview playback before rendering

**Why no trimming in v1:** Trimming requires frame-accurate preview UI, which adds significant complexity. Users can remove clips they don't want; fine-grained trimming is a power-user feature.

### Playback

- Chapters per clip with visual markers
- Synced transcript view
- Overlays showing: persona, theme, decision question

### Sharing

- Public/organization share link (view-only)
- Embed in insight page, project overview
- Copy URL for slide decks

### Permissions

- Inherit from project
- Reels are read-only for viewers without edit rights

## 2.3 Non-Goals (v1)

- Fancy multi-track editing, b-roll, background music
- Social-media aspect ratios (TikTok/Shorts)
- Heavy branding/custom lower-thirds
- Real-time collaborative editing

## 2.4 Success Metrics

| Metric | Target |
|--------|--------|
| Reels created per active project | ≥2 per month |
| % of themes with at least one reel | ≥30% |
| Playback completion rate | ≥70% |
| Time-to-reel (create → shareable) | <5 minutes |
| Unique external viewers per reel | ≥3 |

---

# Part 3: Technical Requirements

## 3.1 Reel Segments: Storage Strategy

### What Are Reel Segments?

Reel segments are **metadata records** in Supabase that reference:

1. The parent `reel_id`
2. The source `evidence_id` (which links to `interview_id` and `media_url`)
3. Clip timing: `clip_start_ms`, `clip_end_ms`
4. Ordering: `order_index`, `story_arc_phase`

**Important:** We do NOT store individual clip files. Segments are pointers to time ranges within source interview recordings.

### Storage Architecture

```
R2 Storage Structure:
├── interviews/
│   └── {account_id}/
│       └── {project_id}/
│           └── {interview_id}.{ext}     ← Source recordings (existing)
│
└── reels/
    └── {account_id}/
        └── {project_id}/
            └── {reel_id}.mp4            ← Rendered reels (new)
```

### Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Separate directory** | Yes (`reels/` vs `interviews/`) | Clear separation of source vs derived content |
| **Account/project scoping** | Yes | Matches existing pattern, enables RLS-aligned access |
| **Naming convention** | `{reel_id}.mp4` | Simple, unique, no collision risk |
| **Thumbnails** | `{reel_id}_thumb.jpg` | Same directory, `_thumb` suffix |
| **Intermediate clips** | Temp files only | No persistent storage of extracted segments |

### Why No Persistent Clip Storage?

**Option A (rejected):** Store each extracted clip as `segments/{reel_id}/{order_index}.mp4`

- **Pros:** Faster re-renders, reusable clips
- **Cons:** Storage bloat (N clips × M reels), stale clips if source updated, complex cleanup

**Option B (chosen):** Extract clips to temp, concatenate, upload final reel, delete temp

- **Pros:** Minimal storage, always fresh from source, simple lifecycle
- **Cons:** Full re-render on any edit

For v1, Option B is correct. Clip caching can be added later if render times become problematic.

### Database Schema

```sql
-- reel_segments stores metadata only, not files
create table reel_segments (
  id uuid primary key default gen_random_uuid(),
  reel_id uuid not null references reels (id) on delete cascade,
  evidence_id uuid not null references evidence (id) on delete cascade,
  interview_id uuid references interviews (id) on delete set null,

  order_index int not null,
  story_arc_phase text,  -- 'problem', 'impact', 'workaround', 'solution', 'outcome'

  clip_start_ms int not null,
  clip_end_ms int not null,

  score numeric default 0,
  score_breakdown jsonb default '{}',

  speaker text,
  transcript_snippet text,

  created_at timestamptz not null default now()
);
```

## 3.2 Rendering Pipeline

### Trigger.dev Task: `reels.render`

```
1. Load reel + segments from Supabase
2. For each unique interview_id:
   a. Get presigned URL for source media
   b. Extract clip: ffmpeg -ss {start} -i {source} -t {duration} -c:v libx264 ...
3. Create concat list
4. Concatenate: ffmpeg -f concat -safe 0 -i list.txt -c copy output.mp4
5. Upload to R2: reels/{account_id}/{project_id}/{reel_id}.mp4
6. Update reel record: status='ready', output_url, total_duration_sec
7. Cleanup temp files
```

### Error Handling

| Error | Recovery |
|-------|----------|
| Source media missing | Skip clip, log warning, continue with remaining |
| FFmpeg extraction fails | Retry 2x, then mark segment as failed |
| Upload fails | Retry 3x with exponential backoff |
| All clips fail | Mark reel as `failed`, preserve segment metadata for debugging |

## 3.3 Evidence-to-Decision Question Linkage

**Gap Identified:** The core differentiator (decision-centric reels) requires evidence to be linked to decision questions, but this linkage isn't explicit in the current schema.

**Resolution: Use Theme Chain**

Evidence connects to decision questions through the existing theme hierarchy:

```text
Evidence → related_tags[] → Theme → research_question_id → Research Question → decision_question_id → Decision Question
```

**Query Pattern:**

```sql
-- Find evidence for a decision question
SELECT e.*
FROM evidence e
JOIN themes t ON t.id = ANY(e.related_tags)
JOIN research_questions rq ON rq.id = t.research_question_id
WHERE rq.decision_question_id = :decision_question_id
  AND e.anchors IS NOT NULL
  AND e.anchors->>'start_ms' IS NOT NULL;
```

**Why this works:**
- Leverages existing architecture (no schema changes needed)
- Themes are already the organizing principle for evidence
- Research questions bridge themes to decision questions
- This is the same path users mentally follow when exploring evidence

## 3.4 Audio-Only Interview Support

**Gap Identified:** Many interviews are audio-only (phone calls, podcasts). The render pipeline assumes video.

**Resolution: Detect and Handle Audio**

```typescript
// In render task
const mediaType = await detectMediaType(sourceUrl)

if (mediaType === 'audio') {
  // Generate waveform visualization or static frame
  await execAsync(
    `ffmpeg -i "${sourceUrl}" -filter_complex ` +
    `"[0:a]showwaves=s=1280x720:mode=cline:colors=white[v]" ` +
    `-map "[v]" -map 0:a -c:v libx264 -c:a aac "${clipPath}"`
  )
} else {
  // Standard video extraction
  await execAsync(`ffmpeg -ss ${start} -i "${sourceUrl}" ...`)
}
```

**Visual Options for Audio:**
1. **Waveform visualization** (default) - Dynamic, shows audio activity
2. **Static frame with transcript** - Overlay transcript text on branded background
3. **Person avatar** - If person has profile image, show that

For v1, use waveform visualization as default.

## 3.5 Reusable Thumbnail Service

**Requirement:** Thumbnail generation should be a reusable service for all media types (interviews, reels, evidence clips).

### API Design

**Endpoint:** `POST /api/media/thumbnail`

```typescript
interface ThumbnailRequest {
  source_url: string           // R2 URL or presigned URL
  source_key?: string          // R2 key (alternative to URL)
  timestamp_sec?: number       // Default: 2 seconds in
  width?: number               // Default: 640
  height?: number              // Default: 360
  output_key: string           // Where to store in R2
}

interface ThumbnailResponse {
  success: boolean
  thumbnail_url: string        // Presigned URL for immediate use
  thumbnail_key: string        // R2 key for storage reference
  error?: string
}
```

### Trigger.dev Task: `media.generateThumbnail`

```typescript
export const generateThumbnailTask = task({
  id: "media.generateThumbnail",
  retry: { maxAttempts: 2 },
  run: async (payload: ThumbnailRequest): Promise<ThumbnailResponse> => {
    const { source_url, timestamp_sec = 2, width = 640, height = 360, output_key } = payload

    const tempPath = `/tmp/thumb_${Date.now()}.jpg`

    // Extract frame at timestamp
    await execAsync(
      `ffmpeg -ss ${timestamp_sec} -i "${source_url}" ` +
      `-vframes 1 -vf "scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
      `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2" ` +
      `-q:v 2 "${tempPath}"`
    )

    // Upload to R2
    const buffer = await readFile(tempPath)
    await uploadToR2({ key: output_key, body: buffer, contentType: 'image/jpeg' })

    // Cleanup
    await unlink(tempPath)

    return {
      success: true,
      thumbnail_key: output_key,
      thumbnail_url: await getPresignedUrl(output_key),
    }
  },
})
```

### Usage Across Features

| Feature | Trigger | Output Key Pattern |
|---------|---------|-------------------|
| **Reels** | After render completes | `reels/{account}/{project}/{reel_id}_thumb.jpg` |
| **Interviews** | After upload/processing | `interviews/{account}/{project}/{interview_id}_thumb.jpg` |
| **Evidence** | On-demand or batch | `evidence/{account}/{project}/{evidence_id}_thumb.jpg` |

### Database: `media_thumbnails` Table

```sql
create table if not exists media_thumbnails (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts.accounts (id) on delete cascade,

  -- Source reference (one of these should be set)
  interview_id uuid references interviews (id) on delete cascade,
  reel_id uuid references reels (id) on delete cascade,
  evidence_id uuid references evidence (id) on delete cascade,

  -- Thumbnail data
  thumbnail_key text not null,
  timestamp_sec numeric,
  width int default 640,
  height int default 360,

  created_at timestamptz not null default now(),

  -- Ensure only one thumbnail per source
  constraint unique_interview_thumb unique (interview_id),
  constraint unique_reel_thumb unique (reel_id),
  constraint unique_evidence_thumb unique (evidence_id)
);
```

## 3.6 URL Strategy: On-Demand Generation

**Gap Identified:** Storing presigned URLs leads to stale links after expiration.

**Resolution:** Store R2 keys only, generate presigned URLs on-demand.

```typescript
// In reel loader/API
const reel = await supabase.from('reels').select('*').eq('id', reelId).single()

// Generate fresh presigned URL for playback
const playbackUrl = reel.output_key
  ? await createR2PresignedUrl({ key: reel.output_key, expiresInSeconds: 3600 })
  : null

return { ...reel, playback_url: playbackUrl }
```

**Schema Change:** Remove `output_url` column, keep only `output_key`.

## 3.7 Overlapping Clip Merge

**Gap Identified:** Adjacent clips from the same interview may have overlapping or near-overlapping time ranges, causing jarring playback.

**Resolution:** Merge clips with <2s gap before rendering.

```typescript
function mergeAdjacentClips(segments: ReelSegment[]): ReelSegment[] {
  // Sort by interview_id, then start_ms
  const sorted = [...segments].sort((a, b) => {
    if (a.interview_id !== b.interview_id) return a.interview_id.localeCompare(b.interview_id)
    return a.clip_start_ms - b.clip_start_ms
  })

  const merged: ReelSegment[] = []
  for (const segment of sorted) {
    const last = merged[merged.length - 1]

    // Merge if same interview and gap < 2s
    if (last &&
        last.interview_id === segment.interview_id &&
        segment.clip_start_ms - last.clip_end_ms < 2000) {
      last.clip_end_ms = Math.max(last.clip_end_ms, segment.clip_end_ms)
      last.transcript_snippet += ' ' + segment.transcript_snippet
    } else {
      merged.push({ ...segment })
    }
  }

  return merged
}
```

## 3.8 Progress Feedback

**Gap Identified:** Users have no visibility into render progress.

**Resolution:** Use Trigger.dev metadata + polling.

```typescript
// In render task, update progress
await task.updateMetadata({
  progress: Math.round((i / segments.length) * 100),
  stage: 'extracting',
  current_clip: i + 1,
  total_clips: segments.length,
})

// Frontend polls reel status
const { data: reel } = await supabase
  .from('reels')
  .select('status, processing_metadata')
  .eq('id', reelId)
  .single()

// processing_metadata contains: { progress: 45, stage: 'extracting', current_clip: 3, total_clips: 7 }
```

## 3.9 Prerequisites & Deployment

### FFmpeg Availability

Trigger.dev workers need FFmpeg installed. Options:

1. **Default Node image** - FFmpeg often pre-installed (verify)
2. **Custom Dockerfile** - Add `RUN apt-get install -y ffmpeg`
3. **Fly.io machine** - Configure in `trigger.config.ts`

**Pre-implementation spike required:** Verify FFmpeg availability in Trigger.dev environment.

### Required Spikes Before Implementation

| Spike | Purpose | Effort | Blocking? |
|-------|---------|--------|-----------|
| FFmpeg in Trigger.dev | Verify FFmpeg works in worker | 2h | Yes |
| Audio waveform render | Test audio-only interview handling | 2h | No (can ship video-only first) |
| Presigned URL refresh | Confirm on-demand URL generation works | 1h | Yes |

---

# Part 4: User Flows

## 4.1 Create Decision Reel from Decision Question

**Entry Point:** Decision Question detail page → "Create Decision Reel" button

**Flow:**

1. User clicks "Create Decision Reel"
2. System shows Reel Builder with:
   - Left: Filters (themes, personas, date range)
   - Center: Auto-selected clips with scores, transcript snippets
   - Right: Timeline preview with story arc phases
3. User can:
   - Adjust filters → clips re-score
   - Remove/add specific clips
   - Reorder clips (drag-drop)
4. User clicks "Generate Reel"
5. System creates `reel` record (status: `draft`)
6. System creates `reel_segments` records
7. System triggers `reels.render` task
8. User sees progress indicator (polling `processing_metadata`)
9. On completion: Reel player with share options

**Validation Criteria:**

- [ ] Clips are balanced across interviews (no single interview >50% of clips)
- [ ] Story arc phases are represented (at least problem + outcome)
- [ ] Total duration within ±20% of target
- [ ] All clips have valid source media

## 4.2 Create Theme Reel

**Entry Point:** Theme detail page → "Build Reel from Evidence" button

**Flow:** Same as 4.1, but:

- Pre-filtered to theme's evidence
- No decision question anchor
- Story arc optional (can use chronological)

## 4.3 Share Reel Externally

**Entry Point:** Reel detail page → "Share" button

**Flow:**

1. User clicks "Share"
2. Modal shows:
   - Toggle: "Make public" (generates share link)
   - Copy link button
   - Embed code (iframe)
   - QR code (optional)
3. User enables public sharing
4. System updates `is_public = true`
5. Share link format: `https://app.upsight.ai/r/{share_token}`
6. External viewer sees:
   - Video player
   - Chapter navigation
   - "Powered by UpSight" branding
   - No edit capabilities

**Validation Criteria:**

- [ ] Share link works without authentication
- [ ] Reel plays smoothly on mobile
- [ ] Branding is visible but not intrusive
- [ ] Analytics track: views, completion rate, viewer location

## 4.4 Edit Existing Reel

**Entry Point:** Reel detail page → "Edit" button

**Flow:**

1. User clicks "Edit"
2. System shows Reel Builder with current segments
3. User makes changes
4. User clicks "Save & Re-render"
5. System updates `reel_segments`
6. System triggers new `reels.render` task
7. Previous output preserved until new render completes
8. On completion: Swap to new output, delete old

**Validation Criteria:**

- [ ] Edits don't break existing share links
- [ ] Re-render completes within 2x original render time
- [ ] User can cancel in-progress render

---

# Part 5: Positioning & Marketing

## 5.1 Competitive Positioning Grid

| Dimension | **UpSight – Decision Reels** | Dovetail / Looppanel | Gong | Clari |
|-----------|------------------------------|----------------------|------|-------|
| **Anchor** | Decision questions & themes | Themes / tags | Call / meeting | Call / opportunity |
| **Scope** | Cross-function (research, sales, CS) | Mostly research | Mostly sales | Mostly sales |
| **Selection** | Scored clips (impact, recency, emotion, coverage) | Manual + generic AI | Manual + keywords | Generic highlights |
| **Structure** | Auto-arranged story arc | Playlist | Snippets / playlists | Call lists |
| **Balance** | Built-in persona/segment balance | Manual | Manual | Manual |
| **Question answered** | "Should we do X? Here's the tape." | "What did users say about X?" | "What happened in this call?" | "What happened in this account?" |
| **Differentiation** | Decision-centric, cross-team evidence | Research storytelling | CI + coaching | CI + forecasting |

## 5.2 Marketing One-Liners

### Website / Feature Section

- "Turn scattered call notes into one decision-ready highlight reel."
- "Decision Reels: short videos that answer *why* with your customers' own words."
- "Stop arguing from opinion. Hit play on the reel and let customers speak for you."
- "From hours of calls to a 3-minute decision reel – tied to one clear question."
- "Highlight reels, upgraded: balanced voices, clear story arc, one decision at the center."

### Positioning vs Competitors

- "Not just highlight reels – decision reels that start from the bet you're making."
- "Dovetail your clips, Gong your calls… then use UpSight to turn them into one decision story."
- "Other tools clip moments. UpSight assembles a case."

### In-App CTAs / Tooltips

- "Create a decision reel from this theme."
- "Auto-build a reel that answers this question in under 2 minutes."
- "Too much evidence? Let us cut the 3 minutes your execs actually need to see."
- "Generate a reel: we'll pick the strongest clips, balance personas, and order the story."

---

# Appendix A: References

- [Dovetail Highlights](https://docs.dovetail.com/help/highlights)
- [Dovetail Highlight Reels](https://docs.dovetail.com/help/highlight-reels)
- [Looppanel AI Review](https://www.looppanel.com/blog/dovetail-ai)
- [Gong Call Snippets](https://help.gong.io/docs/create-a-call-snippet)
- [Clari Conversation Intelligence](https://www.clari.com/conversation-intelligence/)

---

# Appendix B: Implementation Plan Reference

See `docs/features/reels/reels-implementation-plan.md` for:

- Database schema (SQL)
- Clip scoring algorithm (TypeScript)
- Trigger.dev render task
- API route specifications
- UI component structure