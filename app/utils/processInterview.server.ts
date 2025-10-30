// Import the BAML async client helper ("b"), following the official BoundaryML docs.
// After running `baml-cli generate`, all functions are exposed on this client.
// NOTE: tsconfig path alias `~` maps to `app/`, so baml_client (generated at project root)
// is accessible via `~/../baml_client`.
// Import BAML client - this file is server-only so it's safe to import directly

import { createHash } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import consola from "consola"
import posthog from "posthog-js"
import { b } from "~/../baml_client"
import type {
	EvidenceParticipant,
	FacetCatalog,
	FacetMention,
	PersonFacetObservation,
	PersonScaleObservation,
} from "~/../baml_client/types"
import type { Json } from "~/../supabase/types"
import { runEvidenceAnalysis } from "~/features/research/analysis/runEvidenceAnalysis.server"
import { autoGroupThemesAndApply } from "~/features/themes/db.autoThemes.server"
import { createBamlCollector, mapUsageToLangfuse, summarizeCollectorUsage } from "~/lib/baml/collector.server"
import { FacetResolver, getFacetCatalog, persistFacetObservations } from "~/lib/database/facets.server"
import { createPlannedAnswersForInterview } from "~/lib/database/project-answers.server"
import { getLangfuseClient } from "~/lib/langfuse.server"
import { getServerClient } from "~/lib/supabase/client.server"
import type { Database, InsightInsert, Interview, InterviewInsert } from "~/types"
import { generateConversationAnalysis } from "~/utils/conversationAnalysis.server"
import { getR2KeyFromPublicUrl } from "~/utils/r2.server"
import { safeSanitizeTranscriptPayload } from "~/utils/transcript/sanitizeTranscriptData.server"

// Supabase table types
type Tables = Database["public"]["Tables"]
type PeopleInsert = Tables["people"]["Insert"]
type PeopleUpdate = Tables["people"]["Update"]
type InterviewPeopleInsert = Tables["interview_people"]["Insert"]
type EvidenceInsert = Tables["evidence"]["Insert"]

export interface ProcessingResult {
	stored: InsightInsert[]
	interview: Interview
}

export interface UploadMediaAndTranscribePayload {
	metadata: InterviewMetadata
	transcriptData: Record<string, unknown>
	mediaUrl: string
	existingInterviewId?: string
	analysisJobId?: string
	userCustomInstructions?: string
}

export interface UploadMediaAndTranscribeResult {
	metadata: InterviewMetadata
	interview: Interview
	sanitizedTranscriptData: Record<string, unknown>
	transcriptData: Record<string, unknown>
	fullTranscript: string
	language: string
	analysisJobId?: string
	userCustomInstructions?: string
}

export interface AnalyzeThemesAndPersonaResult {
	storedInsights: InsightInsert[]
	interview: Interview
}

export interface AnalyzeThemesTaskPayload {
	metadata: InterviewMetadata
	interview: Interview
	fullTranscript: string
	userCustomInstructions?: string
	evidenceResult: ExtractEvidenceResult
	analysisJobId?: string
}

export interface AttributeAnswersTaskPayload {
	metadata: InterviewMetadata
	interview: Interview
	fullTranscript: string
	insertedEvidenceIds: string[]
	storedInsights: InsightInsert[]
	analysisJobId?: string
}

export const workflowRetryConfig = {
	maxAttempts: 3,
	factor: 1.8,
	minTimeoutInMs: 500,
	maxTimeoutInMs: 30_000,
	randomize: false,
}

export interface InterviewMetadata {
	accountId: string
	userId?: string // Add user ID for audit fields
	projectId?: string
	interviewTitle?: string
	interviewDate?: string
	interviewerName?: string
	participantName?: string
	segment?: string
	durationMin?: number
	fileName?: string
}

interface ExtractedInsight {
	category: string
	tag: string
	journey_stage?: string
	jtbd?: string
	motivation?: string
	pain?: string
	desired_outcome?: string
	emotional_response?: string
	opportunity_ideas?: string[]
	confidence?: "low" | "medium" | "high"
	contradictions?: string
}

function sanitizeVerbatim(input: unknown): string | null {
	if (typeof input !== "string") return null
	// Replace smart quotes, collapse whitespace, and drop ASCII control chars
	const mapQuotes = input.replace(/[\u2018\u2019\u201B\u2032]/g, "'").replace(/[\u201C\u201D\u2033]/g, '"')
	let out = ""
	for (let i = 0; i < mapQuotes.length; i++) {
		const code = mapQuotes.charCodeAt(i)
		// Skip control chars: 0-31 and 127
		if ((code >= 0 && code <= 31) || code === 127) {
			out += " "
		} else {
			out += mapQuotes[i]
		}
	}
	const cleaned = out.replace(/\s+/g, " ").trim()
	return cleaned.length ? cleaned : null
}

// Generate a stable, short signature for dedupe/independence.
// Not cryptographically strong; sufficient to cluster near-duplicates.
function stringHash(input: string): string {
	let h = 2166136261 >>> 0
	for (let i = 0; i < input.length; i++) {
		h ^= input.charCodeAt(i)
		h = Math.imul(h, 16777619) >>> 0
	}
	return `00000000${h.toString(16)}`.slice(-8)
}

function computeIndependenceKey(verbatim: string, kindTags: string[]): string {
	const normQuote = verbatim.toLowerCase().replace(/\s+/g, " ").trim()
	const mainTag = (kindTags[0] || "").toLowerCase().trim()
	const basis = `${normQuote.slice(0, 160)}|${mainTag}`
	return stringHash(basis)
}

type WordTimelineEntry = { text: string; start: number }
type SegmentTimelineEntry = { text: string; start: number | null }

function coerceSeconds(value: unknown): number | null {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value > 500 ? value / 1000 : value
	}
	if (typeof value === "string") {
		if (value.endsWith("ms")) {
			const ms = Number.parseFloat(value.replace("ms", ""))
			return Number.isFinite(ms) ? ms / 1000 : null
		}
		if (value.includes(":")) {
			const parts = value.split(":").map((part) => Number.parseFloat(part))
			if (parts.length === 2 && parts.every((part) => Number.isFinite(part))) {
				return parts[0] * 60 + parts[1]
			}
		}
		const numeric = Number.parseFloat(value)
		if (Number.isFinite(numeric)) {
			return numeric > 500 ? numeric / 1000 : numeric
		}
	}
	return null
}

