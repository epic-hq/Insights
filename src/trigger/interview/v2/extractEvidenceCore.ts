// TODO: Remove Legacy

// Import the BAML async client helper ("b"), following the official BoundaryML docs.
// After running `baml-cli generate`, all functions are exposed on this client.
// NOTE: tsconfig path alias `~` maps to `app/`, so baml_client (generated at project root)
// is accessible via `~/../baml_client`.
// Import BAML client - this file is server-only so it's safe to import directly

import type { SupabaseClient } from "@supabase/supabase-js";
import consola from "consola";
import posthog from "posthog-js";
import { b } from "~/../baml_client";
import type {
  FacetCatalog,
  FacetMention,
  InterviewExtraction,
  PersonFacetInput,
  PersonFacetObservation,
  PersonScaleInput,
} from "~/../baml_client/types";
import type { Json } from "~/../supabase/types";
import {
  ensureInterviewInterviewerLink,
  resolveInternalPerson,
} from "~/features/people/services/internalPeople.server";
import { upsertPersonWithOrgAwareConflict } from "~/features/interviews/peopleNormalization.server";
// Extracted modules for cleaner separation of concerns
import {
  coerceSeconds,
  normalizeTokens,
  normalizeForSearchText,
  buildWordTimeline,
  buildSegmentTimeline,
  findStartSecondsForSnippet,
  type WordTimelineEntry,
  type SegmentTimelineEntry,
} from "./timestampMapping";
import {
  normalizeFacetValue,
  sanitizeFacetLabel,
  buildFacetLookup,
  matchFacetFromLookup,
  resolveFacetCatalog,
  type FacetLookup,
  type EvidenceFacetRow,
  type PersonFacetMention,
} from "./facetProcessing";
import {
  isGenericPersonLabel,
  parseFullName,
  generateFallbackPersonName,
  humanizeKey,
  sanitizePersonKey,
  coerceString,
  resolveName,
  type NormalizedParticipant,
  type NameResolutionSource,
} from "./peopleResolution";
import {
  groupPersonaFacetsByPersonKey,
  type PersonaFacet,
  type PersonaSynthesisResult,
  type PersonScaleObservation,
} from "./personaSynthesis";
import { runEvidenceAnalysis } from "~/features/research/analysis/runEvidenceAnalysis.server";
import { autoGroupThemesAndApply } from "~/features/themes/db.autoThemes.server";
import {
  createBamlCollector,
  mapUsageToLangfuse,
  summarizeCollectorUsage,
} from "~/lib/baml/collector.server";
import { validateAttributionParity } from "~/lib/evidence/personAttribution.server";
import {
  createTaskBillingContext,
  inferProvider,
  recordTaskUsage,
} from "../../lib/billing";
import type { ConversationAnalysis } from "~/lib/conversation-analyses/schema";
import {
  FacetResolver,
  getFacetCatalog,
  persistFacetObservations,
} from "~/lib/database/facets.server";
import { createPlannedAnswersForInterview } from "~/lib/database/project-answers.server";
import { getLangfuseClient } from "~/lib/langfuse.server";
import { getServerClient } from "~/lib/supabase/client.server";
import type {
  Database,
  InsightInsert,
  Interview,
  InterviewInsert,
} from "~/types";
import { batchExtractEvidence } from "~/utils/batchEvidence";
import { generateConversationAnalysis } from "~/utils/conversationAnalysis.server";
import { getR2KeyFromPublicUrl } from "~/utils/r2.server";
import { safeSanitizeTranscriptPayload } from "~/utils/transcript/sanitizeTranscriptData.server";

// Supabase table types
type Tables = Database["public"]["Tables"];
type PeopleInsert = Tables["people"]["Insert"] & {
  person_type?: string | null;
  user_id?: string | null;
};
type PeopleUpdate = Tables["people"]["Update"] & {
  person_type?: string | null;
  user_id?: string | null;
};
type InterviewPeopleInsert = Tables["interview_people"]["Insert"];
type EvidenceInsert = Tables["evidence"]["Insert"];

export interface ProcessingResult {
  stored: InsightInsert[];
  interview: Interview;
}

export interface UploadMediaAndTranscribePayload {
  metadata: InterviewMetadata;
  transcriptData: Record<string, unknown>;
  mediaUrl: string;
  existingInterviewId?: string;
  analysisJobId?: string;
  userCustomInstructions?: string;
}

export interface UploadMediaAndTranscribeResult {
  metadata: InterviewMetadata;
  interview: Interview;
  sanitizedTranscriptData: Record<string, unknown>;
  transcriptData: Record<string, unknown>;
  fullTranscript: string;
  language: string;
  analysisJobId?: string;
  userCustomInstructions?: string;
}

export interface AnalyzeThemesAndPersonaResult {
  storedInsights: InsightInsert[];
  interview: Interview;
}

export interface GenerateInterviewInsightsTaskPayload {
  metadata: InterviewMetadata;
  interview: Interview;
  fullTranscript: string;
  userCustomInstructions?: string;
  evidenceResult: ExtractEvidenceResult;
  analysisJobId?: string;
}

export interface AnalyzeThemesTaskPayload extends GenerateInterviewInsightsTaskPayload {
  interviewInsights: InterviewExtraction;
}

export interface AttributeAnswersTaskPayload {
  metadata: InterviewMetadata;
  interview: Interview;
  fullTranscript: string;
  insertedEvidenceIds: string[];
  storedInsights: InsightInsert[];
  analysisJobId?: string;
}

export const workflowRetryConfig = {
  maxAttempts: 3,
  factor: 1.8,
  minTimeoutInMs: 500,
  maxTimeoutInMs: 30_000,
  randomize: false,
};

export interface InterviewMetadata {
  accountId: string;
  userId?: string; // Add user ID for audit fields
  projectId?: string;
  interviewTitle?: string;
  interviewDate?: string;
  interviewerName?: string;
  participantName?: string;
  participantOrganization?: string;
  segment?: string;
  durationMin?: number;
  fileName?: string;
}

export interface GenerateInterviewInsightsOptions {
  evidenceUnits: EvidenceTurn[];
  userCustomInstructions?: string;
}

function sanitizeVerbatim(input: unknown): string | null {
  if (typeof input !== "string") return null;
  // Replace smart quotes, collapse whitespace, and drop ASCII control chars
  const mapQuotes = input
    .replace(/[\u2018\u2019\u201B\u2032]/g, "'")
    .replace(/[\u201C\u201D\u2033]/g, '"');
  let out = "";
  for (let i = 0; i < mapQuotes.length; i++) {
    const code = mapQuotes.charCodeAt(i);
    // Skip control chars: 0-31 and 127
    if ((code >= 0 && code <= 31) || code === 127) {
      out += " ";
    } else {
      out += mapQuotes[i];
    }
  }
  const cleaned = out.replace(/\s+/g, " ").trim();
  return cleaned.length ? cleaned : null;
}

// Generate a stable, short signature for dedupe/independence.
// Not cryptographically strong; sufficient to cluster near-duplicates.
function stringHash(input: string): string {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return `00000000${h.toString(16)}`.slice(-8);
}

function computeIndependenceKey(verbatim: string, kindTags: string[]): string {
  const normQuote = verbatim.toLowerCase().replace(/\s+/g, " ").trim();
  const mainTag = (kindTags[0] || "").toLowerCase().trim();
  const basis = `${normQuote.slice(0, 160)}|${mainTag}`;
  return stringHash(basis);
}

type EvidenceFromBaml = Awaited<
  ReturnType<typeof b.ExtractEvidenceFromTranscriptV2>
>;
type PersonaSynthesisFromBaml = Awaited<
  ReturnType<typeof b.DerivePersonaFacetsFromEvidence>
>;

type EvidenceTurn = EvidenceFromBaml["evidence"][number];

/** Progress callback for heartbeat-safe long operations */
export type ExtractProgressCallback = (update: {
  phase: string;
  progress: number;
  detail: string;
}) => void | Promise<void>;

interface ExtractEvidenceOptions {
  db: SupabaseClient<Database>;
  metadata: InterviewMetadata;
  interviewRecord: Interview;
  transcriptData: Record<string, unknown>;
  language: string;
  fullTranscript?: string; // Optional - only used for logging
  analysisJobId?: string; // For progress updates
  onProgress?: ExtractProgressCallback; // Callback for heartbeat-safe progress updates
  peopleHooks?: {
    normalizeSpeakerLabel?: (label: string | null) => string | null;
    isPlaceholderPerson?: (name: string) => boolean;
    upsertPerson?: (
      payload: PeopleInsert,
    ) => Promise<{ id: string; name: string | null }>;
  };
}

interface ExtractEvidenceResult {
  personData: { id: string };
  primaryPersonName: string | null;
  primaryPersonRole: string | null;
  primaryPersonDescription: string | null;
  primaryPersonOrganization: string | null;
  primaryPersonSegments: string[];
  insertedEvidenceIds: string[];
  evidenceUnits: EvidenceFromBaml["evidence"];
  evidenceFacetKinds: string[][];
  // LLM-determined interaction context for automatic lens selection
  interactionContext:
    | "research"
    | "sales"
    | "support"
    | "internal"
    | "debrief"
    | null;
  contextConfidence: number | null;
  contextReasoning: string | null;
  rawPeople?: EvidenceParticipant[];
}

