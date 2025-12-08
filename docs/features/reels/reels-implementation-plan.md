# Decision Reels - Implementation Plan

> **Status:** v2 | **Confidence:** 92% | **Last Updated:** December 2024

## Overview

This document outlines the technical implementation plan for the **Decision Reels** feature - a system for creating auto-generated highlight reels from interview evidence, anchored to decision questions and themes.

**Key Differentiators:**
- Decision-centric reels (not just theme playlists)
- Balanced evidence coverage across interviews (persona balancing deferred to v2)
- Story-arc auto-ordering (Problem → Impact → Outcome) - simplified from 5 to 3 phases
- Tight integration with existing evidence/insights architecture

**v1 Simplifications Applied:**
- 3-phase story arc (not 5)
- Interview balancing only (not persona)
- Reorder/remove only (no trimming)
- On-demand URL generation (no stored presigned URLs)

---

## Phase 1: Database Schema

### 1.1 Core Tables

Create `supabase/schemas/70_reels.sql`:

```sql
-- Reels -----------------------------------------------------------------
-- Decision-centric highlight reels composed of evidence clips

create type reel_status as enum (
  'draft',           -- Segments selected, not yet rendered
  'processing',      -- FFmpeg rendering in progress
  'ready',           -- Rendered and available for playback
  'failed'           -- Rendering failed
);

create type reel_story_arc as enum (
  'problem_impact_solution',  -- Default: Problem → Impact → Solutions
  'chronological',            -- Order by evidence timestamp
  'custom'                    -- User-defined order
);

create table if not exists reels (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts.accounts (id) on delete cascade,
  project_id uuid not null references projects (id) on delete cascade,

  -- Metadata
  title text not null,
  description text,

  -- Anchoring (decision-centric)
  decision_question_id uuid references decision_questions (id) on delete set null,
  theme_ids uuid[] default '{}',  -- Can be anchored to multiple themes
  persona_ids uuid[] default '{}', -- Filter by personas

  -- Configuration
  story_arc reel_story_arc not null default 'problem_impact_solution',
  target_duration_sec int default 120, -- Target duration in seconds

  -- Output
  status reel_status not null default 'draft',
  output_url text,  -- R2 URL of rendered MP4
  output_key text,  -- R2 object key
  total_duration_sec numeric,
  thumbnail_url text,

  -- Sharing
  share_token text unique default encode(gen_random_bytes(16), 'hex'),
  is_public boolean default false,

  -- Processing metadata
  processing_metadata jsonb default '{}'::jsonb,

  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id)
);

-- Comments
comment on table reels is 'Decision-centric highlight reels composed of evidence clips.';
comment on column reels.decision_question_id is 'Primary decision question this reel answers.';
comment on column reels.theme_ids is 'Theme UUIDs to filter evidence by.';
comment on column reels.story_arc is 'Ordering strategy for clips.';
comment on column reels.share_token is 'Unique token for public sharing links.';

-- Indexes
create index idx_reels_account_id on reels(account_id);
create index idx_reels_project_id on reels(project_id);
create index idx_reels_decision_question on reels(decision_question_id);
create index idx_reels_status on reels(status);
create index idx_reels_share_token on reels(share_token) where share_token is not null;

-- Triggers
create trigger set_reels_timestamp
  before insert or update on reels
  for each row execute procedure accounts.trigger_set_timestamps();

create trigger set_reels_user_tracking
  before insert or update on reels
  for each row execute procedure accounts.trigger_set_user_tracking();

-- RLS
alter table reels enable row level security;

create policy "Account members can select reels" on reels
  for select to authenticated
  using (account_id in (select accounts.get_accounts_with_role()));

create policy "Account members can insert reels" on reels
  for insert to authenticated
  with check (account_id in (select accounts.get_accounts_with_role()));

create policy "Account members can update reels" on reels
  for update to authenticated
  using (account_id in (select accounts.get_accounts_with_role()));

create policy "Account owners can delete reels" on reels
  for delete to authenticated
  using (account_id in (select accounts.get_accounts_with_role('owner')));

-- Public access via share token
create policy "Public can view shared reels" on reels
  for select to anon
  using (is_public = true and share_token is not null);
```

### 1.2 Reel Segments Table

```sql
-- Reel Segments ---------------------------------------------------------
-- Individual clips that compose a reel

create table if not exists reel_segments (
  id uuid primary key default gen_random_uuid(),
  reel_id uuid not null references reels (id) on delete cascade,
  evidence_id uuid not null references evidence (id) on delete cascade,
  interview_id uuid references interviews (id) on delete set null,

  -- Ordering
  order_index int not null,
  story_arc_phase text, -- 'problem', 'impact', 'solution', etc.

  -- Clip timing (from evidence.anchors)
  clip_start_ms int not null,
  clip_end_ms int not null,

  -- Scoring (for auto-selection)
  score numeric default 0,
  score_breakdown jsonb default '{}'::jsonb, -- {impact, recency, emotion, coverage}

  -- Metadata
  speaker text,
  transcript_snippet text, -- Short excerpt for display

  created_at timestamptz not null default now()
);

-- Comments
comment on table reel_segments is 'Individual evidence clips that compose a reel.';
comment on column reel_segments.story_arc_phase is 'Phase in story arc: problem, impact, workaround, solution, outcome.';
comment on column reel_segments.score is 'Computed relevance score for auto-selection.';

-- Indexes
create index idx_reel_segments_reel_id on reel_segments(reel_id);
create index idx_reel_segments_evidence_id on reel_segments(evidence_id);
create index idx_reel_segments_order on reel_segments(reel_id, order_index);

-- RLS (inherit from parent reel)
alter table reel_segments enable row level security;

create policy "Users can view segments for accessible reels" on reel_segments
  for select to authenticated
  using (
    exists (
      select 1 from reels r
      where r.id = reel_segments.reel_id
        and r.account_id in (select accounts.get_accounts_with_role())
    )
  );

create policy "Users can manage segments for their reels" on reel_segments
  for all to authenticated
  using (
    exists (
      select 1 from reels r
      where r.id = reel_segments.reel_id
        and r.account_id in (select accounts.get_accounts_with_role())
    )
  );
```