function normalizeTokens(input: string): string[] {
	return input
		.toLowerCase()
		.replace(/[^a-z0-9\s']/gi, " ")
		.split(/\s+/)
		.filter(Boolean)
}

function buildWordTimeline(transcriptData: Record<string, unknown>): WordTimelineEntry[] {
	const wordsRaw = Array.isArray((transcriptData as any).words) ? ((transcriptData as any).words as any[]) : []
	const timeline: WordTimelineEntry[] = []
	for (const word of wordsRaw) {
		if (!word || typeof word !== "object") continue
		const text = typeof word.text === "string" ? word.text.trim().toLowerCase() : ""
		if (!text) continue
		const start = coerceSeconds((word as any).start ?? (word as any).start_ms ?? (word as any).startTime)
		if (start === null) continue
		timeline.push({ text, start })
	}
	return timeline
}

function buildSegmentTimeline(transcriptData: Record<string, unknown>): SegmentTimelineEntry[] {
	const sources = ["utterances", "segments", "sentences"] as const
	const timeline: SegmentTimelineEntry[] = []
	for (const key of sources) {
		const items = Array.isArray((transcriptData as any)[key]) ? ((transcriptData as any)[key] as any[]) : []
		for (const item of items) {
			if (!item || typeof item !== "object") continue
			const text = typeof item.text === "string" ? item.text : typeof item.gist === "string" ? item.gist : null
			if (!text) continue
			const start = coerceSeconds(item.start ?? item.start_ms ?? item.startTime)
			timeline.push({ text, start })
		}
	}
	return timeline
}

function findStartSecondsForSnippet({
	snippet,
	wordTimeline,
	segmentTimeline,
	fullTranscript,
	durationSeconds,
}: {
	snippet: string
	wordTimeline: WordTimelineEntry[]
	segmentTimeline: SegmentTimelineEntry[]
	fullTranscript: string
	durationSeconds: number | null
}): number | null {
	const normalizedTokens = normalizeTokens(snippet)
	const searchTokens = normalizedTokens.slice(0, Math.min(4, normalizedTokens.length))

	if (searchTokens.length && wordTimeline.length) {
		const window = searchTokens.length
		for (let i = 0; i <= wordTimeline.length - window; i++) {
			let matches = true
			for (let j = 0; j < window; j++) {
				if (wordTimeline[i + j]?.text !== searchTokens[j]) {
					matches = false
					break
				}
			}
			if (matches) {
				return wordTimeline[i].start
			}
		}
	}

	const normalizedSnippet = normalizeForSearchText(snippet)
	const snippetSample = normalizedSnippet.slice(0, 160)
	if (snippetSample && segmentTimeline.length) {
		for (const segment of segmentTimeline) {
			if (!segment.text) continue
			const segmentNormalized = normalizeForSearchText(segment.text)
			if (segmentNormalized.includes(snippetSample)) {
				const start = segment.start
				if (start !== null) return start
			}
		}
	}

	if (durationSeconds && fullTranscript) {
		const transcriptNormalized = normalizeForSearchText(fullTranscript)
		const index = transcriptNormalized.indexOf(snippetSample)
		if (index >= 0) {
			const ratio = transcriptNormalized.length ? index / transcriptNormalized.length : 0
			const estimated = durationSeconds * ratio
			return Number.isFinite(estimated) ? Math.max(0, Math.min(durationSeconds, estimated)) : null
		}
	}

	return null
}

function appendTimeParamToUrl(url: string, seconds: number | null): string {
	if (!url || seconds === null || !Number.isFinite(seconds) || seconds < 0) return url
	const rounded = Math.round(seconds)
	const separator = url.includes("?") ? "&" : "?"
	return `${url}${separator}t=${rounded}`
}

function humanizeKey(value?: string | null): string | null {
	if (!value) return null
	const cleaned = value.replace(/[_-]+/g, " ").replace(/\s+/g, " ")
	const capitalized = cleaned.replace(/\b\w/g, (char) => char.toUpperCase()).trim()
	if (!capitalized.length) return null
	return capitalized
}

type FacetLookup = Map<string, Map<string, FacetCatalog["facets"][number]>>

function normalizeFacetValue(value: string | null | undefined): string | null {
	if (!value) return null
	const trimmed = value.trim().toLowerCase()
	if (!trimmed.length) return null
	return trimmed.replace(/\s+/g, " ")
}

function buildFacetLookup(catalog: FacetCatalog): FacetLookup {
	const lookup: FacetLookup = new Map()
	for (const facet of catalog.facets ?? []) {
		const rawKind = typeof facet.kind_slug === "string" ? facet.kind_slug.trim().toLowerCase() : ""
		if (!rawKind || !facet.facet_account_id) continue
		const byKind = lookup.get(rawKind) ?? new Map<string, FacetCatalog["facets"][number]>()
		if (!lookup.has(rawKind)) {
			lookup.set(rawKind, byKind)
		}
		const candidates = new Set<string>()
		const primary = normalizeFacetValue(facet.alias ?? facet.label)
		if (primary) candidates.add(primary)
		const label = normalizeFacetValue(facet.label)
		if (label) candidates.add(label)
		for (const synonym of facet.synonyms ?? []) {
			const normalized = normalizeFacetValue(synonym)
			if (normalized) candidates.add(normalized)
		}
		for (const candidate of candidates) {
			// Do not overwrite existing entries to preserve the first (usually alias) match
			if (!byKind.has(candidate)) {
				byKind.set(candidate, facet)
			}
		}
	}
	return lookup
}

function matchFacetFromLookup(
	lookup: FacetLookup,
	kindSlug: string,
	label: string
): FacetCatalog["facets"][number] | null {
	const normalized = normalizeFacetValue(label)
	if (!normalized) return null
	const canonicalKind = kindSlug.trim().toLowerCase()
	if (!canonicalKind) return null
	const kindMap = lookup.get(canonicalKind)
	if (!kindMap) return null
	return kindMap.get(normalized) ?? null
}

function sanitizeFacetLabel(label: string | null | undefined): string | null {
	if (typeof label !== "string") return null
	const trimmed = label.replace(/\s+/g, " ").trim()
	if (!trimmed.length) return null
	return trimmed.length > 240 ? trimmed.slice(0, 237).trimEnd() + "..." : trimmed
}

function normalizeForSearchText(value: string | null | undefined): string {
	if (!value || typeof value !== "string") return ""
	const replaced = value
		.replace(/[\u2018\u2019\u201B\u2032]/g, "'")
		.replace(/[\u201C\u201D\u2033]/g, '"')
		.replace(/\u00A0/g, " ")
	return replaced.replace(/\s+/g, " ").trim().toLowerCase()
}

function sanitizePersonKey(value: unknown, fallback: string): string {
	if (typeof value === "string") {
		const trimmed = value.trim()
		if (trimmed.length) return trimmed
	}
	return fallback
}

async function resolveFacetCatalog(
	db: SupabaseClient<Database>,
	accountId: string,
	projectId?: string | null
): Promise<FacetCatalog> {
	if (!projectId) {
		return {
			kinds: [],
			facets: [],
			version: `account:${accountId}:no-project`,
		}
	}
	try {
		return await getFacetCatalog({ db, accountId, projectId })
	} catch (error) {
		consola.warn("Failed to load facet catalog", error)
		return {
			kinds: [],
			facets: [],
			version: `account:${accountId}:project:${projectId}:fallback`,
		}
	}
}

function generateFallbackPersonName(metadata: InterviewMetadata): string {
	if (metadata.fileName) {
		const nameFromFile = metadata.fileName
			.replace(/\.[^/.]+$/, "")
			.replace(/[_-]/g, " ")
			.replace(/\b\w/g, (l) => l.toUpperCase())
			.trim()

		if (nameFromFile.length > 0) return nameFromFile
	}
	if (metadata.interviewTitle && !metadata.interviewTitle.includes("Interview -")) return metadata.interviewTitle
	const timestamp = new Date().toISOString().split("T")[0]
	return timestamp
}

type EvidenceFromBaml = Awaited<ReturnType<typeof b.ExtractEvidenceFromTranscriptV2>>
type PersonaSynthesisFromBaml = Awaited<ReturnType<typeof b.DerivePersonaFacetsFromEvidence>>

type EvidenceTurn = EvidenceFromBaml["evidence"][number]

interface NormalizedParticipant {
	person_key: string
	role: string | null
	display_name: string | null
	inferred_name: string | null
	organization: string | null
	summary: string | null
	segments: string[]
	personas: string[]
	facets: PersonFacetObservation[]
	scales: PersonScaleObservation[]
}

type NameResolutionSource = "display" | "inferred" | "metadata" | "person_key" | "fallback"

const GENERIC_PERSON_LABEL_PATTERNS: RegExp[] = [
	/^(participant|person|speaker|customer|interviewee|user|client|respondent|guest|attendee)(?:[\s_-]*(\d+|[a-z]))?$/i,
	/^(interviewer|moderator|facilitator)(?:[\s_-]*(\d+|[a-z]))?$/i,
	/^(participant|speaker)\s*(one|two|three|first|second|third)$/i,
]

function isGenericPersonLabel(label: string | null | undefined): boolean {
	if (!label) return false
	const normalized = label.trim().toLowerCase()
	if (!normalized.length) return false
	return GENERIC_PERSON_LABEL_PATTERNS.some((pattern) => pattern.test(normalized))
}

function generateParticipantHash(options: {
	accountId: string
	projectId?: string | null
	interviewId?: string | null
	personKey: string
	index: number
}): string {
	const { accountId, projectId, interviewId, personKey, index } = options
	const hashInput = [
		accountId || "unknown-account",
		projectId || "no-project",
		interviewId || "no-interview",
		personKey || "no-key",
		index.toString(),
	].join("|")
	return createHash("sha1").update(hashInput).digest("hex").slice(0, 10)
}

function appendHashToName(name: string, hash: string): string {
	const trimmed = name.trim()
	return trimmed.length ? `${trimmed} #${hash}` : hash
}

function shouldAttachHash(
	resolution: { name: string; source: NameResolutionSource },
	participant: NormalizedParticipant
): boolean {
	if (!resolution.name.trim()) return true
	if (resolution.source === "person_key" || resolution.source === "fallback") return true

	if (isGenericPersonLabel(resolution.name)) return true
	if (isGenericPersonLabel(participant.person_key)) return true
	if (isGenericPersonLabel(participant.display_name)) return true
	if (isGenericPersonLabel(participant.inferred_name)) return true

	return false
}

interface ExtractEvidenceOptions {
	db: SupabaseClient<Database>
	metadata: InterviewMetadata
	interviewRecord: Interview
	transcriptData: Record<string, unknown>
	language: string
	fullTranscript: string
}

interface ExtractEvidenceResult {
	personData: { id: string }
	primaryPersonName: string | null
	primaryPersonRole: string | null
	primaryPersonDescription: string | null
	primaryPersonOrganization: string | null
	primaryPersonSegments: string[]
	insertedEvidenceIds: string[]
	evidenceUnits: EvidenceFromBaml["evidence"]
	evidenceFacetKinds: string[][]
}

export async function extractEvidenceAndPeopleCore({
	db,
	metadata,
	interviewRecord,
	transcriptData,
	language,
	fullTranscript,
}: ExtractEvidenceOptions): Promise<ExtractEvidenceResult> {
	type RawChapter = {
		start_ms?: number
		end_ms?: number
		start?: number
		end?: number
		summary?: string
		gist?: string
		title?: string
	}

	let chapters: Array<{ start_ms: number; end_ms?: number; summary?: string; title?: string }> = []
	try {
		const rawChapters =
			((transcriptData as Record<string, unknown>).chapters as RawChapter[] | undefined) ||
			((transcriptData as Record<string, unknown>).segments as RawChapter[] | undefined) ||
			[]
		if (Array.isArray(rawChapters)) {
			chapters = rawChapters
				.map((c: RawChapter) => ({
					start_ms: typeof c.start_ms === "number" ? c.start_ms : typeof c.start === "number" ? c.start : 0,
					end_ms: typeof c.end_ms === "number" ? c.end_ms : typeof c.end === "number" ? c.end : undefined,
					summary: c.summary ?? c.gist ?? undefined,
					title: c.title ?? undefined,
				}))
				.filter((c) => typeof c.start_ms === "number")
		}
	} catch (chapterErr) {
		consola.warn("Failed to normalize chapters for evidence extraction", chapterErr)
	}

	let evidenceUnits: EvidenceFromBaml["evidence"] = []
	let insertedEvidenceIds: string[] = []
	const evidenceFacetKinds: string[][] = []
	const evidenceFacetRowsToInsert: Array<{
		account_id: string
		project_id: string | null
		evidence_index: number
		kind_slug: string
		facet_account_id: number
		label: string
		source: string
		confidence: number
		quote: string | null
	}> = []
	const facetMentionsByPersonKey = new Map<
		string,
		Array<{
			kindSlug: string
			label: string
			facetAccountId: number
			quote: string | null
			evidenceIndex: number
		}>
	>()
	const personKeyForEvidence: string[] = []
	const personRoleByKey = new Map<string, string | null>()
	const facetObservationsByPersonKey = new Map<string, PersonFacetObservation[]>()
	const facetObservationDedup = new Map<string, Set<string>>()

	const facetCatalog = await resolveFacetCatalog(db, metadata.accountId, metadata.projectId)
	const facetLookup = buildFacetLookup(facetCatalog)
	const facetResolver = new FacetResolver(db, metadata.accountId)
	const langfuse = getLangfuseClient()
	const lfTrace = (langfuse as any).trace?.({
		name: "baml.extract-evidence",
		metadata: {
			accountId: metadata.accountId,
			projectId: metadata.projectId ?? null,
			interviewId: interviewRecord.id ?? null,
		},
	})
	const transcriptPreviewLength = 1200
	const transcriptPreview =
		fullTranscript.length > transcriptPreviewLength
			? `${fullTranscript.slice(0, transcriptPreviewLength)}...`
			: fullTranscript
	consola.info(`📊 Extracting evidence with ${chapters.length} chapters`, {
		chapterSample: chapters.slice(0, 3),
		transcriptLength: fullTranscript.length,
	})

	const lfGeneration = lfTrace?.generation?.({
		name: "baml.ExtractEvidenceFromTranscriptV2",
		input: {
			language,
			transcriptLength: fullTranscript.length,
			transcriptPreview,
			chapterCount: chapters.length,
			facetCatalogVersion: facetCatalog.version,
		},
	})
	const collector = createBamlCollector("extract-evidence")
	const promptCostPer1K = Number(process.env.BAML_EXTRACT_EVIDENCE_PROMPT_COST_PER_1K_TOKENS)
	const completionCostPer1K = Number(process.env.BAML_EXTRACT_EVIDENCE_COMPLETION_COST_PER_1K_TOKENS)
	const costOptions = {
		promptCostPer1KTokens: Number.isFinite(promptCostPer1K) ? promptCostPer1K : undefined,
		completionCostPer1KTokens: Number.isFinite(completionCostPer1K) ? completionCostPer1K : undefined,
	}
	const instrumentedClient = b.withOptions({ collector })
	let evidenceResponse: EvidenceFromBaml | undefined
	let usageSummary: ReturnType<typeof summarizeCollectorUsage> | null = null
	let langfuseUsage: ReturnType<typeof mapUsageToLangfuse> | undefined
	let generationEnded = false
	try {
		// Keep passing the merged facet catalog so the model can ground mentions against the project taxonomy.
		// Dropping this trims the prompt slightly but increases the odds that facet references drift from known labels.

		// Get speaker transcripts from sanitized data
		const speakerTranscriptsRaw = (transcriptData as any).speaker_transcripts ?? []
		const speakerTranscripts = Array.isArray(speakerTranscriptsRaw)
			? speakerTranscriptsRaw.map((u: any) => ({
					speaker: u.speaker ?? "",
					text: u.text ?? "",
					start: u.start ?? null,
					end: u.end ?? null,
				}))
			: []

		consola.info(`📝 Passing ${speakerTranscripts.length} speaker utterances with timing to AI`)

		evidenceResponse = await instrumentedClient.ExtractEvidenceFromTranscriptV2(
			speakerTranscripts,
			chapters,
			language,
			facetCatalog
		)
		usageSummary = summarizeCollectorUsage(collector, costOptions)
		if (usageSummary) {
			consola.log("[BAML usage] ExtractEvidenceFromTranscriptV2:", usageSummary)
		}
		langfuseUsage = mapUsageToLangfuse(usageSummary)

		// Log evidence response summary
		const evidenceCount = evidenceResponse?.evidence?.length ?? 0
		const totalFacetMentions =
			evidenceResponse?.evidence?.reduce((sum, ev) => {
				const mentions = (ev as any)?.facet_mentions
				return sum + (Array.isArray(mentions) ? mentions.length : 0)
			}, 0) ?? 0
		consola.info(`🔍 BAML returned ${evidenceCount} evidence units with ${totalFacetMentions} total facet mentions`)

		lfGeneration?.update?.({
			output: evidenceResponse,
			usage: langfuseUsage,
			metadata: usageSummary ? { tokenUsage: usageSummary } : undefined,
		})
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		lfGeneration?.end?.({
			level: "ERROR",
			statusMessage: message,
			usage: langfuseUsage,
			metadata: usageSummary ? { tokenUsage: usageSummary } : undefined,
		})
		generationEnded = true
		throw error
	} finally {
		if (!generationEnded) {
			lfGeneration?.end?.({
				usage: langfuseUsage,
				metadata: usageSummary ? { tokenUsage: usageSummary } : undefined,
			})
		}
		;(lfTrace as any)?.end?.()
	}

	if (!evidenceResponse) {
		return {
			personData: { id: await ensureFallbackPerson(db, metadata, interviewRecord) },
			primaryPersonName: null,
			primaryPersonRole: null,
			primaryPersonDescription: null,
			primaryPersonOrganization: null,
			primaryPersonSegments: [],
			insertedEvidenceIds,
			evidenceUnits,
			evidenceFacetKinds,
		}
	}

	consola.log("🔍 Raw BAML evidence response:", JSON.stringify(evidenceResponse, null, 2))
	evidenceUnits = Array.isArray(evidenceResponse?.evidence) ? evidenceResponse.evidence : []
	const scenes = Array.isArray(evidenceResponse?.scenes) ? evidenceResponse.scenes : []

	// ═══════════════════════════════════════════════════════════════
	// Phase 2: Derive Persona Facets from Evidence
	// ═══════════════════════════════════════════════════════════════
	let personaSynthesis: PersonaSynthesisFromBaml | null = null
	const personaFacetsByPersonKey = new Map<string, PersonaSynthesisFromBaml["persona_facets"]>()

	try {
		consola.log("🧠 Running Phase 2: Persona synthesis from evidence...")
		const synthesisCollector = createBamlCollector("persona-synthesis")
		const synthesisClient = b.withOptions({ collector: synthesisCollector })

		const lfSynthesisGeneration = lfTrace?.generation?.({
			name: "baml.DerivePersonaFacetsFromEvidence",
			input: {
				evidenceCount: evidenceUnits.length,
				peopleCount: evidenceResponse?.people?.length ?? 0,
			},
		})

		personaSynthesis = await synthesisClient.DerivePersonaFacetsFromEvidence(evidenceResponse)

		const synthesisUsage = summarizeCollectorUsage(synthesisCollector, costOptions)
		if (synthesisUsage) {
			consola.log("[BAML usage] DerivePersonaFacetsFromEvidence:", synthesisUsage)
		}
		const synthesisLangfuseUsage = mapUsageToLangfuse(synthesisUsage)

		lfSynthesisGeneration?.end?.({
			output: personaSynthesis,
			usage: synthesisLangfuseUsage,
			metadata: synthesisUsage ? { tokenUsage: synthesisUsage } : undefined,
		})

		// Group persona facets by person_key for efficient lookup
		if (personaSynthesis?.persona_facets) {
			for (const facet of personaSynthesis.persona_facets) {
				if (!facet.person_key) continue
				const facets = personaFacetsByPersonKey.get(facet.person_key) ?? []
				if (!personaFacetsByPersonKey.has(facet.person_key)) {
					personaFacetsByPersonKey.set(facet.person_key, facets)
				}
				facets.push(facet)
			}
			consola.log(
				`✅ Phase 2 complete: Synthesized ${personaSynthesis.persona_facets.length} persona facets for ${personaFacetsByPersonKey.size} people`
			)
		}
	} catch (synthesisError) {
		consola.warn("⚠️  Phase 2 persona synthesis failed; falling back to Phase 1 raw mentions", synthesisError)
		// Continue with raw mentions if synthesis fails
	}

	const rawPeople = Array.isArray((evidenceResponse as { people?: EvidenceParticipant[] })?.people)
		? (((evidenceResponse as { people?: EvidenceParticipant[] }).people ?? []) as EvidenceParticipant[])
		: []
	consola.info(`📋 Phase 1 extracted ${rawPeople.length} people from transcript`)
	const participants: NormalizedParticipant[] = []
	const participantByKey = new Map<string, NormalizedParticipant>()

	const coerceString = (value: unknown): string | null => {
		if (typeof value === "string") {
			const trimmed = value.trim()
			return trimmed.length ? trimmed : null
		}
		return null
	}

	for (let i = 0; i < rawPeople.length; i++) {
		const raw = rawPeople[i] ?? ({} as EvidenceParticipant)
		let person_key = sanitizePersonKey((raw as EvidenceParticipant).person_key, `person-${i}`)
		if (participantByKey.has(person_key)) {
			person_key = `${person_key}-${i}`
		}
		const role = coerceString((raw as EvidenceParticipant).role)
		const display_name = coerceString((raw as EvidenceParticipant).display_name)
		const inferred_name = coerceString((raw as EvidenceParticipant).inferred_name)
		const organization = coerceString((raw as EvidenceParticipant).organization)
		const summary = coerceString((raw as EvidenceParticipant).summary)
		const segments = Array.isArray((raw as EvidenceParticipant).segments)
			? ((raw as EvidenceParticipant).segments as unknown[])
					.map((segment) => coerceString(segment))
					.filter((segment): segment is string => Boolean(segment))
			: []
		const personas = Array.isArray((raw as EvidenceParticipant).personas)
			? ((raw as EvidenceParticipant).personas as unknown[])
					.map((persona) => coerceString(persona))
					.filter((persona): persona is string => Boolean(persona))
			: []
		const facets = Array.isArray((raw as EvidenceParticipant).facets)
			? ((raw as EvidenceParticipant).facets as unknown[])
					.map((facet) => {
						if (!facet || typeof facet !== "object") return null
						const kind_slug = coerceString((facet as PersonFacetObservation).kind_slug)
						const value = coerceString((facet as PersonFacetObservation).value)
						if (!kind_slug || !value) return null
						return {
							...facet,
							kind_slug,
							value,
							source: (facet as PersonFacetObservation).source || "interview",
						} as PersonFacetObservation
					})
					.filter((facet): facet is PersonFacetObservation => Boolean(facet))
			: []
		const scales = Array.isArray((raw as EvidenceParticipant).scales)
			? ((raw as EvidenceParticipant).scales as unknown[])
					.map((scale) => {
						if (!scale || typeof scale !== "object") return null
						const kind_slug = coerceString((scale as PersonScaleObservation).kind_slug)
						const score = (scale as PersonScaleObservation).score
						if (!kind_slug || typeof score !== "number" || Number.isNaN(score)) return null
						return {
							...scale,
							kind_slug,
							score,
							source: (scale as PersonScaleObservation).source || "interview",
						} as PersonScaleObservation
					})
					.filter((scale): scale is PersonScaleObservation => Boolean(scale))
			: []

		const normalized: NormalizedParticipant = {
			person_key,
			role,
			display_name,
			inferred_name,
			organization,
			summary,
			segments,
			personas,
			facets,
			scales,
		}
		participants.push(normalized)
		participantByKey.set(person_key, normalized)
		personRoleByKey.set(person_key, role ?? null)
	}

	if (!participants.length) {
		const fallbackKey = "person-0"
		const fallbackName = metadata.participantName?.trim() || generateFallbackPersonName(metadata)
		const fallbackParticipant: NormalizedParticipant = {
			person_key: fallbackKey,
			role: null,
			display_name: fallbackName,
			inferred_name: fallbackName,
			organization: null,
			summary: null,
			segments: metadata.segment ? [metadata.segment] : [],
			personas: [],
			facets: [],
			scales: [],
		}
		participants.push(fallbackParticipant)
		participantByKey.set(fallbackKey, fallbackParticipant)
		personRoleByKey.set(fallbackKey, null)
	}

	const primaryParticipant =
		participants.find((participant) => {
			const roleLower = participant.role?.toLowerCase()
			return roleLower ? roleLower !== "interviewer" : false
		}) ??
		participants[0] ??
		null

	const primaryPersonKey = primaryParticipant?.person_key ?? participants[0]?.person_key ?? "person-0"

	for (const participant of participants) {
		if (participant.facets.length) {
			const observationList = facetObservationsByPersonKey.get(participant.person_key) ?? []
			const dedupeSet = facetObservationDedup.get(participant.person_key) ?? new Set<string>()
			if (!facetObservationsByPersonKey.has(participant.person_key)) {
				facetObservationsByPersonKey.set(participant.person_key, observationList)
				facetObservationDedup.set(participant.person_key, dedupeSet)
			}
			for (const facet of participant.facets) {
				const dedupeKey = `${facet.kind_slug.toLowerCase()}|${facet.value.toLowerCase()}|${facet.evidence_unit_index ?? -1}`
				if (dedupeSet.has(dedupeKey)) continue
				dedupeSet.add(dedupeKey)
				observationList.push(facet)
			}
		}
	}

	if (!evidenceUnits.length) {
		return {
			personData: { id: await ensureFallbackPerson(db, metadata, interviewRecord) },
			primaryPersonName: null,
			primaryPersonRole: null,
			primaryPersonDescription: null,
			primaryPersonOrganization: null,
			primaryPersonSegments: [],
			insertedEvidenceIds,
			evidenceUnits,
			evidenceFacetKinds,
		}
	}

	const sceneTopicByIndex = new Map<number, string>()
	for (const scene of scenes ?? []) {
		const startIndex =
			typeof (scene as { start_index?: number }).start_index === "number" ? (scene as any).start_index : null
		const endIndex = typeof (scene as { end_index?: number }).end_index === "number" ? (scene as any).end_index : null
		const topicRaw = typeof (scene as { topic?: string }).topic === "string" ? (scene as any).topic : null
		if (startIndex === null || startIndex === undefined || topicRaw === null) continue
		const topic = sanitizeVerbatim(topicRaw) ?? null
		const end = endIndex !== null && endIndex !== undefined ? endIndex : startIndex
		for (let idx = startIndex; idx <= end; idx++) {
			if (topic) sceneTopicByIndex.set(idx, topic)
		}
	}

	const empathyStats = { says: 0, does: 0, thinks: 0, feels: 0, pains: 0, gains: 0 }
	const empathySamples: Record<keyof typeof empathyStats, string[]> = {
		says: [],
		does: [],
		thinks: [],
		feels: [],
		pains: [],
		gains: [],
	}

	const evidenceRows: EvidenceInsert[] = []
	const interviewMediaUrl = typeof interviewRecord.media_url === "string" ? interviewRecord.media_url : null
	const durationSeconds =
		typeof (transcriptData as { audio_duration?: unknown }).audio_duration === "number"
			? (transcriptData as { audio_duration?: number }).audio_duration
			: typeof interviewRecord.duration_sec === "number"
				? interviewRecord.duration_sec
				: null
	const wordTimeline = buildWordTimeline(transcriptData)
	const segmentTimeline = buildSegmentTimeline(transcriptData)
	for (let idx = 0; idx < evidenceUnits.length; idx++) {
		const ev = evidenceUnits[idx] as EvidenceTurn
		const rawPersonKey = coerceString((ev as { person_key?: string }).person_key)
		const fallbackPersonKey = primaryPersonKey || participants[0]?.person_key || "person-0"
		const personKey = rawPersonKey && participantByKey.has(rawPersonKey) ? rawPersonKey : fallbackPersonKey
		const verb = sanitizeVerbatim(ev?.verbatim)
		if (!verb) continue
		const chunk = sanitizeVerbatim(ev?.chunk) ?? verb
		const gist = sanitizeVerbatim(ev?.gist) ?? verb
		const evidenceIndex = typeof ev?.index === "number" ? ev.index : idx
		const sceneTopic = sceneTopicByIndex.get(evidenceIndex) ?? null
		const facetMentions = Array.isArray((ev as { facet_mentions?: FacetMention[] }).facet_mentions)
			? ((ev as { facet_mentions?: FacetMention[] }).facet_mentions as FacetMention[])
			: []

		if (facetMentions.length > 0) {
			consola.info(`Evidence ${evidenceIndex} has ${facetMentions.length} facet mentions`)
		}

		const kindSlugSet = new Set<string>()
		const mentionDedup = new Set<number>()
		const projectIdForInsert = metadata.projectId ?? null

		for (const mention of facetMentions) {
			if (!mention || typeof mention !== "object") continue
			const kindRaw = typeof mention.kind_slug === "string" ? mention.kind_slug.trim().toLowerCase() : ""
			const labelRaw = sanitizeFacetLabel((mention as FacetMention).value)
			if (!kindRaw || !labelRaw) continue
			const resolvedLabel = sanitizeFacetLabel(labelRaw)
			if (!resolvedLabel) continue

			const matchedFacet = matchFacetFromLookup(facetLookup, kindRaw, resolvedLabel)
			const synonyms = Array.isArray(matchedFacet?.synonyms) ? (matchedFacet?.synonyms ?? []) : []
			let facetAccountId: number | null = matchedFacet?.facet_account_id ?? null

			// If no match found in catalog, create new facet
			if (!facetAccountId) {
				facetAccountId = await facetResolver.ensureFacet({
					kindSlug: kindRaw,
					label: resolvedLabel,
					synonyms,
				})
			}

			if (!facetAccountId) continue
			if (mentionDedup.has(facetAccountId)) continue
			mentionDedup.add(facetAccountId)
			kindSlugSet.add(kindRaw)
			const mentionQuote = sanitizeFacetLabel((mention as FacetMention).quote ?? null)

			// Build evidence_facet row directly
			evidenceFacetRowsToInsert.push({
				account_id: metadata.accountId,
				project_id: projectIdForInsert,
				evidence_index: idx,
				kind_slug: kindRaw,
				facet_account_id: facetAccountId,
				label: resolvedLabel,
				source: "interview",
				confidence: 0.8,
				quote: mentionQuote,
			})
		}

		const kindSlugs = Array.from(kindSlugSet)
		evidenceFacetKinds.push(kindSlugs)

		// Track facets by person for persona synthesis
		if (kindSlugSet.size > 0) {
			const byPerson = facetMentionsByPersonKey.get(personKey) ?? []
			if (!facetMentionsByPersonKey.has(personKey)) {
				facetMentionsByPersonKey.set(personKey, byPerson)
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
					})
				}
			}
		}
		const confidenceStr = (ev as { confidence?: EvidenceInsert["confidence"] }).confidence ?? "medium"
		const weight_quality = confidenceStr === "high" ? 0.95 : confidenceStr === "low" ? 0.6 : 0.8
		const weight_relevance = confidenceStr === "high" ? 0.9 : confidenceStr === "low" ? 0.6 : 0.8
		const independence_key = computeIndependenceKey(gist ?? verb, kindSlugs)
		const rawAnchors =
			ev && typeof (ev as any).anchors === "object" && (ev as any).anchors !== null
				? [((ev as any).anchors ?? {}) as Record<string, any>]
				: []

		// Try to get timing from AI-provided anchors first
		let anchorSeconds: number | null = null
		if (rawAnchors.length > 0 && rawAnchors[0]) {
			const firstAnchor = rawAnchors[0]
			if (typeof firstAnchor.start_ms === "number") {
				anchorSeconds = firstAnchor.start_ms / 1000
				consola.info(`Evidence ${evidenceIndex}: Using AI-provided timing ${firstAnchor.start_ms}ms`)
			} else if (typeof firstAnchor.start_seconds === "number") {
				anchorSeconds = firstAnchor.start_seconds
				consola.info(`Evidence ${evidenceIndex}: Using AI-provided timing ${firstAnchor.start_seconds}s`)
			} else {
				consola.warn(`Evidence ${evidenceIndex}: No timing in anchors`, firstAnchor)
			}
		}

		// Fall back to text search if AI didn't provide timing
		if (anchorSeconds === null) {
			const snippetForTiming = chunk || gist || verb
			anchorSeconds = snippetForTiming?.length
				? findStartSecondsForSnippet({
						snippet: snippetForTiming,
						wordTimeline,
						segmentTimeline,
						fullTranscript,
						durationSeconds,
					})
				: null
		}
		const sanitizedAnchors = rawAnchors
			.map((anchor) => {
				if (!anchor || typeof anchor !== "object") return null

				const result: Record<string, any> = {}

				// Store timing data
				if (anchorSeconds !== null) {
					result.start_ms = Math.round(anchorSeconds * 1000)
				}
				if (anchor.end_ms !== undefined) {
					result.end_ms = anchor.end_ms
				}

				// Store R2 key (stable identifier) instead of signed URL
				if (interviewRecord.media_url) {
					result.media_key = getR2KeyFromPublicUrl(interviewRecord.media_url)
				}

				// Preserve optional metadata
				if (anchor.chapter_title) {
					result.chapter_title = anchor.chapter_title
				}
				if (anchor.char_span) {
					result.char_span = anchor.char_span
				}

				return result
			})
			.filter((anchor): anchor is Record<string, any> => Boolean(anchor))

		// Create default anchor if none exist
		if (sanitizedAnchors.length === 0 && interviewRecord.media_url && anchorSeconds !== null) {
			sanitizedAnchors.push({
				start_ms: Math.round(anchorSeconds * 1000),
				media_key: getR2KeyFromPublicUrl(interviewRecord.media_url),
			})
		}
		const row: EvidenceInsert = {
			account_id: metadata.accountId,
			project_id: metadata.projectId,
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
		}

		const _says = Array.isArray(ev?.says) ? (ev.says as string[]) : []
		const _does = Array.isArray(ev?.does) ? (ev.does as string[]) : []
		const _thinks = Array.isArray(ev?.thinks) ? (ev.thinks as string[]) : []
		const _feels = Array.isArray(ev?.feels) ? (ev.feels as string[]) : []
		const _pains = Array.isArray(ev?.pains) ? (ev.pains as string[]) : []
		const _gains = Array.isArray(ev?.gains) ? (ev.gains as string[]) : []
		;(row as Record<string, unknown>).says = _says
		;(row as Record<string, unknown>).does = _does
		;(row as Record<string, unknown>).thinks = _thinks
		;(row as Record<string, unknown>).feels = _feels
		;(row as Record<string, unknown>).pains = _pains
		;(row as Record<string, unknown>).gains = _gains

		empathyStats.says += _says.length
		empathyStats.does += _does.length
		empathyStats.thinks += _thinks.length
		empathyStats.feels += _feels.length
		empathyStats.pains += _pains.length
		empathyStats.gains += _gains.length
		for (const [k, arr] of Object.entries({
			says: _says,
			does: _does,
			thinks: _thinks,
			feels: _feels,
			pains: _pains,
			gains: _gains,
		}) as Array<[keyof typeof empathyStats, string[]]>) {
			for (const v of arr) {
				if (typeof v === "string" && v.trim() && empathySamples[k].length < 3) empathySamples[k].push(v.trim())
			}
		}

		const whyItMatters = sanitizeVerbatim((ev as { why_it_matters?: string }).why_it_matters)
		if (whyItMatters) {
			;(row as Record<string, unknown>).context_summary = whyItMatters
		}

		// Skip raw mention processing - we'll use Phase 2 persona facets instead
		// This prevents over-extraction of interview content as personal traits

		evidenceRows.push(row)
		personKeyForEvidence.push(personKey)
	}

	if (!evidenceRows.length) {
		return {
			personData: { id: await ensureFallbackPerson(db, metadata, interviewRecord) },
			primaryPersonName: null,
			primaryPersonRole: null,
			primaryPersonDescription: null,
			primaryPersonOrganization: null,
			primaryPersonSegments: [],
			insertedEvidenceIds,
			evidenceUnits,
			evidenceFacetKinds,
		}
	}

	await db.from("evidence").delete().eq("interview_id", interviewRecord.id)

	const { data: insertedEvidence, error: evidenceInsertError } = await db
		.from("evidence")
		.insert(evidenceRows)
		.select("id")
	if (evidenceInsertError) throw new Error(`Failed to insert evidence: ${evidenceInsertError.message}`)
	insertedEvidenceIds = (insertedEvidence ?? []).map((e) => e.id)

	consola.info(
		`📋 Evidence insertion complete: ${insertedEvidenceIds.length} evidence rows, ${evidenceFacetRowsToInsert.length} facet rows to insert`
	)

	// Map evidence_index to evidence_id and insert facets
	if (insertedEvidenceIds.length && evidenceFacetRowsToInsert.length) {
		try {
			await db.from("evidence_facet").delete().in("evidence_id", insertedEvidenceIds)
		} catch (cleanupErr) {
			consola.warn("Failed to clear existing evidence_facet rows", cleanupErr)
		}

		// Map evidence_index to evidence_id
		const finalFacetRows = evidenceFacetRowsToInsert.map((row) => {
			const { evidence_index, ...rest } = row
			return {
				...rest,
				evidence_id: insertedEvidenceIds[evidence_index],
			}
		})

		if (finalFacetRows.length) {
			consola.info(`Attempting to insert ${finalFacetRows.length} evidence_facet rows`)
			const { error: facetInsertError } = await db.from("evidence_facet").insert(finalFacetRows)
			if (facetInsertError) {
				consola.error("Failed to insert evidence_facet rows", {
					error: facetInsertError.message,
					code: facetInsertError.code,
					details: facetInsertError.details,
					hint: facetInsertError.hint,
					sampleRow: finalFacetRows[0],
				})
			} else {
				consola.success(`Successfully inserted ${finalFacetRows.length} evidence_facet rows`)
			}
		}
	}

	const personIdByKey = new Map<string, string>()
	const personNameByKey = new Map<string, string>()
	const keyByPersonId = new Map<string, string>()
	const displayNameByKey = new Map<string, string>()
	const personRoleById = new Map<string, string | null>()

	if (metadata.projectId) {
		const { data: existingInterviewPeople } = await db
			.from("interview_people")
			.select("person_id, transcript_key, display_name, role")
			.eq("interview_id", interviewRecord.id)
		if (Array.isArray(existingInterviewPeople)) {
			existingInterviewPeople.forEach((row) => {
				if (row.transcript_key && row.person_id) {
					personIdByKey.set(row.transcript_key, row.person_id)
					keyByPersonId.set(row.person_id, row.transcript_key)
				}
				if (row.display_name && row.transcript_key) {
					displayNameByKey.set(row.transcript_key, row.display_name)
				}
				if (row.person_id && row.role) {
					personRoleById.set(row.person_id, row.role)
				}
			})
		}
	}

	const resolveName = (
		participant: NormalizedParticipant,
		index: number
	): { name: string; source: NameResolutionSource } => {
		const candidates: Array<{ value: string | null | undefined; source: NameResolutionSource }> = [
			{ value: participant.display_name, source: "display" },
			{ value: participant.inferred_name, source: "inferred" },
			{ value: participant.person_key ? humanizeKey(participant.person_key) : null, source: "person_key" },
			{ value: metadata.participantName, source: "metadata" },
			{ value: metadata.interviewerName, source: "metadata" },
		]
		for (const candidate of candidates) {
			if (typeof candidate.value === "string") {
				const trimmed = candidate.value.trim()
				if (trimmed.length) {
					return { name: trimmed, source: candidate.source }
				}
			}
		}
		return { name: `Participant ${index + 1}`, source: "fallback" }
	}

	const upsertPerson = async (
		name: string,
		overrides: Partial<PeopleInsert> = {}
	): Promise<{ id: string; name: string }> => {
		const payload: PeopleInsert = {
			account_id: metadata.accountId,
			project_id: metadata.projectId,
			name: name.trim(),
			description: overrides.description ?? null,
			segment: overrides.segment ?? metadata.segment ?? null,
			contact_info: overrides.contact_info ?? null,
			company: overrides.company ?? null,
			role: overrides.role ?? null,
		}
		const { data: upserted, error: upsertErr } = await db
			.from("people")
			.upsert(payload, { onConflict: "account_id,name_hash" })
			.select("id, name")
			.single()
		if (upsertErr) throw new Error(`Failed to upsert person ${name}: ${upsertErr.message}`)
		if (!upserted?.id) throw new Error(`Person upsert returned no id for ${name}`)
		return { id: upserted.id, name: upserted.name ?? name.trim() }
	}

	let primaryPersonId: string | null = null
	let primaryPersonName: string | null = null
	let primaryPersonRole: string | null = null
	let primaryPersonDescription: string | null = null
	let primaryPersonOrganization: string | null = null
	let primaryPersonSegments: string[] = []

	consola.info(`👥 Processing ${participants.length} participants for person records`)
	if (participants.length) {
		for (const [index, participant] of participants.entries()) {
			const participantKey = participant.person_key
			consola.debug(`  - Creating person record for "${participantKey}" (role: ${participant.role})`)
			const resolved = resolveName(participant, index)
			const segments = participant.segments.length ? participant.segments : metadata.segment ? [metadata.segment] : []
			const participantOverrides: Partial<PeopleInsert> = {
				description: participant.summary ?? null,
				segment: segments[0] || metadata.segment || null,
				company: participant.organization ?? null,
				role: participant.role ?? null,
			}
			const needsHash = shouldAttachHash(resolved, participant)
			const personNameForDb = needsHash
				? appendHashToName(
						resolved.name,
						generateParticipantHash({
							accountId: metadata.accountId,
							projectId: metadata.projectId,
							interviewId: interviewRecord.id,
							personKey: participantKey,
							index,
						})
					)
				: resolved.name
			const personRecord = await upsertPerson(personNameForDb, participantOverrides)
			personIdByKey.set(participantKey, personRecord.id)
			personNameByKey.set(participantKey, personRecord.name)
			keyByPersonId.set(personRecord.id, participantKey)
			const preferredDisplayName =
				participant.display_name?.trim() || (needsHash ? resolved.name : personRecord.name) || null
			if (preferredDisplayName) {
				displayNameByKey.set(participantKey, preferredDisplayName)
			}
			personRoleById.set(personRecord.id, participant.role ?? null)

			if (!primaryPersonId && participant.person_key === primaryPersonKey) {
				primaryPersonId = personRecord.id
				primaryPersonName = personRecord.name
				primaryPersonRole = participant.role ?? null
				primaryPersonDescription = participantOverrides.description ?? null
				primaryPersonOrganization = participantOverrides.company ?? null
				primaryPersonSegments = segments.length ? segments : metadata.segment ? [metadata.segment] : []
			}
		}
	}

	if (!primaryPersonId && participants.length) {
		const fallbackKey = participants[0].person_key
		const fallbackId = personIdByKey.get(fallbackKey) ?? null
		if (fallbackId) {
			primaryPersonId = fallbackId
			primaryPersonName = personNameByKey.get(fallbackKey) ?? resolveName(participants[0], 0).name
			primaryPersonRole = participants[0].role ?? null
			primaryPersonDescription = participants[0].summary ?? null
			primaryPersonOrganization = participants[0].organization ?? null
			primaryPersonSegments = participants[0].segments.length
				? participants[0].segments
				: metadata.segment
					? [metadata.segment]
					: []
		}
	}

	if (!primaryPersonId) {
		const fallback = await upsertPerson(generateFallbackPersonName(metadata))
		primaryPersonId = fallback.id
		primaryPersonName = fallback.name
		primaryPersonSegments = metadata.segment ? [metadata.segment] : []
		primaryPersonRole = primaryPersonRole ?? null
		primaryPersonDescription = primaryPersonDescription ?? null
		primaryPersonOrganization = primaryPersonOrganization ?? null
	}

	if (!primaryPersonId) throw new Error("Failed to resolve primary person for interview")

	if (!personRoleById.has(primaryPersonId) || primaryPersonRole !== null) {
		personRoleById.set(primaryPersonId, primaryPersonRole ?? null)
	}

	const ensuredPersonIds = new Set<string>([primaryPersonId])
	for (const id of personIdByKey.values()) ensuredPersonIds.add(id)
	for (const personId of ensuredPersonIds) {
		const role = personRoleById.get(personId) ?? null
		const linkPayload: InterviewPeopleInsert = {
			interview_id: interviewRecord.id,
			person_id: personId,
			project_id: metadata.projectId ?? null,
			role,
			transcript_key: keyByPersonId.get(personId) ?? null,
			display_name: keyByPersonId.get(personId) ? (displayNameByKey.get(keyByPersonId.get(personId)!) ?? null) : null,
		}
		const { error: linkErr } = await db
			.from("interview_people")
			.upsert(linkPayload, { onConflict: "interview_id,person_id" })
		if (linkErr && !linkErr.message?.includes("duplicate")) {
			consola.warn(`Failed linking person ${personId} to interview ${interviewRecord.id}`, linkErr.message)
		}
	}

	if (insertedEvidenceIds.length) {
		for (let idx = 0; idx < insertedEvidenceIds.length; idx++) {
			const evId = insertedEvidenceIds[idx]
			const key = personKeyForEvidence[idx]
			const targetPersonId = (key && personIdByKey.get(key)) || primaryPersonId
			if (!targetPersonId) continue
			const role = targetPersonId ? personRoleById.get(targetPersonId) : null
			const { error: epErr } = await db.from("evidence_people").insert({
				evidence_id: evId,
				person_id: targetPersonId,
				account_id: metadata.accountId,
				project_id: metadata.projectId,
				role: role || "speaker",
			})
			if (epErr && !epErr.message?.includes("duplicate")) {
				consola.warn(`Failed linking evidence ${evId} to person ${targetPersonId}: ${epErr.message}`)
			}
		}
	}

	if (metadata.projectId) {
		// Use Phase 2 synthesized persona facets instead of raw Phase 1 mentions
		const observationInputs: Array<{
			personId: string
			facets: PersonFacetObservation[]
			scales: PersonScaleObservation[]
		}> = []

		const allPersonKeys = new Set<string>([
			...personaFacetsByPersonKey.keys(),
			...participantByKey.keys(),
			...facetMentionsByPersonKey.keys(),
		])

		consola.info(`🎯 Processing facets for ${allPersonKeys.size} person_keys`)
		consola.debug("  - personaFacetsByPersonKey has keys:", Array.from(personaFacetsByPersonKey.keys()))
		consola.debug("  - participantByKey has keys:", Array.from(participantByKey.keys()))
		consola.debug("  - personIdByKey has keys:", Array.from(personIdByKey.keys()))

		for (const personKey of allPersonKeys) {
			const personId = personIdByKey.get(personKey)
			if (!personId) {
				consola.warn(`⚠️  Skipping facets for person_key "${personKey}" - no matching person record found`)
				consola.debug("Available person_keys in personIdByKey:", Array.from(personIdByKey.keys()))
				continue
			}

			const facetObservations: PersonFacetObservation[] = []
			const personaFacets = personaFacetsByPersonKey.get(personKey) ?? []
			for (const pf of personaFacets) {
				if (!pf.kind_slug || !pf.value) continue
				const evidenceIndices = Array.isArray(pf.evidence_refs) ? pf.evidence_refs : []
				const primaryEvidenceIndex = evidenceIndices[0] ?? undefined

				const facetObservation: PersonFacetObservation = {
					kind_slug: pf.kind_slug,
					value: pf.value,
					source: "interview",
					evidence_unit_index: primaryEvidenceIndex,
					confidence: typeof pf.confidence === "number" ? pf.confidence : 0.8,
					notes: pf.reasoning ? [pf.reasoning] : undefined,
					facet_account_id: pf.facet_account_id ?? undefined,
				}
				if (!pf.facet_account_id) {
					facetObservation.candidate = {
						kind_slug: pf.kind_slug,
						label: pf.value,
						synonyms: [],
						notes: pf.reasoning
							? [`Frequency: ${pf.frequency ?? 1}, Evidence refs: ${evidenceIndices.join(", ")}`]
							: undefined,
					}
				}
				facetObservations.push(facetObservation)
			}

			// Fallback: derive facets from direct evidence mentions when synthesis is sparse
			const existingFacetAccountIds = new Set<number>()
			const existingKindValueKeys = new Set<string>()
			for (const obs of facetObservations) {
				if (obs.facet_account_id) {
					existingFacetAccountIds.add(obs.facet_account_id)
				}
				if (obs.value) {
					existingKindValueKeys.add(`${obs.kind_slug.toLowerCase()}|${obs.value.toLowerCase()}`)
				}
			}
			const mentionFallback = facetMentionsByPersonKey.get(personKey) ?? []
			for (const mention of mentionFallback) {
				if (existingFacetAccountIds.has(mention.facetAccountId)) continue
				const key = `${mention.kindSlug.toLowerCase()}|${mention.label.toLowerCase()}`
				if (existingKindValueKeys.has(key)) continue
				existingFacetAccountIds.add(mention.facetAccountId)
				existingKindValueKeys.add(key)
				facetObservations.push({
					kind_slug: mention.kindSlug,
					value: mention.label,
					source: "interview",
					evidence_unit_index: mention.evidenceIndex,
					confidence: 0.6,
					facet_account_id: mention.facetAccountId,
					notes: mention.quote ? [mention.quote] : undefined,
				})
			}
			const scaleObservations = participantByKey.get(personKey)?.scales ?? []
			if (facetObservations.length || scaleObservations.length) {
				observationInputs.push({
					personId,
					facets: facetObservations,
					scales: scaleObservations,
				})
			}
		}

		if (observationInputs.length) {
			await persistFacetObservations({
				db,
				accountId: metadata.accountId,
				projectId: metadata.projectId,
				observations: observationInputs,
				evidenceIds: insertedEvidenceIds,
			})
		}
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
	}
}