/**
 * Rough token estimate: ~4 chars per token for English JSON.
 * Conservative to avoid exceeding context window.
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}

/** Context window for gpt-4o-mini. Reserve ~8K for prompt template + output. */
const MODEL_CONTEXT_LIMIT = 128_000;
const RESERVED_TOKENS = 8_000;
const MAX_EVIDENCE_TOKENS = MODEL_CONTEXT_LIMIT - RESERVED_TOKENS; // ~120K

/**
 * Returns true if the error is a 400-level client error that should NOT be retried
 * (e.g. context_length_exceeded, invalid_request_error).
 */
function isNonRetryableClientError(error: unknown): boolean {
  const msg = String(error);
  return (
    msg.includes("status code: 400") ||
    msg.includes("context_length_exceeded") ||
    msg.includes("invalid_request_error") ||
    msg.includes("status code: 401") ||
    msg.includes("status code: 403") ||
    msg.includes("status code: 422")
  );
}

export async function generateInterviewInsightsFromEvidenceCore({
  evidenceUnits,
  userCustomInstructions,
}: GenerateInterviewInsightsOptions): Promise<InterviewExtraction> {
  const instructions = userCustomInstructions ?? "";

  // Source function guarantees evidenceUnits is an array
  if (evidenceUnits.length === 0) {
    consola.warn("evidenceUnits is empty, returning minimal response");
    return {
      insights: [],
      participant: {},
      highImpactThemes: [],
      openQuestionsAndNextSteps: "",
      observationsAndNotes: "",
      metadata: { title: "" },
      relevantAnswers: [],
    };
  }

  // Token pre-check: estimate tokens and truncate evidence if over limit
  let truncatedUnits = evidenceUnits;
  const fullJson = JSON.stringify(evidenceUnits);
  const estimatedTokens = estimateTokens(fullJson);

  if (estimatedTokens > MAX_EVIDENCE_TOKENS) {
    consola.warn(
      `[generateInsightsCore] Evidence exceeds context window: ~${estimatedTokens} tokens (limit: ${MAX_EVIDENCE_TOKENS}). Truncating.`,
    );

    // Binary search for max evidence count that fits
    let lo = 1;
    let hi = evidenceUnits.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      const slice = JSON.stringify(evidenceUnits.slice(0, mid));
      if (estimateTokens(slice) <= MAX_EVIDENCE_TOKENS) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }

    truncatedUnits = evidenceUnits.slice(0, lo);
    consola.info(
      `[generateInsightsCore] Truncated evidence: ${evidenceUnits.length} → ${truncatedUnits.length} units (~${estimateTokens(JSON.stringify(truncatedUnits))} tokens)`,
    );
  } else {
    consola.info(
      `[generateInsightsCore] Evidence fits in context window: ~${estimatedTokens} tokens (${evidenceUnits.length} units)`,
    );
  }

  // Retry loop with non-retryable error detection
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await b.GenerateKeyTakeawaysFromEvidence(
        truncatedUnits,
        instructions,
      );
      consola.log("BAML generateInterviewInsights response:", response);
      return response;
    } catch (error) {
      lastErr = error;

      // Don't retry 400-level client errors — they'll fail again
      if (isNonRetryableClientError(error)) {
        consola.error(
          `[generateInsightsCore] Non-retryable client error (attempt ${attempt + 1}/3), aborting:`,
          error,
        );
        throw error;
      }

      const delayMs = 500 * (attempt + 1);
      consola.warn(
        `GenerateKeyTakeawaysFromEvidence failed (attempt ${attempt + 1}/3), retrying in ${delayMs}ms`,
        error,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastErr;
}

export async function extractEvidenceAndPeopleCore({
  db,
  metadata,
  interviewRecord,
  transcriptData,
  language,
  fullTranscript,
  analysisJobId,
  onProgress,
  peopleHooks,
}: ExtractEvidenceOptions): Promise<ExtractEvidenceResult> {
  type RawChapter = {
    start_ms?: number;
    end_ms?: number;
    start?: number;
    end?: number;
    summary?: string;
    gist?: string;
    title?: string;
  };

  let chapters: Array<{
    start_ms: number;
    end_ms?: number;
    summary?: string;
    title?: string;
  }> = [];
  try {
    const rawChapters =
      ((transcriptData as Record<string, unknown>).chapters as
        | RawChapter[]
        | undefined) ||
      ((transcriptData as Record<string, unknown>).segments as
        | RawChapter[]
        | undefined) ||
      [];
    if (Array.isArray(rawChapters)) {
      chapters = rawChapters
        .map((c: RawChapter) => ({
          start_ms:
            typeof c.start_ms === "number"
              ? c.start_ms
              : typeof c.start === "number"
                ? c.start
                : 0,
          end_ms:
            typeof c.end_ms === "number"
              ? c.end_ms
              : typeof c.end === "number"
                ? c.end
                : undefined,
          summary: c.summary ?? c.gist ?? undefined,
          title: c.title ?? undefined,
        }))
        .filter((c) => typeof c.start_ms === "number");
    }
  } catch (chapterErr) {
    consola.warn(
      "Failed to normalize chapters for evidence extraction",
      chapterErr,
    );
  }

  let evidenceUnits: EvidenceFromBaml["evidence"] = [];
  let insertedEvidenceIds: string[] = [];
  const evidenceFacetKinds: string[][] = [];
  const evidenceFacetRowsToInsert: Array<{
    account_id: string;
    project_id: string | null;
    evidence_index: number;
    kind_slug: string;
    facet_account_id: number;
    label: string;
    source: string;
    confidence: number;
    quote: string | null;
  }> = [];
  const facetMentionsByPersonKey = new Map<
    string,
    Array<{
      kindSlug: string;
      label: string;
      facetAccountId: number;
      quote: string | null;
      evidenceIndex: number;
    }>
  >();
  const personKeyForEvidence: string[] = [];
  const personRoleByKey = new Map<string, string | null>();
  const facetObservationsByPersonKey = new Map<
    string,
    PersonFacetObservation[]
  >();
  const facetObservationDedup = new Map<string, Set<string>>();
  const accountId =
    (typeof metadata.accountId === "string" && metadata.accountId.trim()) ||
    (typeof interviewRecord.account_id === "string"
      ? interviewRecord.account_id
      : "");
  const projectId =
    metadata.projectId ??
    (typeof interviewRecord.project_id === "string"
      ? interviewRecord.project_id
      : undefined);
  const normalizedMetadata: InterviewMetadata = {
    ...metadata,
    accountId,
    projectId,
  };

  if (!accountId) {
    throw new Error(
      `Missing accountId for interview ${interviewRecord.id} during evidence extraction`,
    );
  }

  const facetCatalog = await resolveFacetCatalog(db, accountId, projectId);
  const facetLookup = buildFacetLookup(facetCatalog);
  const facetResolver = new FacetResolver(db, accountId);
  const langfuse = getLangfuseClient();
  const lfTrace = (
    langfuse as unknown as {
      trace?: (options: Record<string, unknown>) => unknown;
    }
  )?.trace?.({
    name: "baml.extract-evidence",
    metadata: {
      accountId,
      projectId: projectId ?? null,
      interviewId: interviewRecord.id ?? null,
    },
  });
  const transcriptPreviewLength = 1200;
  const transcriptPreview = fullTranscript
    ? fullTranscript.length > transcriptPreviewLength
      ? `${fullTranscript.slice(0, transcriptPreviewLength)}...`
      : fullTranscript
    : "(no fullTranscript provided)";
  consola.info(`📊 Extracting evidence with ${chapters.length} chapters`, {
    chapterSample: chapters.slice(0, 3),
    transcriptLength: fullTranscript?.length ?? 0,
  });

  // Progress checkpoint: Setup complete, starting extraction
  if (onProgress) {
    await onProgress({
      phase: "extraction",
      progress: 25,
      detail: `Starting extraction with ${chapters.length} chapters`,
    });
  }

  const lfGeneration = lfTrace?.generation?.({
    name: "baml.ExtractEvidenceFromTranscriptV2",
    input: {
      language,
      transcriptLength: fullTranscript?.length ?? 0,
      transcriptPreview,
      chapterCount: chapters.length,
      facetCatalogVersion: facetCatalog.version,
    },
  });
  const collector = createBamlCollector("extract-evidence");
  const promptCostPer1K = Number(
    process.env.BAML_EXTRACT_EVIDENCE_PROMPT_COST_PER_1K_TOKENS,
  );
  const completionCostPer1K = Number(
    process.env.BAML_EXTRACT_EVIDENCE_COMPLETION_COST_PER_1K_TOKENS,
  );
  const costOptions = {
    promptCostPer1KTokens: Number.isFinite(promptCostPer1K)
      ? promptCostPer1K
      : undefined,
    completionCostPer1KTokens: Number.isFinite(completionCostPer1K)
      ? completionCostPer1K
      : undefined,
  };
  const instrumentedClient = b.withOptions({ collector });
  let evidenceResponse: EvidenceFromBaml | undefined;
  let usageSummary: ReturnType<typeof summarizeCollectorUsage> | null = null;
  let langfuseUsage: ReturnType<typeof mapUsageToLangfuse> | undefined;
  let generationEnded = false;
  try {
    // Keep passing the merged facet catalog so the model can ground mentions against the project taxonomy.
    // Dropping this trims the prompt slightly but increases the odds that facet references drift from known labels.

    // Get speaker transcripts from sanitized data
    const speakerTranscriptsRaw = (transcriptData as Record<string, unknown>)
      .speaker_transcripts;
    const speakerTranscripts = Array.isArray(speakerTranscriptsRaw)
      ? (speakerTranscriptsRaw as Array<Record<string, unknown>>).map((u) => ({
          speaker: typeof u.speaker === "string" ? u.speaker : "",
          text: typeof u.text === "string" ? u.text : "",
          start:
            typeof u.start === "number" || typeof u.start === "string"
              ? u.start
              : null,
          end:
            typeof u.end === "number" || typeof u.end === "string"
              ? u.end
              : null,
        }))
      : [];

    // Log speaker transcripts timing data for debugging
    const utterancesWithTiming = speakerTranscripts.filter(
      (u) => u.start !== null,
    ).length;
    const sampleTimings = speakerTranscripts
      .slice(0, 3)
      .map((u) => ({ start: u.start, end: u.end }));
    consola.info(
      `📝 Passing ${speakerTranscripts.length} speaker utterances to AI (${utterancesWithTiming} with timing)`,
      {
        sampleTimings,
      },
    );

    evidenceResponse = await batchExtractEvidence(
      speakerTranscripts,
      async (batch) => {
        return await instrumentedClient.ExtractEvidenceFromTranscriptV2(
          batch,
          chapters,
          language,
          facetCatalog,
        );
      },
      // Progress callback - converts batch progress to overall extraction progress
      onProgress
        ? async (info) => {
            // Batch extraction is ~30-70% of overall extraction phase
            const batchProgress =
              (info.completedBatches / info.totalBatches) * 40;
            await onProgress({
              phase: "extraction",
              progress: 30 + batchProgress, // 30-70% range
              detail: `Batch ${info.completedBatches}/${info.totalBatches}: ${info.evidenceCount} evidence units`,
            });
          }
        : undefined,
    );
    usageSummary = summarizeCollectorUsage(collector, costOptions);
    if (usageSummary) {
      consola.log(
        "[BAML usage] ExtractEvidenceFromTranscriptV2:",
        usageSummary,
      );

      // Record usage and spend credits for billing
      if (usageSummary.totalCostUsd) {
        const billingCtx = createTaskBillingContext(
          normalizedMetadata,
          "interview_extraction",
        );
        const model =
          process.env.BAML_EXTRACT_EVIDENCE_MODEL || "claude-sonnet";
        recordTaskUsage(
          billingCtx,
          {
            provider: inferProvider(model),
            model,
            inputTokens: usageSummary.inputTokens || 0,
            outputTokens: usageSummary.outputTokens || 0,
            estimatedCostUsd: usageSummary.totalCostUsd,
            resourceType: "interview",
            resourceId: interviewRecord.id,
          },
          `interview:${interviewRecord.id}:extract-evidence`,
        ).catch((err) => {
          consola.warn("[billing] Failed to record extraction usage:", err);
        });
      }
    }
    langfuseUsage = mapUsageToLangfuse(usageSummary);

    // Log evidence response summary
    const evidenceCount = evidenceResponse?.evidence?.length ?? 0;
    const totalFacetMentions =
      evidenceResponse?.evidence?.reduce((sum, ev) => {
        const mentions = (ev as { facet_mentions?: unknown[] }).facet_mentions;
        return sum + (Array.isArray(mentions) ? mentions.length : 0);
      }, 0) ?? 0;
    consola.info(
      `🔍 BAML returned ${evidenceCount} evidence units with ${totalFacetMentions} total facet mentions`,
    );

    lfGeneration?.update?.({
      output: evidenceResponse,
      usage: langfuseUsage,
      metadata: usageSummary ? { tokenUsage: usageSummary } : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    lfGeneration?.end?.({
      level: "ERROR",
      statusMessage: message,
      usage: langfuseUsage,
      metadata: usageSummary ? { tokenUsage: usageSummary } : undefined,
    });
    generationEnded = true;
    throw error;
  } finally {
    if (!generationEnded) {
      lfGeneration?.end?.({
        usage: langfuseUsage,
        metadata: usageSummary ? { tokenUsage: usageSummary } : undefined,
      });
    }
    (lfTrace as any)?.end?.();
  }

  if (!evidenceResponse) {
    return {
      personData: {
        id: await ensureFallbackPerson(db, normalizedMetadata, interviewRecord),
      },
      primaryPersonName: null,
      primaryPersonRole: null,
      primaryPersonDescription: null,
      primaryPersonOrganization: null,
      primaryPersonSegments: [],
      insertedEvidenceIds,
      evidenceUnits,
      evidenceFacetKinds,
      interactionContext: null,
      contextConfidence: null,
      contextReasoning: null,
    };
  }

  consola.log(
    "🔍 Raw BAML evidence response:",
    JSON.stringify(evidenceResponse, null, 2),
  );
  consola.log(
    "🔍 evidenceResponse.evidence type:",
    typeof evidenceResponse?.evidence,
  );
  consola.log(
    "🔍 evidenceResponse.evidence isArray:",
    Array.isArray(evidenceResponse?.evidence),
  );
  evidenceUnits = Array.isArray(evidenceResponse?.evidence)
    ? evidenceResponse.evidence
    : [];

  // Validate the return structure
  if (!Array.isArray(evidenceUnits)) {
    throw new Error(
      `extractEvidenceAndPeopleCore: evidenceUnits must be an array, got ${typeof evidenceUnits}`,
    );
  }
  const scenes = Array.isArray(evidenceResponse?.scenes)
    ? evidenceResponse.scenes
    : [];

  // ═══════════════════════════════════════════════════════════════
  // Extract Interaction Context (LLM-determined content classification)
  // ═══════════════════════════════════════════════════════════════
  const rawInteractionContext = (evidenceResponse as any)?.interaction_context;
  const interactionContext: ExtractEvidenceResult["interactionContext"] =
    rawInteractionContext &&
    ["Research", "Sales", "Support", "Internal", "Debrief"].includes(
      rawInteractionContext,
    )
      ? (rawInteractionContext.toLowerCase() as ExtractEvidenceResult["interactionContext"])
      : null;
  const contextConfidence: number | null =
    typeof (evidenceResponse as any)?.context_confidence === "number"
      ? (evidenceResponse as any).context_confidence
      : null;
  const contextReasoning: string | null =
    typeof (evidenceResponse as any)?.context_reasoning === "string"
      ? (evidenceResponse as any).context_reasoning
      : null;

  if (interactionContext) {
    consola.info(
      `🏷️  LLM determined interaction_context: ${interactionContext} (confidence: ${contextConfidence?.toFixed(2) ?? "N/A"})`,
    );
    consola.debug(`   Reasoning: ${contextReasoning ?? "none provided"}`);

    // Update interview record with interaction context
    const { error: contextUpdateErr } = await db
      .from("interviews")
      .update({
        interaction_context: interactionContext,
        context_confidence: contextConfidence,
        context_reasoning: contextReasoning,
      })
      .eq("id", interviewRecord.id);

    if (contextUpdateErr) {
      consola.warn(
        `Failed to update interaction_context for interview ${interviewRecord.id}:`,
        contextUpdateErr.message,
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Phase 2: Derive Persona Facets from Evidence
  // ═══════════════════════════════════════════════════════════════
  let personaSynthesis: PersonaSynthesisFromBaml | null = null;
  const personaFacetsByPersonKey = new Map<
    string,
    PersonaSynthesisFromBaml["persona_facets"]
  >();

  try {
    // Progress checkpoint: Starting persona synthesis
    if (onProgress) {
      await onProgress({
        phase: "persona-synthesis",
        progress: 75,
        detail: `Synthesizing personas from ${evidenceUnits.length} evidence units`,
      });
    }

    consola.log("🧠 Running Phase 2: Persona synthesis from evidence...");
    const synthesisCollector = createBamlCollector("persona-synthesis");
    const synthesisClient = b.withOptions({ collector: synthesisCollector });

    const lfSynthesisGeneration = lfTrace?.generation?.({
      name: "baml.DerivePersonaFacetsFromEvidence",
      input: {
        evidenceCount: evidenceUnits.length,
        peopleCount: evidenceResponse?.people?.length ?? 0,
      },
    });

    // Ensure required interaction context fields are present to satisfy BAML schema
    const fallbackInteraction = interactionContext
      ? interactionContext.charAt(0).toUpperCase() + interactionContext.slice(1)
      : (((evidenceResponse as any)?.interaction_context as string | null) ??
        "Internal");
    const fallbackConfidence =
      typeof contextConfidence === "number"
        ? contextConfidence
        : typeof (evidenceResponse as any)?.context_confidence === "number"
          ? (evidenceResponse as any)?.context_confidence
          : 0.5;
    const fallbackReasoning =
      typeof contextReasoning === "string"
        ? contextReasoning
        : ((evidenceResponse as any)?.context_reasoning ?? "not provided");

    const safeEvidenceResponse = {
      ...((evidenceResponse as Record<string, unknown>) || {}),
      interaction_context: fallbackInteraction,
      context_confidence: fallbackConfidence,
      context_reasoning: fallbackReasoning,
    };

    personaSynthesis = await synthesisClient.DerivePersonaFacetsFromEvidence(
      safeEvidenceResponse as any,
    );

    const synthesisUsage = summarizeCollectorUsage(
      synthesisCollector,
      costOptions,
    );
    if (synthesisUsage) {
      consola.log(
        "[BAML usage] DerivePersonaFacetsFromEvidence:",
        synthesisUsage,
      );

      // Record usage and spend credits for billing
      if (synthesisUsage.totalCostUsd) {
        const billingCtx = createTaskBillingContext(
          normalizedMetadata,
          "persona_synthesis",
        );
        const model =
          process.env.BAML_PERSONA_SYNTHESIS_MODEL || "claude-sonnet";
        recordTaskUsage(
          billingCtx,
          {
            provider: inferProvider(model),
            model,
            inputTokens: synthesisUsage.inputTokens || 0,
            outputTokens: synthesisUsage.outputTokens || 0,
            estimatedCostUsd: synthesisUsage.totalCostUsd,
            resourceType: "interview",
            resourceId: interviewRecord.id,
          },
          `interview:${interviewRecord.id}:persona-synthesis`,
        ).catch((err) => {
          consola.warn("[billing] Failed to record synthesis usage:", err);
        });
      }
    }
    const synthesisLangfuseUsage = mapUsageToLangfuse(synthesisUsage);

    lfSynthesisGeneration?.end?.({
      output: personaSynthesis,
      usage: synthesisLangfuseUsage,
      metadata: synthesisUsage ? { tokenUsage: synthesisUsage } : undefined,
    });

    // Group persona facets by person_key for efficient lookup
    if (personaSynthesis?.persona_facets) {
      for (const facet of personaSynthesis.persona_facets) {
        if (!facet.person_key) continue;
        const facets = personaFacetsByPersonKey.get(facet.person_key) ?? [];
        if (!personaFacetsByPersonKey.has(facet.person_key)) {
          personaFacetsByPersonKey.set(facet.person_key, facets);
        }
        facets.push(facet);
      }
      consola.log(
        `✅ Phase 2 complete: Synthesized ${personaSynthesis.persona_facets.length} persona facets for ${personaFacetsByPersonKey.size} people`,
      );
    }
  } catch (synthesisError) {
    consola.warn(
      "⚠️  Phase 2 persona synthesis failed; falling back to Phase 1 raw mentions",
      synthesisError,
    );
    // Continue with raw mentions if synthesis fails
  }

  const rawPeople = Array.isArray(
    (evidenceResponse as { people?: EvidenceParticipant[] })?.people,
  )
    ? (((evidenceResponse as { people?: EvidenceParticipant[] }).people ??
        []) as EvidenceParticipant[])
    : [];
  consola.info(
    `📋 Phase 1 extracted ${rawPeople.length} people from transcript`,
  );
  // Debug: Log raw BAML people output
  for (let i = 0; i < rawPeople.length; i++) {
    const raw = rawPeople[i] as any;
    consola.info(`📋 BAML Person ${i}:`, {
      person_key: raw?.person_key,
      speaker_label: raw?.speaker_label,
      display_name: raw?.display_name,
      inferred_name: raw?.inferred_name,
      person_name: raw?.person_name,
      role: raw?.role,
    });
  }
  const participants: NormalizedParticipant[] = [];
  const participantByKey = new Map<string, NormalizedParticipant>();

  for (let i = 0; i < rawPeople.length; i++) {
    const raw = rawPeople[i] ?? ({} as EvidenceParticipant);
    let person_key = sanitizePersonKey(
      (raw as EvidenceParticipant).person_key,
      `person-${i}`,
    );
    if (participantByKey.has(person_key)) {
      person_key = `${person_key}-${i}`;
    }
    const role = coerceString((raw as EvidenceParticipant).role);
    // Extract speaker_label from BAML Person (AssemblyAI format like "SPEAKER A")
    const speaker_label = coerceString((raw as any).speaker_label);
    const display_name = coerceString(
      (raw as EvidenceParticipant).display_name,
    );
    const inferred_name = coerceString(
      (raw as EvidenceParticipant).inferred_name,
    );
    const organization = coerceString(
      (raw as EvidenceParticipant).organization,
    );
    const summary = coerceString((raw as EvidenceParticipant).summary);
    const segments = Array.isArray((raw as EvidenceParticipant).segments)
      ? ((raw as EvidenceParticipant).segments as unknown[])
          .map((segment) => coerceString(segment))
          .filter((segment): segment is string => Boolean(segment))
      : [];
    const personas = Array.isArray((raw as EvidenceParticipant).personas)
      ? ((raw as EvidenceParticipant).personas as unknown[])
          .map((persona) => coerceString(persona))
          .filter((persona): persona is string => Boolean(persona))
      : [];
    const facets = Array.isArray((raw as EvidenceParticipant).facets)
      ? ((raw as EvidenceParticipant).facets as unknown[])
          .map((facet) => {
            if (!facet || typeof facet !== "object") return null;
            const kind_slug = coerceString(
              (facet as PersonFacetObservation).kind_slug,
            );
            const value = coerceString((facet as PersonFacetObservation).value);
            if (!kind_slug || !value) return null;
            return {
              ...facet,
              kind_slug,
              value,
              source: (facet as PersonFacetObservation).source || "interview",
            } as PersonFacetObservation;
          })
          .filter((facet): facet is PersonFacetObservation => Boolean(facet))
      : [];
    const scales = Array.isArray((raw as EvidenceParticipant).scales)
      ? ((raw as EvidenceParticipant).scales as unknown[])
          .map((scale) => {
            if (!scale || typeof scale !== "object") return null;
            const kind_slug = coerceString(
              (scale as PersonScaleObservation).kind_slug,
            );
            const score = (scale as PersonScaleObservation).score;
            if (!kind_slug || typeof score !== "number" || Number.isNaN(score))
              return null;
            return {
              ...scale,
              kind_slug,
              score,
              source: (scale as PersonScaleObservation).source || "interview",
            } as PersonScaleObservation;
          })
          .filter((scale): scale is PersonScaleObservation => Boolean(scale))
      : [];

    const normalized: NormalizedParticipant = {
      person_key,
      speaker_label,
      role,
      display_name,
      inferred_name,
      organization,
      summary,
      segments,
      personas,
      facets,
      scales,
    };
    participants.push(normalized);
    participantByKey.set(person_key, normalized);
    personRoleByKey.set(person_key, role ?? null);
  }

  if (!participants.length) {
    const fallbackKey = "person-0";
    const fallbackName =
      metadata.participantName?.trim() || generateFallbackPersonName(metadata);
    const fallbackParticipant: NormalizedParticipant = {
      person_key: fallbackKey,
      speaker_label: null,
      role: null,
      display_name: fallbackName,
      inferred_name: fallbackName,
      organization: null,
      summary: null,
      segments: metadata.segment ? [metadata.segment] : [],
      personas: [],
      facets: [],
      scales: [],
    };
    participants.push(fallbackParticipant);
    participantByKey.set(fallbackKey, fallbackParticipant);
    personRoleByKey.set(fallbackKey, null);
  }

  const primaryParticipant =
    participants.find((participant) => {
      const roleLower = participant.role?.toLowerCase();
      return roleLower ? roleLower !== "interviewer" : false;
    }) ??
    participants[0] ??
    null;

  const primaryPersonKey =
    primaryParticipant?.person_key ?? participants[0]?.person_key ?? "person-0";

  for (const participant of participants) {
    if (participant.facets.length) {
      const observationList =
        facetObservationsByPersonKey.get(participant.person_key) ?? [];
      const dedupeSet =
        facetObservationDedup.get(participant.person_key) ?? new Set<string>();
      if (!facetObservationsByPersonKey.has(participant.person_key)) {
        facetObservationsByPersonKey.set(
          participant.person_key,
          observationList,
        );
        facetObservationDedup.set(participant.person_key, dedupeSet);
      }
      for (const facet of participant.facets) {
        const dedupeKey = `${facet.kind_slug.toLowerCase()}|${facet.value.toLowerCase()}|${facet.evidence_unit_index ?? -1}`;
        if (dedupeSet.has(dedupeKey)) continue;
        dedupeSet.add(dedupeKey);
        observationList.push(facet);
      }
    }
  }

  if (!evidenceUnits.length) {
    return {
      personData: {
        id: await ensureFallbackPerson(db, normalizedMetadata, interviewRecord),
      },
      primaryPersonName: null,
      primaryPersonRole: null,
      primaryPersonDescription: null,
      primaryPersonOrganization: null,
      primaryPersonSegments: [],
      insertedEvidenceIds,
      evidenceUnits,
      evidenceFacetKinds,
      interactionContext: null,
      contextConfidence: null,
      contextReasoning: null,
      rawPeople,
    };
  }

  const sceneTopicByIndex = new Map<number, string>();
  for (const scene of scenes ?? []) {
    const startIndex =
      typeof (scene as { start_index?: number }).start_index === "number"
        ? (scene as { start_index?: number }).start_index
        : null;
    const endIndex =
      typeof (scene as { end_index?: number }).end_index === "number"
        ? (scene as { end_index?: number }).end_index
        : null;
    const topicRaw =
      typeof (scene as { topic?: string }).topic === "string"
        ? (scene as { topic?: string }).topic
        : null;
    if (startIndex === null || startIndex === undefined || topicRaw === null)
      continue;
    const topic = sanitizeVerbatim(topicRaw) ?? null;
    const end =
      endIndex !== null && endIndex !== undefined ? endIndex : startIndex;
    for (let idx = startIndex; idx <= end; idx++) {
      if (topic) sceneTopicByIndex.set(idx, topic);
    }
  }

  const evidenceRows: EvidenceInsert[] = [];
  const durationSeconds =
    typeof (transcriptData as { audio_duration?: unknown }).audio_duration ===
    "number"
      ? (transcriptData as { audio_duration?: number }).audio_duration
      : typeof interviewRecord.duration_sec === "number"
        ? interviewRecord.duration_sec
        : null;
  const wordTimeline = buildWordTimeline(transcriptData);
  const segmentTimeline = buildSegmentTimeline(transcriptData);

  // Debug: log transcript data structure to diagnose timestamp issues
  const transcriptKeys = Object.keys(transcriptData);
  const hasWords = Array.isArray((transcriptData as any).words);
  const hasSpeakerTranscripts = Array.isArray(
    (transcriptData as any).speaker_transcripts,
  );
  const wordsCount = hasWords ? (transcriptData as any).words.length : 0;
  const speakerTranscriptsCount = hasSpeakerTranscripts
    ? (transcriptData as any).speaker_transcripts.length
    : 0;
  const wordsSample =
    hasWords && wordsCount > 0
      ? (transcriptData as any).words.slice(0, 3).map((w: any) => ({
          text: w?.text?.slice?.(0, 20),
          start: w?.start,
          end: w?.end,
          start_ms: w?.start_ms,
        }))
      : [];
  const segmentSample = segmentTimeline.slice(0, 2).map((s) => ({
    text: s.text?.slice(0, 30),
    start: s.start,
  }));

  consola.info(
    `⏱️ Timing data available: ${wordTimeline.length} words, ${segmentTimeline.length} segments, duration=${durationSeconds}s`,
  );
  consola.info(`📊 Transcript structure debug:`, {
    hasWords,
    hasSpeakerTranscripts,
    rawWordsCount: wordsCount,
    speakerTranscriptsCount,
    wordTimelineCount: wordTimeline.length,
    segmentTimelineCount: segmentTimeline.length,
    wordsSample,
    segmentSample,
  });

  // ============================================================================
  // PERSON RESOLUTION - Moved before evidence loop to enable direct person_id attribution
  // This eliminates the fragile two-step INSERT (with NULL) → UPDATE pattern
  // ============================================================================

  const personIdByKey = new Map<string, string>();
  const personNameByKey = new Map<string, string>();
  const keyByPersonId = new Map<string, string>();
  const speakerLabelByPersonId = new Map<string, string>(); // AssemblyAI speaker label (e.g., "SPEAKER A")
  const displayNameByKey = new Map<string, string>();
  const personRoleById = new Map<string, string | null>();
  const internalPerson = metadata.userId
    ? await resolveInternalPerson({
        supabase: db,
        accountId,
        projectId: projectId ?? null,
        userId: metadata.userId,
      })
    : null;
  let internalPersonLinked = false;
  let internalPersonHasTranscriptKey = false;

  if (projectId) {
    const { data: existingInterviewPeople } = await db
      .from("interview_people")
      .select("person_id, transcript_key, display_name, role")
      .eq("interview_id", interviewRecord.id);
    if (Array.isArray(existingInterviewPeople)) {
      existingInterviewPeople.forEach((row) => {
        if (row.transcript_key && row.person_id) {
          personIdByKey.set(row.transcript_key, row.person_id);
          keyByPersonId.set(row.person_id, row.transcript_key);
        }
        if (row.display_name && row.transcript_key) {
          displayNameByKey.set(row.transcript_key, row.display_name);
        }
        if (row.person_id && row.role) {
          personRoleById.set(row.person_id, row.role);
        }
        if (internalPerson?.id && row.person_id === internalPerson.id) {
          internalPersonLinked = true;
          if (row.transcript_key) {
            internalPersonHasTranscriptKey = true;
          }
        }
      });
    }
  }

  const upsertPerson = async (
    fullName: string,
    overrides: Partial<PeopleInsert> = {},
  ): Promise<{ id: string; name: string }> => {
    if (
      peopleHooks?.isPlaceholderPerson?.(fullName) ||
      /^participant\s*\d+$/i.test(fullName) ||
      /^speaker\s+[A-Z]$/i.test(fullName)
    ) {
      throw new Error("skip-placeholder-person");
    }

    const { firstname, lastname } = parseFullName(fullName);
    const payload: PeopleInsert = {
      account_id: accountId,
      project_id: projectId,
      firstname: firstname || null,
      lastname: lastname || null,
      description: overrides.description ?? null,
      segment: overrides.segment ?? metadata.segment ?? null,
      contact_info: overrides.contact_info ?? null,
      role: overrides.role ?? null,
    };
    if (peopleHooks?.upsertPerson) {
      const result = await peopleHooks.upsertPerson(payload);
      if (!result?.id) {
        throw new Error(`Failed to upsert person ${fullName}: missing id`);
      }
      return { id: result.id, name: result.name ?? fullName.trim() };
    }

    const upserted = await upsertPersonWithOrgAwareConflict(db, payload);
    if (!upserted?.id)
      throw new Error(`Person upsert returned no id for ${fullName}`);
    return { id: upserted.id, name: upserted.name ?? fullName.trim() };
  };

  let primaryPersonId: string | null = null;
  let primaryPersonName: string | null = null;
  let primaryPersonRole: string | null = null;
  let primaryPersonDescription: string | null = null;
  let primaryPersonOrganization: string | null = null;
  let primaryPersonSegments: string[] = [];

  consola.info(
    `👥 Processing ${participants.length} participants for person records`,
  );
  if (participants.length) {
    for (const [index, participant] of participants.entries()) {
      const participantKey = participant.person_key;
      consola.debug(
        `  - Creating person record for "${participantKey}" (role: ${participant.role})`,
      );
      const resolved = resolveName(participant, index, metadata);
      if (peopleHooks?.isPlaceholderPerson?.(resolved.name)) {
        consola.info(
          `[extractEvidence] Skipping placeholder person "${resolved.name}"`,
        );
        continue;
      }
      const normalizedRole = participant.role?.toLowerCase() ?? "";
      const isInterviewer = internalPerson && normalizedRole === "interviewer";

      if (isInterviewer && internalPerson) {
        personIdByKey.set(participantKey, internalPerson.id);
        personNameByKey.set(
          participantKey,
          internalPerson.name ?? resolved.name,
        );
        keyByPersonId.set(internalPerson.id, participantKey);
        personRoleById.set(
          internalPerson.id,
          participant.role ?? "interviewer",
        );
        if (participant.speaker_label) {
          speakerLabelByPersonId.set(
            internalPerson.id,
            participant.speaker_label,
          );
        }
        const preferredDisplayName =
          internalPerson.name ??
          participant.display_name?.trim() ??
          resolved.name;
        if (preferredDisplayName) {
          displayNameByKey.set(participantKey, preferredDisplayName);
        }

        if (!primaryPersonId && participant.person_key === primaryPersonKey) {
          primaryPersonId = internalPerson.id;
          primaryPersonName = internalPerson.name ?? resolved.name;
          primaryPersonRole = participant.role ?? null;
          primaryPersonDescription = participant.summary ?? null;
          primaryPersonOrganization = participant.organization ?? null;
          primaryPersonSegments = participant.segments.length
            ? participant.segments
            : metadata.segment
              ? [metadata.segment]
              : [];
        }

        internalPersonLinked = true;
        continue;
      }
      const segments = participant.segments.length
        ? participant.segments
        : metadata.segment
          ? [metadata.segment]
          : [];
      const participantOverrides: Partial<PeopleInsert> = {
        description: participant.summary ?? null,
        segment: segments[0] || metadata.segment || null,
        role: participant.role ?? null,
      };
      let personRecord: { id: string; name: string } | null = null;
      try {
        personRecord = await upsertPerson(resolved.name, participantOverrides);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg === "skip-placeholder-person") {
          consola.info(
            `[processInterview] Skipping placeholder person "${resolved.name}"`,
          );
          continue;
        }
        throw e;
      }
      if (!personRecord) continue;
      personIdByKey.set(participantKey, personRecord.id);
      personNameByKey.set(participantKey, personRecord.name);
      keyByPersonId.set(personRecord.id, participantKey);
      // Use speaker_label (AssemblyAI format like "SPEAKER A") for transcript_key
      if (participant.speaker_label) {
        const normalized =
          peopleHooks?.normalizeSpeakerLabel?.(participant.speaker_label) ??
          participant.speaker_label;
        speakerLabelByPersonId.set(personRecord.id, normalized);
      }
      const preferredDisplayName =
        participant.display_name?.trim() || personRecord.name || null;
      if (preferredDisplayName) {
        displayNameByKey.set(participantKey, preferredDisplayName);
      }
      personRoleById.set(personRecord.id, participant.role ?? null);

      if (!primaryPersonId && participant.person_key === primaryPersonKey) {
        primaryPersonId = personRecord.id;
        primaryPersonName = personRecord.name;
        primaryPersonRole = participant.role ?? null;
        primaryPersonDescription = participantOverrides.description ?? null;
        primaryPersonOrganization = participant.organization ?? null;
        primaryPersonSegments = segments.length
          ? segments
          : metadata.segment
            ? [metadata.segment]
            : [];
      }
    }
  }

  if (!primaryPersonId && participants.length) {
    const fallbackKey = participants[0].person_key;
    const fallbackId = personIdByKey.get(fallbackKey) ?? null;
    if (fallbackId) {
      primaryPersonId = fallbackId;
      primaryPersonName =
        personNameByKey.get(fallbackKey) ??
        resolveName(participants[0], 0, metadata).name;
      primaryPersonRole = participants[0].role ?? null;
      primaryPersonDescription = participants[0].summary ?? null;
      primaryPersonOrganization = participants[0].organization ?? null;
      primaryPersonSegments = participants[0].segments.length
        ? participants[0].segments
        : metadata.segment
          ? [metadata.segment]
          : [];
    }
  }

  if (!primaryPersonId) {
    const fallback = await upsertPerson(generateFallbackPersonName(metadata));
    primaryPersonId = fallback.id;
    primaryPersonName = fallback.name;
    primaryPersonSegments = metadata.segment ? [metadata.segment] : [];
    primaryPersonRole = primaryPersonRole ?? null;
    primaryPersonDescription = primaryPersonDescription ?? null;
    primaryPersonOrganization = primaryPersonOrganization ?? null;
  }

  if (!primaryPersonId)
    throw new Error("Failed to resolve primary person for interview");

  if (!personRoleById.has(primaryPersonId) || primaryPersonRole !== null) {
    personRoleById.set(primaryPersonId, primaryPersonRole ?? null);
  }

  consola.info(
    `✅ Person resolution complete: ${personIdByKey.size} people mapped`,
  );

  // ============================================================================
  // EVIDENCE EXTRACTION LOOP - Now has personIdByKey available for direct attribution
  // ============================================================================

  for (let idx = 0; idx < evidenceUnits.length; idx++) {
    const ev = evidenceUnits[idx] as EvidenceTurn;
    const rawPersonKey = coerceString(
      (ev as { person_key?: string }).person_key,
    );
    const fallbackPersonKey =
      primaryPersonKey || participants[0]?.person_key || "person-0";
    const personKey =
      rawPersonKey && participantByKey.has(rawPersonKey)
        ? rawPersonKey
        : fallbackPersonKey;
    const verb = sanitizeVerbatim(ev?.verbatim);
    if (!verb) continue;
    const chunk = sanitizeVerbatim(ev?.chunk) ?? verb;
    const gist = sanitizeVerbatim(ev?.gist) ?? verb;
    const evidenceIndex = idx;
    const sceneTopic = sceneTopicByIndex.get(evidenceIndex) ?? null;
    const facetMentions = Array.isArray(
      (ev as { facet_mentions?: FacetMention[] }).facet_mentions,
    )
      ? ((ev as { facet_mentions?: FacetMention[] })
          .facet_mentions as FacetMention[])
      : [];

    if (facetMentions.length > 0) {
      consola.info(
        `Evidence ${evidenceIndex} has ${facetMentions.length} facet mentions`,
      );
    }

    const kindSlugSet = new Set<string>();
    const mentionDedup = new Set<number>();
    const projectIdForInsert = projectId ?? null;

    for (const mention of facetMentions) {
      if (!mention || typeof mention !== "object") continue;
      const kindRaw =
        typeof mention.kind_slug === "string"
          ? mention.kind_slug.trim().toLowerCase()
          : "";
      const labelRaw = sanitizeFacetLabel((mention as FacetMention).value);
      if (!kindRaw || !labelRaw) continue;
      const resolvedLabel = sanitizeFacetLabel(labelRaw);
      if (!resolvedLabel) continue;

      const matchedFacet = matchFacetFromLookup(
        facetLookup,
        kindRaw,
        resolvedLabel,
      );
      const synonyms = Array.isArray(matchedFacet?.synonyms)
        ? (matchedFacet?.synonyms ?? [])
        : [];
      let facetAccountId: number | null =
        matchedFacet?.facet_account_id ?? null;

      // If no match found in catalog OR matched a global facet (id=0 sentinel),
      // create account-specific facet via FacetResolver
      if (!facetAccountId || facetAccountId === 0) {
        facetAccountId = await facetResolver.ensureFacet({
          kindSlug: kindRaw,
          label: resolvedLabel,
          synonyms,
        });
      }

      if (!facetAccountId) continue;
      if (mentionDedup.has(facetAccountId)) continue;
      mentionDedup.add(facetAccountId);
      kindSlugSet.add(kindRaw);
      const mentionQuote = sanitizeFacetLabel(
        (mention as FacetMention).quote ?? null,
      );

      // Build evidence_facet row - person_id will be set from personIdByKey map
      // personKey is already resolved at this point (lines 1134-1142)
      const facetPersonId = personIdByKey.get(personKey) || null;

      evidenceFacetRowsToInsert.push({
        account_id: accountId,
        project_id: projectIdForInsert,
        evidence_index: idx,
        person_id: facetPersonId,
        kind_slug: kindRaw,
        facet_account_id: facetAccountId,
        label: resolvedLabel,
        source: "interview",
        confidence: 0.8,
        quote: mentionQuote,
      });
    }

    const kindSlugs = Array.from(kindSlugSet);
    evidenceFacetKinds.push(kindSlugs);

    // Track facets by person for persona synthesis
    if (kindSlugSet.size > 0) {
      const byPerson = facetMentionsByPersonKey.get(personKey) ?? [];
      if (!facetMentionsByPersonKey.has(personKey)) {
        facetMentionsByPersonKey.set(personKey, byPerson);
      }
      // Add facets for this evidence to person's collection
      for (const row of evidenceFacetRowsToInsert) {
        if (row.evidence_index === idx) {
          byPerson.push({
            kindSlug: row.kind_slug,
            label: row.label,
            facetAccountId: row.facet_account_id,
            quote: row.quote,
            evidenceIndex,
          });
        }
      }
    }
    const confidenceStr: string = ((
      ev as { confidence?: EvidenceInsert["confidence"] }
    ).confidence || "medium") as string;
    const weight_quality =
      confidenceStr === "high" ? 0.95 : confidenceStr === "low" ? 0.6 : 0.8;
    const weight_relevance =
      confidenceStr === "high" ? 0.9 : confidenceStr === "low" ? 0.6 : 0.8;
    const independence_key = computeIndependenceKey(gist ?? verb, kindSlugs);
    const rawAnchors =
      ev &&
      typeof (ev as any).anchors === "object" &&
      (ev as any).anchors !== null
        ? [((ev as any).anchors ?? {}) as Record<string, any>]
        : [];

    // Get timing from multiple sources - prefer word-level precision when available
    let anchorSeconds: number | null = null;
    let timingSource = "none";

    // First, try word-level text search for precise timing (best for single-speaker content)
    const snippetForTiming = chunk || gist || verb;
    if (snippetForTiming?.length && wordTimeline.length > 0) {
      anchorSeconds = findStartSecondsForSnippet({
        snippet: snippetForTiming,
        wordTimeline,
        segmentTimeline,
        fullTranscript,
        durationSeconds,
      });
      if (anchorSeconds !== null) {
        timingSource = "word-level";
      }
    }

    // Second: try segment-level matching (more reliable than AI anchors)
    if (
      anchorSeconds === null &&
      snippetForTiming?.length &&
      segmentTimeline.length > 0
    ) {
      anchorSeconds = findStartSecondsForSnippet({
        snippet: snippetForTiming,
        wordTimeline: [], // Already tried word-level
        segmentTimeline,
        fullTranscript,
        durationSeconds,
      });
      if (anchorSeconds !== null) {
        timingSource = "segment-level";
      }
    }

    // Last resort: AI-provided timing (can be unreliable/hallucinated)
    if (anchorSeconds === null && rawAnchors.length > 0 && rawAnchors[0]) {
      const firstAnchor = rawAnchors[0];
      if (typeof firstAnchor.start_ms === "number") {
        anchorSeconds = firstAnchor.start_ms / 1000;
        timingSource = "ai-ms";
      } else if (typeof firstAnchor.start_seconds === "number") {
        anchorSeconds = firstAnchor.start_seconds;
        timingSource = "ai-seconds";
      }
    }

    if (evidenceIndex < 5) {
      const snippetPreview = snippetForTiming?.slice(0, 60) || "(no snippet)";
      if (anchorSeconds !== null) {
        consola.info(
          `Evidence ${evidenceIndex}: timing=${anchorSeconds}s source=${timingSource} snippet="${snippetPreview}"`,
        );
      } else {
        consola.warn(
          `Evidence ${evidenceIndex}: No timing available from any source, snippet="${snippetPreview}"`,
        );
      }
    }

    const sanitizedAnchors = rawAnchors
      .map((anchor) => {
        if (!anchor || typeof anchor !== "object") return null;

        const result: Record<string, any> = {};

        // Store timing data
        if (anchorSeconds !== null) {
          result.start_ms = Math.round(anchorSeconds * 1000);
        }
        if (anchor.end_ms !== undefined) {
          result.end_ms = anchor.end_ms;
        }

        // Store R2 key (stable identifier) instead of signed URL
        if (interviewRecord.media_url) {
          result.media_key = getR2KeyFromPublicUrl(interviewRecord.media_url);
        }

        // Preserve optional metadata
        if (anchor.chapter_title) {
          result.chapter_title = anchor.chapter_title;
        }
        if (anchor.char_span) {
          result.char_span = anchor.char_span;
        }

        return result;
      })
      .filter((anchor): anchor is Record<string, any> => Boolean(anchor));

    // Create default anchor if none exist
    if (
      sanitizedAnchors.length === 0 &&
      interviewRecord.media_url &&
      anchorSeconds !== null
    ) {
      sanitizedAnchors.push({
        start_ms: Math.round(anchorSeconds * 1000),
        media_key: getR2KeyFromPublicUrl(interviewRecord.media_url),
      });
    }
    const row: EvidenceInsert = {
      account_id: accountId,
      project_id: projectId ?? null,
      interview_id: interviewRecord.id,
      source_type: "primary",
      method: "interview",
      modality: "qual",
      support: "supports",
      personas: [],
      segments: [],
      journey_stage: null,
      chunk,
      gist,
      topic: sceneTopic,
      weight_quality,
      weight_relevance,
      independence_key,
      confidence: confidenceStr,
      verbatim: verb,
      anchors: sanitizedAnchors as unknown as Json,
      is_question: ev.isQuestion ?? false,
    };

    // Empathy maps (says/does/thinks/feels/pains/gains) removed from extraction.
    // Will be derived from facet_mentions as paid-tier feature. See bead Insights-vpws.

    const whyItMatters = sanitizeVerbatim(
      (ev as { why_it_matters?: string }).why_it_matters,
    );
    if (whyItMatters) {
      (row as Record<string, unknown>).context_summary = whyItMatters;
    }

    // Skip raw mention processing - we'll use Phase 2 persona facets instead
    // This prevents over-extraction of interview content as personal traits

    evidenceRows.push(row);
    personKeyForEvidence.push(personKey);
  }

  if (!evidenceRows.length) {
    return {
      personData: {
        id: await ensureFallbackPerson(db, normalizedMetadata, interviewRecord),
      },
      primaryPersonName: null,
      primaryPersonRole: null,
      primaryPersonDescription: null,
      primaryPersonOrganization: null,
      primaryPersonSegments: [],
      insertedEvidenceIds,
      evidenceUnits,
      evidenceFacetKinds,
    };
  }

  await db.from("evidence").delete().eq("interview_id", interviewRecord.id);

  // Note: Embeddings generated async via DB trigger → pgmq queue → edge function
  // (same pattern as evidence_facet, themes, person_facet)

  const { data: insertedEvidence, error: evidenceInsertError } = await db
    .from("evidence")
    .insert(evidenceRows)
    .select("id");
  if (evidenceInsertError)
    throw new Error(
      `Failed to insert evidence: ${evidenceInsertError.message}`,
    );
  insertedEvidenceIds = (insertedEvidence ?? []).map((e) => e.id);

  consola.info(
    `📋 Evidence insertion complete: ${insertedEvidenceIds.length} evidence rows, ${evidenceFacetRowsToInsert.length} facet rows to insert`,
  );

  // Progress checkpoint: Evidence insertion complete
  if (onProgress) {
    await onProgress({
      phase: "evidence-insert",
      progress: 85,
      detail: `Inserted ${insertedEvidenceIds.length} evidence rows, linking facets`,
    });
  }

  // Map evidence_index to evidence_id and insert facets
  if (insertedEvidenceIds.length && evidenceFacetRowsToInsert.length) {
    try {
      await db
        .from("evidence_facet")
        .delete()
        .in("evidence_id", insertedEvidenceIds);
    } catch (cleanupErr) {
      consola.warn("Failed to clear existing evidence_facet rows", cleanupErr);
    }

    // Map evidence_index to evidence_id
    const finalFacetRows = evidenceFacetRowsToInsert.map((row) => {
      const { evidence_index, ...rest } = row;
      return {
        ...rest,
        evidence_id: insertedEvidenceIds[evidence_index],
      };
    });

    if (finalFacetRows.length) {
      consola.info(
        `Attempting to insert ${finalFacetRows.length} evidence_facet rows`,
      );
      const { error: facetInsertError } = await db
        .from("evidence_facet")
        .insert(finalFacetRows);
      if (facetInsertError) {
        consola.error("Failed to insert evidence_facet rows", {
          error: facetInsertError.message,
          code: facetInsertError.code,
          details: facetInsertError.details,
          hint: facetInsertError.hint,
          sampleRow: finalFacetRows[0],
        });
      } else {
        consola.success(
          `Successfully inserted ${finalFacetRows.length} evidence_facet rows`,
        );
      }
    }
  }

  // Person resolution was moved before evidence loop (see lines 1134-1370)
  // This enables direct person_id attribution during facet row building

  const ensuredPersonIds = new Set<string>([primaryPersonId]);
  for (const id of personIdByKey.values()) ensuredPersonIds.add(id);
  for (const personId of ensuredPersonIds) {
    const role = personRoleById.get(personId) ?? null;
    const personKey = keyByPersonId.get(personId) ?? null;
    // Prefer speaker_label (AssemblyAI format), fall back to person_key (BAML format)
    // transcript_key can be null if we don't know which speaker this person is
    const transcriptKey = speakerLabelByPersonId.get(personId) ?? personKey;

    consola.info(`🔗 Creating interview_people for person ${personId}:`, {
      personKey,
      speakerLabel: speakerLabelByPersonId.get(personId),
      transcriptKey,
      role,
    });

    // Check existing interview_people record to preserve user-entered display_name
    const { data: existingLink } = await db
      .from("interview_people")
      .select("display_name")
      .eq("interview_id", interviewRecord.id)
      .eq("person_id", personId)
      .single();

    const existingDisplayName = existingLink?.display_name;
    const isExistingDisplayNameGeneric =
      !existingDisplayName ||
      /^(Participant|Anonymous|Speaker|Person|Interviewee)\s*\d*$/i.test(
        existingDisplayName,
      );

    const bamlDisplayName = personKey
      ? (displayNameByKey.get(personKey) ?? null)
      : null;
    const isBamlDisplayNameGeneric =
      !bamlDisplayName ||
      /^(Participant|Anonymous|Speaker|Person|Interviewee)\s*\d*$/i.test(
        bamlDisplayName,
      );

    // Preserve existing non-generic display_name, only use BAML value if existing is generic or BAML has a better name
    const finalDisplayName = !isExistingDisplayNameGeneric
      ? existingDisplayName
      : isBamlDisplayNameGeneric
        ? existingDisplayName
        : bamlDisplayName;

    const linkPayload: InterviewPeopleInsert = {
      interview_id: interviewRecord.id,
      person_id: personId,
      project_id: projectId ?? null,
      role,
      transcript_key: transcriptKey,
      display_name: finalDisplayName,
    };
    const { error: linkErr } = await db
      .from("interview_people")
      .upsert(linkPayload, { onConflict: "interview_id,person_id" });
    if (linkErr && !linkErr.message?.includes("duplicate")) {
      consola.warn(
        `Failed linking person ${personId} to interview ${interviewRecord.id}`,
        linkErr.message,
      );
    }
    if (internalPerson?.id && personId === internalPerson.id && transcriptKey) {
      internalPersonHasTranscriptKey = true;
    }
  }

  // Ensure ALL transcript speakers have interview_people records, not just BAML-extracted ones
  // This handles the case where BAML only extracts the primary participant but not the interviewer
  const speakerTranscriptsRaw = (transcriptData as Record<string, unknown>)
    .speaker_transcripts;
  consola.info(
    `🎙️  Checking transcript speakers for interview ${interviewRecord.id}`,
    {
      hasSpeakerTranscripts: Array.isArray(speakerTranscriptsRaw),
      speakerTranscriptsCount: Array.isArray(speakerTranscriptsRaw)
        ? speakerTranscriptsRaw.length
        : 0,
    },
  );

  if (
    Array.isArray(speakerTranscriptsRaw) &&
    speakerTranscriptsRaw.length > 0
  ) {
    // Get unique speaker labels from transcript
    const uniqueSpeakers = new Set<string>();
    for (const utterance of speakerTranscriptsRaw as Array<
      Record<string, unknown>
    >) {
      const speaker =
        typeof utterance.speaker === "string" ? utterance.speaker.trim() : "";
      if (speaker) uniqueSpeakers.add(speaker);
    }

    consola.info(
      `🎙️  Found unique speakers in transcript: ${Array.from(uniqueSpeakers).join(", ")}`,
    );

    // Get existing transcript_keys that are already linked
    const existingTranscriptKeys = new Set<string>();
    const { data: existingLinks } = await db
      .from("interview_people")
      .select("transcript_key")
      .eq("interview_id", interviewRecord.id);
    if (existingLinks) {
      for (const link of existingLinks) {
        if (link.transcript_key) {
          // Normalize to uppercase for comparison
          existingTranscriptKeys.add(link.transcript_key.toUpperCase());
        }
      }
    }

    consola.info(
      `🎙️  Existing transcript_keys in interview_people: ${Array.from(existingTranscriptKeys).join(", ") || "(none)"}`,
    );

    // Find speakers without interview_people records
    const missingSpeakers: string[] = [];
    for (const speaker of uniqueSpeakers) {
      const normalizedSpeaker = speaker.toUpperCase();
      // Check if this speaker is already linked (could be "A", "SPEAKER A", etc.)
      const isLinked =
        existingTranscriptKeys.has(normalizedSpeaker) ||
        existingTranscriptKeys.has(`SPEAKER ${normalizedSpeaker}`) ||
        (normalizedSpeaker.startsWith("SPEAKER ") &&
          existingTranscriptKeys.has(
            normalizedSpeaker.replace("SPEAKER ", ""),
          ));

      consola.debug(
        `🎙️  Speaker "${speaker}" (normalized: "${normalizedSpeaker}") isLinked: ${isLinked}`,
      );

      if (!isLinked) {
        missingSpeakers.push(speaker);
      }
    }

    if (missingSpeakers.length > 0) {
      consola.info(
        `🎙️  Found ${missingSpeakers.length} transcript speakers without interview_people records: ${missingSpeakers.join(", ")}`,
      );

      // Link the internal person (current user/interviewer) to a speaker if not already linked
      if (internalPerson?.id && !internalPersonHasTranscriptKey) {
        const preferredInternalSpeaker =
          missingSpeakers.find((speaker) =>
            speaker.toUpperCase().includes("A"),
          ) ?? missingSpeakers[0];

        if (preferredInternalSpeaker) {
          const internalTranscriptKey = preferredInternalSpeaker
            .toUpperCase()
            .startsWith("SPEAKER ")
            ? preferredInternalSpeaker
            : `SPEAKER ${preferredInternalSpeaker}`.toUpperCase();

          const { error: internalLinkError } = await db
            .from("interview_people")
            .upsert(
              {
                interview_id: interviewRecord.id,
                person_id: internalPerson.id,
                project_id: projectId ?? null,
                role: "interviewer",
                transcript_key: internalTranscriptKey,
                display_name: internalPerson.name,
              },
              { onConflict: "interview_id,person_id" },
            );

          if (internalLinkError) {
            consola.warn(
              `Failed linking internal person to interview ${interviewRecord.id}:`,
              internalLinkError.message,
            );
          } else {
            internalPersonLinked = true;
            internalPersonHasTranscriptKey = true;
            consola.info(
              `  ✅ Linked internal person to speaker "${preferredInternalSpeaker}"`,
            );
          }
        }
      }

      // NOTE: We intentionally do NOT auto-create placeholder people records for
      // unidentified transcript speakers. This prevents polluting the people table
      // with generic "Speaker A", "Speaker B" entries when diarization over-segments.
      // The transcript display shows raw speaker labels, and users can manually
      // add participants via "Add Participant" in the UI when they know who's who.
      if (missingSpeakers.length > 1) {
        consola.info(
          `🎙️  Remaining unlinked speakers: ${missingSpeakers.join(", ")}. Users can manually add via "Add Participant".`,
        );
      }
    }
  }

  if (insertedEvidenceIds.length) {
    // Build evidence_id -> person_id mapping for both evidence_people and evidence_facet
    const evidenceIdToPersonId = new Map<string, string>();

    for (let idx = 0; idx < insertedEvidenceIds.length; idx++) {
      const evId = insertedEvidenceIds[idx];
      const key = personKeyForEvidence[idx];
      const targetPersonId = (key && personIdByKey.get(key)) || primaryPersonId;
      if (!targetPersonId) continue;

      evidenceIdToPersonId.set(evId, targetPersonId);

      const role = targetPersonId ? personRoleById.get(targetPersonId) : null;
      const { error: epErr } = await db.from("evidence_people").insert({
        evidence_id: evId,
        person_id: targetPersonId,
        account_id: accountId,
        project_id: projectId ?? null,
        role: role || "speaker",
      });
      if (epErr && !epErr.message?.includes("duplicate")) {
        consola.warn(
          `Failed linking evidence ${evId} to person ${targetPersonId}: ${epErr.message}`,
        );
      }
    }

    // evidence_facet.person_id is now set directly during INSERT (see facet row building around line 1210)
    // No longer need fragile two-step INSERT (NULL) → UPDATE pattern
  }

  if (projectId) {
    // Use Phase 2 synthesized persona facets instead of raw Phase 1 mentions
    const observationInputs: Array<{
      personId: string;
      facets: PersonFacetObservation[];
      scales: PersonScaleObservation[];
    }> = [];

    const allPersonKeys = new Set<string>([
      ...personaFacetsByPersonKey.keys(),
      ...participantByKey.keys(),
      ...facetMentionsByPersonKey.keys(),
    ]);

    consola.info(`🎯 Processing facets for ${allPersonKeys.size} person_keys`);
    consola.debug(
      "  - personaFacetsByPersonKey has keys:",
      Array.from(personaFacetsByPersonKey.keys()),
    );
    consola.debug(
      "  - participantByKey has keys:",
      Array.from(participantByKey.keys()),
    );
    consola.debug(
      "  - personIdByKey has keys:",
      Array.from(personIdByKey.keys()),
    );

    for (const personKey of allPersonKeys) {
      const personId = personIdByKey.get(personKey);
      if (!personId) {
        consola.warn(
          `⚠️  Skipping facets for person_key "${personKey}" - no matching person record found`,
        );
        consola.debug(
          "Available person_keys in personIdByKey:",
          Array.from(personIdByKey.keys()),
        );
        continue;
      }

      const facetObservations: PersonFacetObservation[] = [];
      const personaFacets = personaFacetsByPersonKey.get(personKey) ?? [];
      for (const pf of personaFacets) {
        if (!pf.kind_slug || !pf.value) continue;
        const evidenceIndices = Array.isArray(pf.evidence_refs)
          ? pf.evidence_refs
          : [];
        const primaryEvidenceIndex = evidenceIndices[0] ?? undefined;

        const facetObservation: PersonFacetObservation = {
          kind_slug: pf.kind_slug,
          value: pf.value,
          source: "interview",
          evidence_unit_index: primaryEvidenceIndex,
          confidence: typeof pf.confidence === "number" ? pf.confidence : 0.8,
          notes: pf.reasoning ? [pf.reasoning] : undefined,
          facet_account_id: pf.facet_account_id ?? undefined,
        };
        if (!pf.facet_account_id) {
          facetObservation.candidate = {
            kind_slug: pf.kind_slug,
            label: pf.value,
            synonyms: [],
            notes: pf.reasoning
              ? [
                  `Frequency: ${pf.frequency ?? 1}, Evidence refs: ${evidenceIndices.join(", ")}`,
                ]
              : undefined,
          };
        }
        facetObservations.push(facetObservation);
      }

      // Fallback: derive facets from direct evidence mentions when synthesis is sparse
      const existingFacetAccountIds = new Set<number>();
      const existingKindValueKeys = new Set<string>();
      for (const obs of facetObservations) {
        if (obs.facet_account_id) {
          existingFacetAccountIds.add(obs.facet_account_id);
        }
        if (obs.value) {
          existingKindValueKeys.add(
            `${obs.kind_slug.toLowerCase()}|${obs.value.toLowerCase()}`,
          );
        }
      }
      const mentionFallback = facetMentionsByPersonKey.get(personKey) ?? [];
      for (const mention of mentionFallback) {
        if (existingFacetAccountIds.has(mention.facetAccountId)) continue;
        const key = `${mention.kindSlug.toLowerCase()}|${mention.label.toLowerCase()}`;
        if (existingKindValueKeys.has(key)) continue;
        existingFacetAccountIds.add(mention.facetAccountId);
        existingKindValueKeys.add(key);
        facetObservations.push({
          kind_slug: mention.kindSlug,
          value: mention.label,
          source: "interview",
          evidence_unit_index: mention.evidenceIndex,
          confidence: 0.6,
          facet_account_id: mention.facetAccountId,
          notes: mention.quote ? [mention.quote] : undefined,
        });
      }
      const scaleObservations = participantByKey.get(personKey)?.scales ?? [];
      if (facetObservations.length || scaleObservations.length) {
        observationInputs.push({
          personId,
          facets: facetObservations,
          scales: scaleObservations,
        });
      }
    }

    if (observationInputs.length) {
      await persistFacetObservations({
        db,
        accountId,
        projectId,
        observations: observationInputs,
        evidenceIds: insertedEvidenceIds,
      });
    }
  }

  // Progress checkpoint: Extraction complete
  if (onProgress) {
    await onProgress({
      phase: "complete",
      progress: 100,
      detail: `Extraction complete: ${insertedEvidenceIds.length} evidence, ${rawPeople.length} people`,
    });
  }

  // TrustCore: Validate person attribution parity
  try {
    const parityResult = await validateAttributionParity(
      db,
      interviewRecord.id,
      "trigger-v2",
    );
    if (!parityResult.passed) {
      consola.warn(
        "[TrustCore] Person attribution parity check failed in Trigger v2 extraction",
        {
          interviewId: interviewRecord.id,
          mismatches: parityResult.mismatches,
        },
      );
    }
  } catch (parityError: unknown) {
    consola.error(
      "[TrustCore] Parity validation failed:",
      parityError instanceof Error ? parityError.message : String(parityError),
    );
  }

  return {
    personData: { id: primaryPersonId },
    primaryPersonName,
    primaryPersonRole,
    primaryPersonDescription,
    primaryPersonOrganization,
    primaryPersonSegments,
    insertedEvidenceIds,
    evidenceUnits,
    evidenceFacetKinds,
    interactionContext,
    contextConfidence,
    contextReasoning,
    rawPeople,
  };
}

// ============================================================================
// Helper: Ensure fallback person exists when no person extracted
// ============================================================================

async function ensureFallbackPerson(
  db: SupabaseClient<Database>,
  metadata: InterviewMetadata,
  interviewRecord: Interview,
): Promise<string> {
  const fallbackName = generateFallbackPersonName(metadata);
  const { firstname, lastname } = parseFullName(fallbackName);
  const payload: PeopleInsert = {
    account_id: metadata.accountId,
    project_id: metadata.projectId,
    firstname: firstname || null,
    lastname: lastname || null,
  };
  const data = await upsertPersonWithOrgAwareConflict(db, payload);
  if (!data?.id) {
    throw new Error(`Failed to ensure fallback person`);
  }
  const linkPayload: InterviewPeopleInsert = {
    interview_id: interviewRecord.id,
    person_id: data.id,
    project_id: metadata.projectId ?? null,
    role: "participant",
  };
  await db
    .from("interview_people")
    .upsert(linkPayload, { onConflict: "interview_id,person_id" });
  return data.id;
}

// Temporary alias for v2 task while we complete the transplant
export { extractEvidenceAndPeopleCore as extractEvidenceCore };