---

## Phase 2: Clip Selection Service

### 2.1 Scoring Model

Create `app/features/reels/lib/clip-scoring.ts`:

```typescript
/**
 * Clip Scoring Model for Decision Reels
 *
 * Computes relevance scores for evidence clips based on:
 * - Impact: How significant is this evidence?
 * - Recency: How recent is the interview?
 * - Emotion: Strong emotional signals boost relevance
 * - Coverage: Penalize over-representation of same persona/interview
 */

export interface EvidenceForScoring {
  id: string
  interview_id: string
  anchors: { start_ms?: number; end_ms?: number } | null
  gist: string
  verbatim: string
  confidence: 'low' | 'medium' | 'high' | null
  pains: string[] | null
  gains: string[] | null
  feels: string[] | null
  created_at: string
  // Joined data
  interview?: {
    id: string
    interview_date: string | null
    person_id: string | null
  }
  person?: {
    id: string
    persona_ids: string[]
  }
}

export interface ScoringConfig {
  weights: {
    impact: number      // 0.4 default
    recency: number     // 0.25 default
    emotion: number     // 0.2 default
    coverage: number    // 0.15 default (penalty)
  }
  recencyHalfLifeDays: number  // 30 default
  maxPerInterview: number      // 3 default
  maxPerPersona: number        // 4 default
}

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  weights: {
    impact: 0.4,
    recency: 0.25,
    emotion: 0.2,
    coverage: 0.15,
  },
  recencyHalfLifeDays: 30,
  maxPerInterview: 3,
  maxPerPersona: 4,
}

export interface ScoredClip {
  evidence: EvidenceForScoring
  score: number
  breakdown: {
    impact: number
    recency: number
    emotion: number
    coverage_penalty: number
  }
  clip_start_ms: number
  clip_end_ms: number
  duration_ms: number
}

/**
 * Score a single evidence item
 */
export function scoreEvidence(
  evidence: EvidenceForScoring,
  config: ScoringConfig,
  context: {
    interviewCounts: Map<string, number>
    personaCounts: Map<string, number>
  }
): ScoredClip | null {
  // Skip if no valid anchors
  const anchors = evidence.anchors
  if (!anchors?.start_ms) return null

  const clip_start_ms = Math.max(0, anchors.start_ms - 3000) // 3s buffer
  const clip_end_ms = anchors.end_ms
    ? anchors.end_ms + 3000
    : anchors.start_ms + 30000 // Default 30s clip
  const duration_ms = clip_end_ms - clip_start_ms

  // Skip very short or very long clips
  if (duration_ms < 5000 || duration_ms > 120000) return null

  // Impact score (based on confidence and content richness)
  const impactScore = computeImpactScore(evidence)

  // Recency score (exponential decay)
  const recencyScore = computeRecencyScore(
    evidence.created_at,
    config.recencyHalfLifeDays
  )

  // Emotion score (based on feels/pains/gains)
  const emotionScore = computeEmotionScore(evidence)

  // Coverage penalty
  const coveragePenalty = computeCoveragePenalty(
    evidence,
    context,
    config
  )

  const score =
    config.weights.impact * impactScore +
    config.weights.recency * recencyScore +
    config.weights.emotion * emotionScore -
    config.weights.coverage * coveragePenalty

  return {
    evidence,
    score: Math.max(0, score),
    breakdown: {
      impact: impactScore,
      recency: recencyScore,
      emotion: emotionScore,
      coverage_penalty: coveragePenalty,
    },
    clip_start_ms,
    clip_end_ms,
    duration_ms,
  }
}

function computeImpactScore(evidence: EvidenceForScoring): number {
  let score = 0.5 // Base score

  // Confidence boost
  if (evidence.confidence === 'high') score += 0.3
  else if (evidence.confidence === 'medium') score += 0.15

  // Content richness
  if (evidence.pains?.length) score += 0.1
  if (evidence.gains?.length) score += 0.1

  return Math.min(1, score)
}

function computeRecencyScore(createdAt: string, halfLifeDays: number): number {
  const ageMs = Date.now() - new Date(createdAt).getTime()
  const ageDays = ageMs / (1000 * 60 * 60 * 24)
  return Math.exp(-ageDays / halfLifeDays)
}

function computeEmotionScore(evidence: EvidenceForScoring): number {
  const feels = evidence.feels?.length ?? 0
  const pains = evidence.pains?.length ?? 0

  // Strong emotional signals
  if (feels >= 2 || pains >= 2) return 1
  if (feels >= 1 || pains >= 1) return 0.6
  return 0.2
}

function computeCoveragePenalty(
  evidence: EvidenceForScoring,
  context: {
    interviewCounts: Map<string, number>
    personaCounts: Map<string, number>
  },
  config: ScoringConfig
): number {
  let penalty = 0

  // Interview over-representation
  const interviewCount = context.interviewCounts.get(evidence.interview_id) ?? 0
  if (interviewCount >= config.maxPerInterview) {
    penalty += 0.5
  } else if (interviewCount >= config.maxPerInterview - 1) {
    penalty += 0.25
  }

  // Persona over-representation
  const personaIds = evidence.person?.persona_ids ?? []
  for (const personaId of personaIds) {
    const count = context.personaCounts.get(personaId) ?? 0
    if (count >= config.maxPerPersona) {
      penalty += 0.3
      break
    }
  }

  return Math.min(1, penalty)
}

/**
 * Select top clips for a reel with balanced coverage
 */
export function selectClipsForReel(
  allEvidence: EvidenceForScoring[],
  targetDurationMs: number,
  config: ScoringConfig = DEFAULT_SCORING_CONFIG
): ScoredClip[] {
  const interviewCounts = new Map<string, number>()
  const personaCounts = new Map<string, number>()

  // Score all evidence
  const scoredClips: ScoredClip[] = []
  for (const evidence of allEvidence) {
    const scored = scoreEvidence(evidence, config, {
      interviewCounts,
      personaCounts,
    })
    if (scored) {
      scoredClips.push(scored)
    }
  }

  // Sort by score descending
  scoredClips.sort((a, b) => b.score - a.score)

  // Select clips up to target duration
  const selected: ScoredClip[] = []
  let totalDuration = 0

  for (const clip of scoredClips) {
    if (totalDuration + clip.duration_ms > targetDurationMs * 1.2) {
      // Allow 20% overshoot, then stop
      if (totalDuration >= targetDurationMs * 0.8) break
    }

    // Update counts for coverage tracking
    const interviewId = clip.evidence.interview_id
    interviewCounts.set(interviewId, (interviewCounts.get(interviewId) ?? 0) + 1)

    const personaIds = clip.evidence.person?.persona_ids ?? []
    for (const personaId of personaIds) {
      personaCounts.set(personaId, (personaCounts.get(personaId) ?? 0) + 1)
    }

    selected.push(clip)
    totalDuration += clip.duration_ms
  }

  return selected
}
```