export async function analyzeThemesAndPersonaCore({
	db,
	metadata,
	interviewRecord,
	fullTranscript,
	userCustomInstructions,
	evidenceResult,
}: {
	db: SupabaseClient<Database>
	metadata: InterviewMetadata
	interviewRecord: Interview
	fullTranscript: string
	userCustomInstructions?: string
	evidenceResult: ExtractEvidenceResult
}): Promise<AnalyzeThemesAndPersonaResult> {
	try {
		await autoGroupThemesAndApply({
			supabase: db,
			account_id: metadata.accountId,
			project_id: metadata.projectId ?? null,
			limit: 200,
		})
	} catch (themeErr) {
		consola.warn("Auto theme generation failed; continuing without themes", themeErr)
	}

	async function extractInsightsWithRetry(text: string, instructions: string, attempts = 2) {
		let lastErr: unknown = null
		for (let i = 0; i <= attempts; i++) {
			try {
				return await b.ExtractInsights(text, instructions)
			} catch (e) {
				lastErr = e
				const delayMs = 500 * (i + 1)
				consola.warn(`ExtractInsights failed (attempt ${i + 1}/${attempts + 1}), retrying in ${delayMs}ms`, e)
				await new Promise((res) => setTimeout(res, delayMs))
			}
		}
		throw lastErr
	}

	type ExtractInsightsResponse = Awaited<ReturnType<typeof b.ExtractInsights>>
	let response: ExtractInsightsResponse
	try {
		response = await extractInsightsWithRetry(fullTranscript, userCustomInstructions || "")
		consola.log("BAML extractInsights response:", response)
	} catch (err) {
		const errMsg = err instanceof Error ? err.message : String(err)
		consola.error("ExtractInsights ultimately failed after retries:", errMsg)
		throw new Error(`Insights extraction failed: ${errMsg}`)
	}

	const { insights, interviewee, highImpactThemes, openQuestionsAndNextSteps, observationsAndNotes } = response

	if (!insights?.length) {
		return { storedInsights: [], interview: interviewRecord }
	}

	await db.from("insights").delete().eq("interview_id", interviewRecord.id)

	const rows = insights.map((i) => ({
		account_id: metadata.accountId,
		project_id: metadata.projectId,
		interview_id: interviewRecord.id,
		name: i.name,
		category: i.category,
		details: i.details ?? null,
		journey_stage: i.journeyStage ?? null,
		jtbd: i.jtbd ?? null,
		motivation: i.underlyingMotivation ?? null,
		pain: i.pain ?? null,
		desired_outcome: i.desiredOutcome ?? null,
		emotional_response: i.emotionalResponse ?? null,
		evidence: i.evidence ?? null,
		confidence: i.confidence ? (i.confidence > 3 ? "high" : i.confidence > 1 ? "medium" : "low") : null,
		contradictions: i.contradictions ?? null,
		impact: i.impact ?? null,
		novelty: i.novelty ?? null,
		created_by: metadata.userId,
		updated_by: metadata.userId,
	}))

	const { data, error } = await db.from("insights").insert(rows).select()
	if (error) throw new Error(`Failed to insert insights: ${error.message}`)

	const generateFallbackName = (): string => {
		if (metadata.fileName) {
			const nameFromFile = metadata.fileName
				.replace(/\.[^/.]+$/, "")
				.replace(/[_-]/g, " ")
				.replace(/\b\w/g, (l) => l.toUpperCase())
				.trim()

			if (nameFromFile.length > 0) return `${nameFromFile}`
		}
		if (metadata.interviewTitle && !metadata.interviewTitle.includes("Interview -")) return `${metadata.interviewTitle}`
		const timestamp = new Date().toISOString().split("T")[0]
		return `${timestamp}`
	}

	const personData = evidenceResult.personData
	const personName = interviewee?.name?.trim() || evidenceResult.primaryPersonName || generateFallbackName()
	const personUpdatePayload: PeopleUpdate = {
		name: personName,
		description: interviewee?.participantDescription?.trim() || evidenceResult.primaryPersonDescription || null,
		segment: interviewee?.segment?.trim() || evidenceResult.primaryPersonSegments[0] || metadata.segment || null,
		contact_info: interviewee?.contactInfo || null,
		company: evidenceResult.primaryPersonOrganization || null,
		role: evidenceResult.primaryPersonRole || null,
	}
	const { error: personUpdateErr } = await db.from("people").update(personUpdatePayload).eq("id", personData.id)
	if (personUpdateErr) {
		consola.warn("Failed to update primary person with interviewee details", personUpdateErr.message)
	}

	try {
		let latestQuestions: Array<{ id: string; text: string; categoryId?: string | null }> = []
		if (metadata.projectId) {
			const { data: plannedAnswers, error: plannedError } = await db
				.from("project_answers")
				.select("question_id, question_text, question_category")
				.eq("project_id", metadata.projectId)
				.eq("interview_id", interviewRecord.id)

			if (plannedError) {
				consola.warn("Failed to load planned project_answers", plannedError.message)
			}

			if (plannedAnswers && plannedAnswers.length > 0) {
				latestQuestions = plannedAnswers
					.filter((row) => row.question_id && row.question_text)
					.map((row) => ({
						id: row.question_id as string,
						text: row.question_text ?? "",
						categoryId: row.question_category,
					}))
			} else {
				const { data: qsSection } = await db
					.from("project_sections")
					.select("meta, created_at")
					.eq("project_id", metadata.projectId)
					.eq("kind", "questions")
					.order("created_at", { ascending: false })
					.limit(1)
					.single()
				const meta = (qsSection?.meta as any) || {}
				const fromMeta = Array.isArray(meta?.questions) ? meta.questions : []
				latestQuestions = fromMeta
					.filter((q: any) => q?.id && (q?.text || q?.question))
					.map((q: any) => ({
						id: String(q.id),
						text: String(q.text || q.question || ""),
						categoryId: q.categoryId || q.category || null,
					}))
			}
		}

		const categoryToQuestion = new Map<string, { id: string; text: string }>()
		for (const q of latestQuestions) {
			if (!q.id || !q.text) continue
			if (q.categoryId && !categoryToQuestion.has(q.categoryId)) {
				categoryToQuestion.set(q.categoryId, { id: q.id, text: q.text })
			}
		}

		const categoryAlias = new Map<string, string>([
			["context", "context"],
			["pain", "pain"],
			["workflow", "workflow"],
			["goal", "goals"],
			["goals", "goals"],
			["constraint", "constraints"],
			["constraints", "constraints"],
			["willingness", "willingness"],
			["demographic", "demographics"],
			["demographics", "demographics"],
		])

		if (Array.isArray(evidenceResult.evidenceUnits) && evidenceResult.evidenceUnits.length && metadata.projectId) {
			for (let i = 0; i < evidenceResult.insertedEvidenceIds.length; i++) {
				const evId = evidenceResult.insertedEvidenceIds[i]
				const facetKinds = evidenceResult.evidenceFacetKinds[i] ?? []

				const matchedSlug = (facetKinds || []).map((slug) => String(slug)).find((slug) => categoryAlias.has(slug))
				const categoryKey = matchedSlug ? categoryAlias.get(matchedSlug) : undefined
				const qRep = categoryKey ? categoryToQuestion.get(categoryKey) : undefined
				if (!qRep) continue

				let answerId: string | null = null
				let existingAnswer: Pick<
					Tables["project_answers"]["Row"],
					| "id"
					| "answered_at"
					| "respondent_person_id"
					| "question_category"
					| "estimated_time_minutes"
					| "order_index"
					| "origin"
				> | null = null
				const { data: existingAns } = await db
					.from("project_answers")
					.select(
						"id, answered_at, respondent_person_id, question_category, estimated_time_minutes, order_index, origin"
					)
					.eq("project_id", metadata.projectId)
					.eq("interview_id", interviewRecord.id)
					.eq("question_id", qRep.id)
					.limit(1)
					.single()
				if (existingAns?.id) {
					answerId = existingAns.id
					existingAnswer = existingAns as typeof existingAnswer
				} else {
					const { data: createdAns, error: ansErr } = await db
						.from("project_answers")
						.insert({
							project_id: metadata.projectId,
							interview_id: interviewRecord.id,
							respondent_person_id: personData.id,
							question_id: qRep.id,
							question_text: qRep.text,
							question_category: qRep.categoryId || categoryKey || null,
							status: "answered",
							origin: "scripted",
							answered_at: new Date().toISOString(),
						})
						.select("id")
						.single()
					if (ansErr) {
						consola.warn("Failed to upsert project_answers for evidence", ansErr.message)
						continue
					}
					answerId = createdAns?.id ?? null
				}

				if (!answerId) continue

				const answerUpdatePayload: Tables["project_answers"]["Update"] = {}
				if (existingAnswer?.respondent_person_id !== personData.id) {
					answerUpdatePayload.respondent_person_id = personData.id
				}
				if (existingAnswer?.status !== "answered") {
					answerUpdatePayload.status = "answered"
				}
				if (!existingAnswer?.answered_at) {
					answerUpdatePayload.answered_at = new Date().toISOString()
				}
				if (!existingAnswer?.question_category && (qRep?.categoryId || categoryKey)) {
					answerUpdatePayload.question_category = qRep?.categoryId || categoryKey || null
				}

				if (Object.keys(answerUpdatePayload).length) {
					const { error: answerUpdateErr } = await db
						.from("project_answers")
						.update(answerUpdatePayload)
						.eq("id", answerId)
					if (answerUpdateErr) {
						consola.warn("Failed to update project_answers metadata", answerUpdateErr.message)
					}
				}

				const { error: evidenceUpdateErr } = await db
					.from("evidence")
					.update({ project_answer_id: answerId })
					.eq("id", evId)
				if (evidenceUpdateErr) {
					consola.warn("Failed to attach evidence to project_answer", evidenceUpdateErr.message)
				}
			}
		}
	} catch (mapErr) {
		consola.warn("Evidence→Answer mapping skipped due to error", mapErr)
	}

	const junctionData: InterviewPeopleInsert = {
		interview_id: interviewRecord.id,
		person_id: personData.id,
		role: evidenceResult.primaryPersonRole ?? null,
		project_id: metadata.projectId,
	}
	const { error: junctionError } = await db
		.from("interview_people")
		.upsert(junctionData, { onConflict: "interview_id,person_id" })
		.select("id")
		.single()
	if (junctionError) {
		if (!junctionError.message?.toLowerCase().includes("duplicate key value")) {
			throw new Error(`Failed to link person to interview: ${junctionError.message}`)
		}
		consola.info("interview_people already linked; skipping duplicate link", {
			interview_id: interviewRecord.id,
			person_id: personData.id,
		})
	}

	try {
		let personasQuery = db.from("personas").select("id, name, description").order("created_at", { ascending: false })

		if (metadata.projectId) {
			personasQuery = personasQuery.eq("project_id", metadata.projectId)
		}

		const { data: existingPersonas, error: personasError } = await personasQuery

		if (personasError) {
			consola.warn(`Failed to fetch existing personas: ${personasError.message}`)
		}

		const intervieweeInfo = JSON.stringify({
			name: personName,
			segment: interviewee?.segment || metadata.segment || null,
			description: interviewee?.participantDescription || null,
		})

		const existingPersonasForBaml = JSON.stringify(
			(existingPersonas || []).map((p) => ({
				id: p.id,
				name: p.name,
				description: p.description,
			}))
		)

		const personaDecision = await b.AssignPersonaToInterview(fullTranscript, intervieweeInfo, existingPersonasForBaml)

		consola.log("Persona assignment decision:", personaDecision)

		let personaId: string | null = null

		if (personaDecision.action === "assign_existing" && personaDecision.persona_id) {
			personaId = personaDecision.persona_id
			consola.log(`Assigning to existing persona: ${personaDecision.persona_name} (${personaId})`)
		} else if (personaDecision.action === "create_new" && personaDecision.new_persona_data) {
			const newPersona = personaDecision.new_persona_data
			const { data: createdPersona, error: createError } = await db
				.from("personas")
				.insert({
					account_id: metadata.accountId,
					project_id: metadata.projectId,
					name: newPersona.name,
					description: newPersona.description || null,
					color_hex: newPersona.color_hex || null,
				})
				.select("id")
				.single()

			if (createError) {
				consola.warn(`Failed to create new persona: ${createError.message}`)
			} else {
				personaId = createdPersona.id
				consola.log(`Created new persona: ${newPersona.name} (${personaId})`)
			}
		}

		if (personaId && personData.id) {
			const { error: linkError } = await db.from("people_personas").upsert(
				{
					person_id: personData.id,
					persona_id: personaId,
					interview_id: interviewRecord.id,
					project_id: metadata.projectId,
					confidence_score: personaDecision.confidence_score || 0.5,
					source: "ai_assignment",
					assigned_at: new Date().toISOString(),
				},
				{ onConflict: "person_id,persona_id" }
			)

			if (linkError) {
				consola.warn(`Failed to link person to persona: ${linkError.message}`)
			} else {
				consola.log(`Successfully linked person ${personData.id} to persona ${personaId}`)
			}
		}
	} catch (personaErr) {
		consola.warn("Persona assignment failed; continuing without persona assignment", personaErr)
	}

	consola.log(`Successfully created/linked person "${personName}" to interview ${interviewRecord.id}`)

	await db
		.from("interviews")
		.update({
			segment: interviewee?.segment ?? null,
			high_impact_themes: highImpactThemes ?? null,
			open_questions_and_next_steps: openQuestionsAndNextSteps ?? null,
			observations_and_notes: observationsAndNotes ?? null,
		})
		.eq("id", interviewRecord.id)

	const allTags = insights.flatMap((insight) => insight.relatedTags || [])
	const uniqueTags = [...new Set(allTags.filter(Boolean))]

	consola.log(`Creating ${uniqueTags.length} unique tags:`, uniqueTags)

	for (const tagName of uniqueTags) {
		const { data: tagData, error: tagError } = await db
			.from("tags")
			.upsert(
				{ account_id: metadata.accountId, tag: tagName, project_id: metadata.projectId },
				{ onConflict: "account_id,tag" }
			)
			.select("id")
			.single()
		if (tagError) {
			consola.warn(`Failed to create tag "${tagName}": ${tagError.message}`)
			continue
		}

		for (let i = 0; i < insights.length; i++) {
			const originalInsight = insights[i]
			const storedInsight = data?.[i]

			if (!storedInsight || !originalInsight.relatedTags?.includes(tagName)) {
				continue
			}

			const { error: junctionError } = await db
				.from("insight_tags")
				.insert({
					insight_id: storedInsight.id,
					tag_id: tagData.id,
					account_id: metadata.accountId,
					project_id: metadata.projectId,
				})
				.select()
				.single()

			if (junctionError && !junctionError.message.includes("duplicate")) {
				consola.warn(`Failed to link insight ${storedInsight.id} to tag ${tagName}: ${junctionError.message}`)
			}
		}
	}

	if (data?.length) {
		for (const insight of data) {
			const { error: personaLinkError } = await db.rpc("auto_link_persona_insights", {
				p_insight_id: insight.id,
			})

			if (personaLinkError) {
				consola.warn(`Failed to auto-link persona insights for ${insight.id}: ${personaLinkError.message}`)
			}
		}
	}

	const { data: refreshedInterview } = await db.from("interviews").select("*").eq("id", interviewRecord.id).single()

	const updatedInterview = (refreshedInterview as unknown as Interview) || interviewRecord

	return { storedInsights: (data as unknown as InsightInsert[]) ?? [], interview: updatedInterview }
}