### 2.2 Story Arc Ordering (Simplified to 3 Phases)

Create `app/features/reels/lib/story-arc.ts`:

```typescript
/**
 * Story Arc Ordering for Decision Reels
 *
 * SIMPLIFIED v1: 3 phases instead of 5
 * Problem → Impact → Outcome
 *
 * Rationale for simplification:
 * - "Workaround" and "Solution" phases rarely have clear metadata signals
 * - `does[]` field is too ambiguous (could be current behavior OR workaround)
 * - 3 phases still tell a complete story
 * - Simpler classification = fewer edge cases = more reliable auto-ordering
 *
 * IMPORTANT: Uses structured evidence metadata, NOT regex pattern matching.
 * See PRD section 2.2 for rationale on why regex is an anti-pattern here.
 */

import type { ScoredClip, EvidenceForScoring } from './clip-scoring'

// Simplified to 3 phases for v1
export type StoryArcPhase = 'problem' | 'impact' | 'outcome'

export interface OrderedClip extends ScoredClip {
  story_arc_phase: StoryArcPhase
}

/**
 * Phase exemplar embeddings for semantic fallback classification.
 * Pre-computed embeddings of representative phrases for each phase.
 */
const PHASE_EXEMPLARS: Record<StoryArcPhase, string[]> = {
  problem: [
    "I struggle with this every day",
    "The current process is broken",
    "We can't do this effectively",
    "This is really frustrating",
  ],
  impact: [
    "This costs us hours every week",
    "We lose customers because of this",
    "It affects our ability to deliver",
    "The consequence is we can't scale",
  ],
  outcome: [
    "So that we can focus on what matters",
    "This would save us significant time",
    "We'd be able to serve customers better",
    "What we really need is",
  ],
}

/**
 * Classify a clip into a story arc phase based on STRUCTURED METADATA.
 *
 * Priority order:
 * 1. Use existing evidence facets (pains, gains, feels)
 * 2. Fall back to semantic similarity against phase exemplars
 *
 * We explicitly AVOID regex pattern matching because:
 * - False positives: "hard to beat" → wrongly classified as problem
 * - False negatives: "We lose 2 hours daily" → no pattern match
 * - Language brittleness: Doesn't work for non-English
 * - Maintenance burden: Endless pattern additions
 */
export function classifyClipPhase(clip: ScoredClip): StoryArcPhase {
  const evidence = clip.evidence

  // Priority 1: Use structured metadata from evidence extraction
  const phase = classifyByMetadata(evidence)
  if (phase) return phase

  // Priority 2: Semantic similarity fallback (if embedding available)
  if (evidence.embedding) {
    return classifyByEmbeddingSimilarity(evidence.embedding)
  }

  // Default: problem (most common phase, safe fallback)
  return 'problem'
}

/**
 * Classify using structured evidence metadata.
 * This leverages the work already done during evidence extraction.
 */
function classifyByMetadata(evidence: EvidenceForScoring): StoryArcPhase | null {
  // Impact: Has BOTH pain AND emotional consequence
  if (evidence.pains?.length && evidence.feels?.length) {
    return 'impact'
  }

  // Outcome: Has gains (desired outcomes)
  if (evidence.gains?.length) {
    return 'outcome'
  }

  // Problem: Has pain points (default for evidence with pains)
  if (evidence.pains?.length) {
    return 'problem'
  }

  // No clear classification from metadata
  return null
}

/**
 * Semantic similarity fallback using evidence embedding.
 * Compares against pre-computed phase exemplar embeddings.
 *
 * This leverages our existing find_similar_evidence() infrastructure.
 */
function classifyByEmbeddingSimilarity(
  embedding: number[]
): StoryArcPhase {
  // In production, call database function that computes cosine similarity
  // against phase exemplar embeddings stored in a config table.
  //
  // For now, return 'problem' as default.
  // TODO: Implement actual similarity computation using find_similar_evidence pattern
  //
  // Example implementation:
  // const similarities = await Promise.all(
  //   Object.entries(PHASE_EXEMPLARS).map(async ([phase, exemplars]) => {
  //     const avgSimilarity = await computeAvgSimilarity(embedding, exemplars)
  //     return { phase, similarity: avgSimilarity }
  //   })
  // )
  // return similarities.sort((a, b) => b.similarity - a.similarity)[0].phase

  return 'problem'
}

/**
 * Order clips according to story arc (simplified 3-phase)
 */
export function orderByStoryArc(clips: ScoredClip[]): OrderedClip[] {
  // Simplified to 3 phases for v1
  const phaseOrder: StoryArcPhase[] = ['problem', 'impact', 'outcome']

  // Classify each clip
  const classified = clips.map(clip => ({
    ...clip,
    story_arc_phase: classifyClipPhase(clip),
  }))

  // Group by phase
  const byPhase = new Map<StoryArcPhase, OrderedClip[]>()
  for (const phase of phaseOrder) {
    byPhase.set(phase, [])
  }
  for (const clip of classified) {
    byPhase.get(clip.story_arc_phase)?.push(clip)
  }

  // Sort within each phase by score
  for (const clips of byPhase.values()) {
    clips.sort((a, b) => b.score - a.score)
  }

  // Flatten in story arc order
  const ordered: OrderedClip[] = []
  for (const phase of phaseOrder) {
    ordered.push(...(byPhase.get(phase) ?? []))
  }

  return ordered
}
```