export async function attributeAnswersAndFinalizeCore({
	db,
	metadata,
	interviewRecord,
	insertedEvidenceIds,
	storedInsights,
	fullTranscript,
}: {
	db: SupabaseClient<Database>
	metadata: InterviewMetadata
	interviewRecord: Interview
	insertedEvidenceIds: string[]
	storedInsights: InsightInsert[]
	fullTranscript: string
}): Promise<void> {
	if (metadata.projectId) {
		try {
			await runEvidenceAnalysis({
				supabase: db,
				projectId: metadata.projectId,
				interviewId: interviewRecord.id,
			})
		} catch (analysisError) {
			consola.warn("[processInterview] Evidence analysis failed", analysisError)
		}
	}

	await db.from("interviews").update({ status: "ready" }).eq("id", interviewRecord.id)

	try {
		const source = metadata.fileName
			? metadata.fileName.match(/\.(mp3|wav|m4a|ogg)$/i)
				? "upload"
				: metadata.fileName.match(/\.(mp4|mov|avi|webm)$/i)
					? "upload"
					: "paste"
			: "record"

		const fileType = metadata.fileName
			? metadata.fileName.match(/\.(mp3|wav|m4a|ogg)$/i)
				? "audio"
				: metadata.fileName.match(/\.(mp4|mov|avi|webm)$/i)
					? "video"
					: "text"
			: undefined

		posthog.capture("interview_added", {
			interview_id: interviewRecord.id,
			project_id: metadata.projectId,
			account_id: metadata.accountId,
			source,
			duration_s: interviewRecord.duration_sec || 0,
			file_type: fileType,
			has_transcript: Boolean(fullTranscript),
			evidence_count: insertedEvidenceIds.length,
			insights_count: storedInsights.length,
			$insert_id: `interview:${interviewRecord.id}:analysis`,
		})

		if (metadata.userId) {
			const { count: interviewCount } = await db
				.from("interviews")
				.select("id", { count: "exact", head: true })
				.eq("account_id", metadata.accountId)

			if ((interviewCount || 0) <= 3) {
				posthog.identify(metadata.userId, {
					$set: {
						interview_count: interviewCount || 1,
					},
				})
			}
		}
	} catch (trackingError) {
		consola.warn("[processInterview] PostHog tracking failed:", trackingError)
	}
}