---

## Phase 3: Trigger.dev Tasks

### 3.1 Reel Rendering Task

Create `src/trigger/reels/renderReel.ts`:

```typescript
/**
 * Render Reel Task
 *
 * Uses FFmpeg to stitch evidence clips into a single MP4.
 * Runs as a Trigger.dev task for long-running processing.
 */

import { task } from "@trigger.dev/sdk"
import { exec } from "node:child_process"
import { promisify } from "node:util"
import { writeFile, unlink, mkdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import consola from "consola"
import { createSupabaseAdminClient } from "~/lib/supabase/client.server"
import { uploadToR2, createR2PresignedUrl } from "~/utils/r2.server"

const execAsync = promisify(exec)

export interface RenderReelPayload {
  reelId: string
  accountId: string
  projectId: string
}

export interface RenderReelResult {
  success: boolean
  outputUrl?: string
  outputKey?: string
  durationSec?: number
  error?: string
}

export const renderReelTask = task({
  id: "reels.render",
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 5000,
    maxTimeoutInMs: 60000,
  },
  run: async (payload: RenderReelPayload): Promise<RenderReelResult> => {
    const { reelId, accountId, projectId } = payload
    const client = createSupabaseAdminClient()

    consola.info(`[renderReel] Starting render for reel ${reelId}`)

    try {
      // Update status to processing
      await client
        .from("reels")
        .update({
          status: "processing",
          processing_metadata: { started_at: new Date().toISOString() }
        })
        .eq("id", reelId)

      // Load reel with segments
      const { data: reel, error: reelError } = await client
        .from("reels")
        .select(`
          *,
          segments:reel_segments(
            *,
            evidence:evidence_id(
              id,
              interview_id,
              verbatim,
              gist
            )
          )
        `)
        .eq("id", reelId)
        .single()

      if (reelError || !reel) {
        throw new Error(`Reel not found: ${reelError?.message}`)
      }

      // Get unique interview IDs and their media URLs
      const interviewIds = [...new Set(
        reel.segments.map((s: any) => s.evidence?.interview_id).filter(Boolean)
      )]

      const { data: interviews } = await client
        .from("interviews")
        .select("id, media_url")
        .in("id", interviewIds)

      const mediaUrlMap = new Map(
        interviews?.map(i => [i.id, i.media_url]) ?? []
      )

      // Create temp directory for processing
      const workDir = join(tmpdir(), `reel-${reelId}-${Date.now()}`)
      await mkdir(workDir, { recursive: true })

      consola.info(`[renderReel] Work directory: ${workDir}`)

      // Download source media and extract clips
      const clipPaths: string[] = []

      for (let i = 0; i < reel.segments.length; i++) {
        const segment = reel.segments[i]
        const interviewId = segment.evidence?.interview_id
        const mediaUrl = mediaUrlMap.get(interviewId)

        if (!mediaUrl) {
          consola.warn(`[renderReel] No media URL for interview ${interviewId}`)
          continue
        }

        // Get presigned URL for source media
        const sourceUrl = await getPresignedMediaUrl(mediaUrl)
        if (!sourceUrl) {
          consola.warn(`[renderReel] Could not get presigned URL for ${mediaUrl}`)
          continue
        }

        const clipPath = join(workDir, `clip_${i.toString().padStart(3, '0')}.mp4`)

        // Extract clip with FFmpeg
        const startSec = segment.clip_start_ms / 1000
        const durationSec = (segment.clip_end_ms - segment.clip_start_ms) / 1000

        await execAsync(
          `ffmpeg -ss ${startSec} -i "${sourceUrl}" -t ${durationSec} ` +
          `-c:v libx264 -preset fast -crf 23 ` +
          `-c:a aac -b:a 128k ` +
          `-movflags +faststart ` +
          `"${clipPath}"`
        )

        clipPaths.push(clipPath)
        consola.info(`[renderReel] Extracted clip ${i + 1}/${reel.segments.length}`)
      }

      if (clipPaths.length === 0) {
        throw new Error("No clips could be extracted")
      }

      // Create concat list
      const concatListPath = join(workDir, "concat.txt")
      const concatContent = clipPaths.map(p => `file '${p}'`).join("\n")
      await writeFile(concatListPath, concatContent)

      // Concatenate clips
      const outputPath = join(workDir, "output.mp4")
      await execAsync(
        `ffmpeg -f concat -safe 0 -i "${concatListPath}" ` +
        `-c copy "${outputPath}"`
      )

      consola.info(`[renderReel] Concatenation complete`)

      // Get output duration
      const { stdout: durationOutput } = await execAsync(
        `ffprobe -v error -show_entries format=duration ` +
        `-of default=noprint_wrappers=1:nokey=1 "${outputPath}"`
      )
      const durationSec = parseFloat(durationOutput.trim())

      // Upload to R2
      const outputKey = `reels/${accountId}/${projectId}/${reelId}.mp4`
      const outputBuffer = await readFile(outputPath)

      const uploadResult = await uploadToR2({
        key: outputKey,
        body: new Uint8Array(outputBuffer),
        contentType: "video/mp4",
      })

      if (!uploadResult.success) {
        throw new Error(`Failed to upload to R2: ${uploadResult.error}`)
      }

      // Get public URL
      const presignResult = createR2PresignedUrl({
        key: outputKey,
        expiresInSeconds: 60 * 60 * 24 * 7, // 7 days
      })

      // Update reel record
      await client
        .from("reels")
        .update({
          status: "ready",
          output_key: outputKey,
          output_url: presignResult?.url,
          total_duration_sec: durationSec,
          processing_metadata: {
            completed_at: new Date().toISOString(),
            clip_count: clipPaths.length,
          },
        })
        .eq("id", reelId)

      // Cleanup temp files
      for (const path of [...clipPaths, concatListPath, outputPath]) {
        await unlink(path).catch(() => {})
      }

      consola.success(`[renderReel] Reel ${reelId} rendered successfully`)

      return {
        success: true,
        outputUrl: presignResult?.url,
        outputKey,
        durationSec,
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      consola.error(`[renderReel] Failed:`, error)

      // Update status to failed
      await client
        .from("reels")
        .update({
          status: "failed",
          processing_metadata: {
            failed_at: new Date().toISOString(),
            error: errorMessage,
          },
        })
        .eq("id", reelId)

      return {
        success: false,
        error: errorMessage,
      }
    }
  },
})

async function getPresignedMediaUrl(mediaUrl: string): Promise<string | null> {
  // If already a presigned URL, return as-is
  if (mediaUrl.includes("X-Amz-Signature")) {
    return mediaUrl
  }

  // Extract R2 key and generate presigned URL
  const { getR2KeyFromPublicUrl, createR2PresignedUrl } = await import("~/utils/r2.server")
  const key = getR2KeyFromPublicUrl(mediaUrl)

  if (!key) return mediaUrl // Fallback to original URL

  const result = createR2PresignedUrl({
    key,
    expiresInSeconds: 3600, // 1 hour
  })

  return result?.url ?? null
}
```