async function ensureFallbackPerson(
	db: SupabaseClient<Database>,
	metadata: InterviewMetadata,
	interviewRecord: Interview
): Promise<string> {
	const fallbackName = generateFallbackPersonName(metadata)
	const payload: PeopleInsert = {
		account_id: metadata.accountId,
		project_id: metadata.projectId,
		name: fallbackName,
	}
	const { data, error } = await db
		.from("people")
		.upsert(payload, { onConflict: "account_id,name_hash" })
		.select("id")
		.single()
	if (error || !data?.id) throw new Error(`Failed to ensure fallback person: ${error?.message}`)
	const linkPayload: InterviewPeopleInsert = {
		interview_id: interviewRecord.id,
		person_id: data.id,
		project_id: metadata.projectId ?? null,
		role: "participant",
	}
	await db.from("interview_people").upsert(linkPayload, { onConflict: "interview_id,person_id" })
	return data.id
}

export async function uploadMediaAndTranscribeCore({
	metadata,
	transcriptData,
	mediaUrl,
	existingInterviewId,
	client,
}: UploadMediaAndTranscribePayload & { client: SupabaseClient<Database> }): Promise<UploadMediaAndTranscribeResult> {
	const normalizedMetadata: InterviewMetadata = { ...metadata }
	const sanitizedTranscriptData = safeSanitizeTranscriptPayload(transcriptData)
	const normalizedTranscriptData = sanitizedTranscriptData as unknown as Record<string, unknown>

	if (normalizedMetadata.projectId) {
		const { data: projectRow } = await client
			.from("projects")
			.select("account_id")
			.eq("id", normalizedMetadata.projectId)
			.single()
		if (projectRow?.account_id && normalizedMetadata.accountId !== projectRow.account_id) {
			consola.warn("Overriding metadata.accountId with project account", {
				provided: normalizedMetadata.accountId,
				projectAccount: projectRow.account_id,
			})
			normalizedMetadata.accountId = projectRow.account_id
		}
	}

	// Get full transcript for legacy purposes (not used in AI extraction anymore)
	const fullTranscript = (sanitizedTranscriptData.full_transcript ?? "") as string
	const language =
		(normalizedTranscriptData as any).language || (normalizedTranscriptData as any).detected_language || "en"

	let interviewRecord: Interview
	consola.log("assembly audio_duration ", sanitizedTranscriptData.audio_duration)
	if (existingInterviewId) {
		const { data: existing, error: fetchErr } = await client
			.from("interviews")
			.select("*")
			.eq("id", existingInterviewId)
			.single()
		if (fetchErr || !existing) {
			throw new Error(`Existing interview ${existingInterviewId} not found: ${fetchErr?.message}`)
		}
		const { data: updated, error: updateErr } = await client
			.from("interviews")
			.update({
				status: "processing",
				transcript: fullTranscript,
				transcript_formatted: sanitizedTranscriptData as unknown as Json,
				duration_sec: sanitizedTranscriptData.audio_duration ?? null,
			})
			.eq("id", existingInterviewId)
			.select("*")
			.single()
		if (updateErr || !updated) {
			throw new Error(`Failed to update existing interview: ${updateErr?.message}`)
		}
		interviewRecord = updated as unknown as Interview
	} else {
		const interviewData: InterviewInsert = {
			account_id: normalizedMetadata.accountId,
			project_id: normalizedMetadata.projectId,
			title: normalizedMetadata.interviewTitle || normalizedMetadata.fileName,
			interview_date: normalizedMetadata.interviewDate || new Date().toISOString().split("T")[0],
			participant_pseudonym: normalizedMetadata.participantName || "Anonymous",
			segment: normalizedMetadata.segment || null,
			media_url: mediaUrl || null,
			transcript: fullTranscript,
			transcript_formatted: sanitizedTranscriptData as unknown as Json,
			duration_sec: sanitizedTranscriptData.audio_duration ?? null,
			status: "processing" as const,
		} as InterviewInsert

		const { data: created, error: interviewError } = await client
			.from("interviews")
			.insert(interviewData)
			.select()
			.single()
		if (interviewError || !created) {
			throw new Error(`Failed to create interview record: ${interviewError?.message}`)
		}
		interviewRecord = created as unknown as Interview
	}

	if (normalizedMetadata.projectId && interviewRecord?.id) {
		await createPlannedAnswersForInterview(client, {
			projectId: normalizedMetadata.projectId,
			interviewId: interviewRecord.id,
		})
	}

	return {
		metadata: normalizedMetadata,
		interview: interviewRecord,
		sanitizedTranscriptData: sanitizedTranscriptData as unknown as Record<string, unknown>,
		transcriptData: normalizedTranscriptData,
		fullTranscript,
		language,
	}
}