### 3.2 Task Index

Create `src/trigger/reels/index.ts`:

```typescript
/**
 * Reels Trigger.dev Tasks
 */

export { renderReelTask } from "./renderReel"
```

---

## Phase 4: API Routes

### 4.1 Create Reel API

Create `app/features/reels/api/create.tsx`:

```typescript
/**
 * POST /api/reels/create
 *
 * Creates a new reel with auto-selected clips based on filters.
 */

import type { ActionFunctionArgs } from "react-router"
import { z } from "zod"
import { userContext } from "~/server/user-context"
import { selectClipsForReel } from "../lib/clip-scoring"
import { orderByStoryArc } from "../lib/story-arc"

const CreateReelSchema = z.object({
  project_id: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  decision_question_id: z.string().uuid().optional(),
  theme_ids: z.array(z.string().uuid()).optional(),
  persona_ids: z.array(z.string().uuid()).optional(),
  target_duration_sec: z.number().min(30).max(600).default(120),
  story_arc: z.enum(["problem_impact_solution", "chronological", "custom"]).default("problem_impact_solution"),
})

export async function action({ request, context }: ActionFunctionArgs) {
  const ctx = context.get(userContext)
  const { supabase, account_id } = ctx

  const body = await request.json()
  const input = CreateReelSchema.parse(body)

  // Query evidence with filters
  let query = supabase
    .from("evidence")
    .select(`
      id,
      interview_id,
      anchors,
      gist,
      verbatim,
      confidence,
      pains,
      gains,
      feels,
      created_at,
      interview:interviews(id, interview_date, person_id),
      person:interviews!inner(person:people(id))
    `)
    .eq("account_id", account_id)
    .eq("project_id", input.project_id)
    .not("anchors", "is", null)

  // Apply theme filter if provided
  if (input.theme_ids?.length) {
    // Join through evidence_tags or related_tags
    query = query.overlaps("related_tags", input.theme_ids)
  }

  const { data: evidence, error } = await query

  if (error) {
    return { error: error.message }
  }

  // Score and select clips
  const targetDurationMs = input.target_duration_sec * 1000
  const selectedClips = selectClipsForReel(evidence ?? [], targetDurationMs)

  // Order by story arc
  const orderedClips = input.story_arc === "problem_impact_solution"
    ? orderByStoryArc(selectedClips)
    : selectedClips.map((c, i) => ({ ...c, story_arc_phase: "problem" as const }))

  // Create reel record
  const { data: reel, error: reelError } = await supabase
    .from("reels")
    .insert({
      account_id,
      project_id: input.project_id,
      title: input.title,
      description: input.description,
      decision_question_id: input.decision_question_id,
      theme_ids: input.theme_ids ?? [],
      persona_ids: input.persona_ids ?? [],
      target_duration_sec: input.target_duration_sec,
      story_arc: input.story_arc,
      status: "draft",
    })
    .select()
    .single()

  if (reelError) {
    return { error: reelError.message }
  }

  // Create segment records
  const segments = orderedClips.map((clip, index) => ({
    reel_id: reel.id,
    evidence_id: clip.evidence.id,
    interview_id: clip.evidence.interview_id,
    order_index: index,
    story_arc_phase: clip.story_arc_phase,
    clip_start_ms: clip.clip_start_ms,
    clip_end_ms: clip.clip_end_ms,
    score: clip.score,
    score_breakdown: clip.breakdown,
    speaker: null, // TODO: Extract from evidence
    transcript_snippet: clip.evidence.verbatim?.slice(0, 200),
  }))

  const { error: segmentsError } = await supabase
    .from("reel_segments")
    .insert(segments)

  if (segmentsError) {
    return { error: segmentsError.message }
  }

  return {
    reel,
    segments: segments.length,
    estimated_duration_sec: orderedClips.reduce(
      (sum, c) => sum + c.duration_ms / 1000, 0
    ),
  }
}
```