/**
 * processInterviewTranscript
 * --------------------------
 * Sends an interview transcript and metadata to the BAML `extractInsights` process
 * powered by GPT-4o, then persists the returned insights JSON into the `insights` table.
 *
 * Assumes the following environment variable is set:
 *   OPENAI_API_KEY – forwarded automatically by BAML runtime.
 */
export async function processInterviewTranscript({
	metadata,
	mediaUrl,
	transcriptData,
	userCustomInstructions,
	request,
}: {
	metadata: InterviewMetadata
	transcriptData: Record<string, unknown>
	mediaUrl: string
	userCustomInstructions?: string
	request: Request
}): Promise<ProcessingResult> {
	// Create authenticated client to respect RLS policies
	const { client: db } = getServerClient(request)

	return await processInterviewTranscriptWithClient({
		metadata,
		mediaUrl,
		transcriptData,
		userCustomInstructions,
		client: db,
	})
}

/**
 * processInterviewTranscriptWithAdminClient
 * ------------------------------------------
 * Webhook-specific version that uses admin client for system operations.
 * Bypasses RLS since webhooks have no user context.
 */
async function _processInterviewTranscriptWithAdminClient({
	metadata,
	mediaUrl,
	transcriptData,
	userCustomInstructions,
	adminClient,
	existingInterviewId,
}: {
	metadata: InterviewMetadata
	transcriptData: Record<string, unknown>
	mediaUrl: string
	userCustomInstructions?: string
	adminClient: SupabaseClient<Database>
	existingInterviewId?: string
}): Promise<ProcessingResult> {
	return await processInterviewTranscriptWithClient({
		metadata,
		mediaUrl,
		transcriptData,
		userCustomInstructions,
		client: adminClient,
		existingInterviewId,
	})
}

/**
 * Internal implementation shared by both public functions
 */
export async function processInterviewTranscriptWithClient({
	metadata,
	mediaUrl,
	transcriptData: rawTranscriptData,
	userCustomInstructions,
	client: db,
	existingInterviewId,
}: {
	metadata: InterviewMetadata
	transcriptData: Record<string, unknown>
	mediaUrl: string
	userCustomInstructions?: string
	client: SupabaseClient<Database>
	existingInterviewId?: string
}): Promise<ProcessingResult> {
	const uploadResult = await uploadMediaAndTranscribeCore({
		metadata,
		transcriptData: rawTranscriptData,
		mediaUrl,
		existingInterviewId,
		client: db,
	})

	const evidenceResult = await extractEvidenceAndPeopleCore({
		db,
		metadata: uploadResult.metadata,
		interviewRecord: uploadResult.interview,
		transcriptData: uploadResult.transcriptData,
		language: uploadResult.language,
		fullTranscript: uploadResult.fullTranscript,
	})

	const analysisResult = await analyzeThemesAndPersonaCore({
		db,
		metadata: uploadResult.metadata,
		interviewRecord: uploadResult.interview,
		fullTranscript: uploadResult.fullTranscript,
		userCustomInstructions,
		evidenceResult,
	})

	await attributeAnswersAndFinalizeCore({
		db,
		metadata: uploadResult.metadata,
		interviewRecord: analysisResult.interview,
		insertedEvidenceIds: evidenceResult.insertedEvidenceIds,
		storedInsights: analysisResult.storedInsights,
		fullTranscript: uploadResult.fullTranscript,
	})

	const projectId = uploadResult.metadata.projectId ?? analysisResult.interview.project_id
	if (projectId) {
		const { data: existingGoal } = await db
			.from("project_sections")
			.select("id")
			.eq("project_id", projectId)
			.eq("kind", "research_goal")
			.limit(1)
			.maybeSingle()

		if (!existingGoal) {
			try {
				const conversationAnalysis = await generateConversationAnalysis({
					transcript: uploadResult.fullTranscript,
					context: undefined,
				})

				await db.from("project_sections").insert({
					project_id: projectId,
					kind: "research_goal",
					content_md: conversationAnalysis.overview,
					meta: {
						source: "conversation_analysis",
						generated_at: new Date().toISOString(),
					},
				})
			} catch (goalError) {
				consola.warn("Failed to backfill research goal from conversation analysis", goalError)
			}
		}
	}

	return { stored: analysisResult.storedInsights, interview: analysisResult.interview }
}