### 4.2 Render Reel API

Create `app/features/reels/api/render.tsx`:

```typescript
/**
 * POST /api/reels/:id/render
 *
 * Triggers FFmpeg rendering for a reel.
 */

import type { ActionFunctionArgs } from "react-router"
import { tasks } from "@trigger.dev/sdk"
import { userContext } from "~/server/user-context"
import type { renderReelTask } from "~/trigger/reels"

export async function action({ request, context, params }: ActionFunctionArgs) {
  const ctx = context.get(userContext)
  const { supabase, account_id } = ctx
  const reelId = params.id

  if (!reelId) {
    return { error: "Reel ID required" }
  }

  // Verify ownership
  const { data: reel, error } = await supabase
    .from("reels")
    .select("id, project_id, status")
    .eq("id", reelId)
    .eq("account_id", account_id)
    .single()

  if (error || !reel) {
    return { error: "Reel not found" }
  }

  if (reel.status === "processing") {
    return { error: "Reel is already being processed" }
  }

  // Trigger render task
  const handle = await tasks.trigger<typeof renderReelTask>("reels.render", {
    reelId,
    accountId: account_id,
    projectId: reel.project_id,
  })

  return {
    success: true,
    taskId: handle.id,
    message: "Reel rendering started",
  }
}
```

---

## Phase 5: UI Components

### 5.1 Feature Structure

```
app/features/reels/
├── api/
│   ├── create.tsx
│   ├── render.tsx
│   └── share.tsx
├── components/
│   ├── ReelBuilder.tsx        # Main builder UI
│   ├── ReelPlayer.tsx         # Video player with chapters
│   ├── ReelTimeline.tsx       # Drag-drop timeline editor
│   ├── ClipCard.tsx           # Individual clip preview
│   └── ReelShareDialog.tsx    # Sharing options
├── lib/
│   ├── clip-scoring.ts
│   └── story-arc.ts
├── pages/
│   ├── index.tsx              # Reels list
│   ├── $id.tsx                # Reel detail/player
│   ├── new.tsx                # Create new reel
│   └── $id.edit.tsx           # Edit reel segments
├── db.ts                      # Database functions
└── routes.ts                  # Route definitions
```

### 5.2 Route Configuration

Create `app/features/reels/routes.ts`:

```typescript
import { index, prefix, route } from "@react-router/dev/routes"

export const reelsRoutes = [
  ...prefix("reels", [
    index("./features/reels/pages/index.tsx"),
    route("new", "./features/reels/pages/new.tsx"),
    route(":id", "./features/reels/pages/$id.tsx"),
    route(":id/edit", "./features/reels/pages/$id.edit.tsx"),
  ]),
]
```

---

## Phase 6: Integration Points

### 6.1 Entry Points

Add "Create Reel" buttons to:

1. **Theme Detail Page** - "Build reel from this theme"
2. **Decision Question View** - "Create evidence reel"
3. **Insights Page** - "Generate reel from insights"
4. **Evidence Index** - "Create reel from selected evidence"

### 6.2 Evidence Requirements

Ensure evidence records have valid `anchors` with `start_ms`:

```sql
-- View to find evidence suitable for reels
create or replace view evidence_with_clips as
select
  e.*,
  (e.anchors->>'start_ms')::int as clip_start_ms,
  coalesce((e.anchors->>'end_ms')::int, (e.anchors->>'start_ms')::int + 30000) as clip_end_ms,
  i.media_url
from evidence e
join interviews i on e.interview_id = i.id
where e.anchors is not null
  and e.anchors->>'start_ms' is not null
  and i.media_url is not null;
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Create database schema (`70_reels.sql`)
- [ ] Generate types with `pnpm supabase:types`
- [ ] Create `app/features/reels/db.ts` with CRUD functions
- [ ] Create clip scoring module

### Phase 2: Backend (Week 2)
- [ ] Implement Trigger.dev render task
- [ ] Create API routes (create, render, share)
- [ ] Test FFmpeg integration locally
- [ ] Add R2 upload for rendered reels

### Phase 3: UI (Week 3)
- [ ] Build ReelBuilder component
- [ ] Build ReelPlayer with chapters
- [ ] Build ReelTimeline editor
- [ ] Create list and detail pages

### Phase 4: Integration (Week 4)
- [ ] Add entry points to theme/insight pages
- [ ] Implement sharing functionality
- [ ] Add progress tracking for renders
- [ ] Polish and testing

---

## Technical Considerations

### FFmpeg on Fly.io

The render task runs on Trigger.dev which uses Fly.io workers. FFmpeg is available in the default Node.js image. For custom builds:

```dockerfile
# In trigger.config.ts build config
FROM node:20-slim
RUN apt-get update && apt-get install -y ffmpeg
```

### Storage Costs

- Source media: Already in R2
- Rendered reels: ~10MB per minute of video
- Estimate: 100 reels × 2 min × 10MB = 2GB/month

### Performance

- Clip extraction: ~5-10s per clip
- Concatenation: ~2-5s
- Upload: ~5-10s for 20MB file
- Total: ~1-2 minutes for a 2-minute reel

---

## Phase 7: Reusable Thumbnail Service

> **STATUS: PARTIALLY COMPLETE** (December 2024)
>
> Interview thumbnail generation is now implemented:
> - `src/trigger/generate-thumbnail.ts` - Trigger.dev task for interview thumbnails
> - `app/routes/api.generate-thumbnails.tsx` - API for single/batch thumbnail generation
> - Database: `interviews.thumbnail_url` column added
> - UI: `SimpleMediaPlayer` displays thumbnails before video loads
> - Evidence pages inherit interview thumbnail
>
> **Remaining for Reels:**
> - Reel thumbnail generation after render completes
> - Evidence clip preview thumbnails (optional, lower priority)

### 7.1 Thumbnail Generation Task

Create `src/trigger/media/generateThumbnail.ts`:

```typescript
/**
 * Reusable Thumbnail Generation Service
 *
 * Generates thumbnails for any media type: interviews, reels, evidence clips.
 * Can be triggered standalone or as part of other workflows.
 */

import { task } from "@trigger.dev/sdk"
import { exec } from "node:child_process"
import { promisify } from "node:util"
import { readFile, unlink } from "node:fs/promises"
import consola from "consola"
import { uploadToR2, createR2PresignedUrl } from "~/utils/r2.server"

const execAsync = promisify(exec)

export interface ThumbnailRequest {
  source_url: string           // R2 URL or presigned URL
  source_key?: string          // R2 key (alternative to URL)
  timestamp_sec?: number       // Default: 2 seconds in
  width?: number               // Default: 640
  height?: number              // Default: 360
  output_key: string           // Where to store in R2
}

export interface ThumbnailResponse {
  success: boolean
  thumbnail_url?: string       // Presigned URL for immediate use
  thumbnail_key?: string       // R2 key for storage reference
  error?: string
}

export const generateThumbnailTask = task({
  id: "media.generateThumbnail",
  retry: { maxAttempts: 2, factor: 2, minTimeoutInMs: 2000 },
  run: async (payload: ThumbnailRequest): Promise<ThumbnailResponse> => {
    const {
      source_url,
      source_key,
      timestamp_sec = 2,
      width = 640,
      height = 360,
      output_key
    } = payload

    consola.info(`[thumbnail] Generating for ${output_key}`)

    try {
      // Resolve source URL
      let mediaUrl = source_url
      if (source_key && !source_url) {
        const presigned = await createR2PresignedUrl({
          key: source_key,
          expiresInSeconds: 3600
        })
        mediaUrl = presigned?.url ?? ''
      }

      if (!mediaUrl) {
        throw new Error('No valid source URL')
      }

      const tempPath = `/tmp/thumb_${Date.now()}.jpg`

      // Extract frame at timestamp with padding to maintain aspect ratio
      await execAsync(
        `ffmpeg -ss ${timestamp_sec} -i "${mediaUrl}" ` +
        `-vframes 1 -vf "scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
        `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black" ` +
        `-q:v 2 "${tempPath}"`
      )

      // Upload to R2
      const buffer = await readFile(tempPath)
      const uploadResult = await uploadToR2({
        key: output_key,
        body: new Uint8Array(buffer),
        contentType: 'image/jpeg'
      })

      if (!uploadResult.success) {
        throw new Error(`Upload failed: ${uploadResult.error}`)
      }

      // Cleanup temp file
      await unlink(tempPath).catch(() => {})

      // Generate presigned URL for immediate use
      const presignResult = await createR2PresignedUrl({
        key: output_key,
        expiresInSeconds: 3600
      })

      consola.success(`[thumbnail] Generated ${output_key}`)

      return {
        success: true,
        thumbnail_key: output_key,
        thumbnail_url: presignResult?.url,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      consola.error(`[thumbnail] Failed:`, error)
      return { success: false, error: errorMessage }
    }
  },
})
```

### 7.2 Thumbnail API Route

Create `app/routes/api.media.thumbnail.tsx`:

```typescript
/**
 * POST /api/media/thumbnail
 *
 * Triggers thumbnail generation for any media source.
 * Reusable across interviews, reels, and evidence.
 */

import type { ActionFunctionArgs } from "react-router"
import { z } from "zod"
import { tasks } from "@trigger.dev/sdk"
import { userContext } from "~/server/user-context"
import type { generateThumbnailTask } from "~/trigger/media/generateThumbnail"

const ThumbnailRequestSchema = z.object({
  source_key: z.string(),
  output_key: z.string(),
  timestamp_sec: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
})

export async function action({ request, context }: ActionFunctionArgs) {
  const ctx = context.get(userContext)
  const { account_id } = ctx

  const body = await request.json()
  const input = ThumbnailRequestSchema.parse(body)

  // Validate output_key is within account scope
  if (!input.output_key.includes(account_id)) {
    return { error: "Output key must be within account scope" }
  }

  const handle = await tasks.trigger<typeof generateThumbnailTask>(
    "media.generateThumbnail",
    {
      source_key: input.source_key,
      source_url: '', // Will be resolved from key
      output_key: input.output_key,
      timestamp_sec: input.timestamp_sec,
      width: input.width,
      height: input.height,
    }
  )

  return {
    success: true,
    taskId: handle.id,
    message: "Thumbnail generation started",
  }
}
```

### 7.3 Usage Patterns

```typescript
// After reel render completes
await generateThumbnailTask.trigger({
  source_key: `reels/${accountId}/${projectId}/${reelId}.mp4`,
  output_key: `reels/${accountId}/${projectId}/${reelId}_thumb.jpg`,
  timestamp_sec: 2,
})

// After interview upload
await generateThumbnailTask.trigger({
  source_key: `interviews/${accountId}/${projectId}/${interviewId}.mp4`,
  output_key: `interviews/${accountId}/${projectId}/${interviewId}_thumb.jpg`,
  timestamp_sec: 5, // Skip intro
})

// For evidence clip preview
await generateThumbnailTask.trigger({
  source_key: interviewMediaKey,
  output_key: `evidence/${accountId}/${projectId}/${evidenceId}_thumb.jpg`,
  timestamp_sec: evidenceStartMs / 1000, // Thumbnail at clip start
})
```

---

## Phase 8: Audio-Only Support

### 8.1 Media Type Detection

```typescript
/**
 * Detect if media is audio-only or video
 */
async function detectMediaType(url: string): Promise<'audio' | 'video'> {
  const { stdout } = await execAsync(
    `ffprobe -v error -select_streams v -show_entries stream=codec_type ` +
    `-of csv=p=0 "${url}"`
  )
  return stdout.trim() === 'video' ? 'video' : 'audio'
}
```

### 8.2 Audio Waveform Rendering

```typescript
// In render task, handle audio-only sources
const mediaType = await detectMediaType(sourceUrl)

if (mediaType === 'audio') {
  // Generate waveform visualization
  await execAsync(
    `ffmpeg -i "${sourceUrl}" -filter_complex ` +
    `"[0:a]showwaves=s=1280x720:mode=cline:colors=white:rate=25[v]" ` +
    `-map "[v]" -map 0:a -c:v libx264 -preset fast -crf 23 ` +
    `-c:a aac -b:a 128k "${clipPath}"`
  )
} else {
  // Standard video extraction
  await execAsync(
    `ffmpeg -ss ${startSec} -i "${sourceUrl}" -t ${durationSec} ` +
    `-c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k "${clipPath}"`
  )
}
```

---

## Phase 9: Clip Merging

### 9.1 Merge Adjacent Clips

```typescript
/**
 * Merge clips from same interview with <2s gap
 * Prevents jarring jumps in playback
 */
function mergeAdjacentClips(segments: ReelSegment[]): ReelSegment[] {
  // Sort by interview_id, then start_ms
  const sorted = [...segments].sort((a, b) => {
    if (a.interview_id !== b.interview_id) {
      return a.interview_id.localeCompare(b.interview_id)
    }
    return a.clip_start_ms - b.clip_start_ms
  })

  const merged: ReelSegment[] = []

  for (const segment of sorted) {
    const last = merged[merged.length - 1]

    // Merge if same interview and gap < 2s
    if (last &&
        last.interview_id === segment.interview_id &&
        segment.clip_start_ms - last.clip_end_ms < 2000) {
      // Extend the previous clip
      last.clip_end_ms = Math.max(last.clip_end_ms, segment.clip_end_ms)
      last.transcript_snippet = (last.transcript_snippet || '') +
        ' ' + (segment.transcript_snippet || '')
    } else {
      merged.push({ ...segment })
    }
  }

  return merged
}
```

---

## Success Metrics

1. **Adoption**: Reels created per active project
2. **Engagement**: Playback completion rate
3. **Sharing**: % of reels shared externally
4. **Time-to-value**: Minutes from "create" to shareable reel
5. **Coverage**: % of themes/decisions with associated reels

---

## Pre-Implementation Spikes

| Spike | Purpose | Effort | Status |
|-------|---------|--------|--------|
| FFmpeg in Trigger.dev | Verify FFmpeg works in worker environment | 2h | ✅ COMPLETE - Tested with interview thumbnails |
| Audio waveform render | Test audio-only interview handling | 2h | Pending |
| Presigned URL on-demand | Confirm URL generation works at read time | 1h | ✅ COMPLETE - Working in SimpleMediaPlayer |

---

## v2 Roadmap (Post-Launch)

| Feature | Description | Priority |
|---------|-------------|----------|
| Persona balancing | Enforce representation across personas | High |
| Clip trimming | Fine-grained in/out point adjustment | Medium |
| 5-phase story arc | Add workaround/solution phases | Low |
| Clip caching | Store extracted clips for faster re-renders | Medium |
| Real-time progress | WebSocket updates instead of polling | Low |
