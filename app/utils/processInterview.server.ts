// Import the BAML async client helper ("b"), following the official BoundaryML docs.
// After running `baml-cli generate`, all functions are exposed on this client.
// NOTE: tsconfig path alias `~` maps to `app/`, so baml_client (generated at project root)
// is accessible via `~/../baml_client`.
// Import BAML client - this file is server-only so it's safe to import directly

import type { SupabaseClient } from "@supabase/supabase-js"
import consola from "consola"
import { b } from "~/../baml_client"
import type { FacetCatalog, PersonFacetObservation, PersonScaleObservation } from "~/../baml_client/types"
import type { Database, Json } from "~/../supabase/types"
import { getFacetCatalog, persistFacetObservations } from "~/lib/database/facets.server"
import { runEvidenceAnalysis } from "~/features/research/analysis/runEvidenceAnalysis.server"
import { autoGroupThemesAndApply } from "~/features/themes/db.autoThemes.server"
import { createPlannedAnswersForInterview } from "~/lib/database/project-answers.server"
import { getServerClient } from "~/lib/supabase/server"
import type { InsightInsert, Interview, InterviewInsert } from "~/types" // path alias provided by project setup

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

export interface ExtractedInsight {
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

// Utilities ---------------------------------------------------------------
type AllowedSupport = "supports" | "refutes" | "neutral"
const allowedEvidenceSupport = new Set<AllowedSupport>(["supports", "refutes", "neutral"])

function normalizeSupport(s: unknown): AllowedSupport {
	const val = typeof s === "string" ? (s.toLowerCase().trim() as AllowedSupport) : ("supports" as AllowedSupport)
	return allowedEvidenceSupport.has(val) ? val : "supports"
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
	return ("00000000" + h.toString(16)).slice(-8)
}

function computeIndependenceKey(verbatim: string, kindTags: string[]): string {
	const normQuote = verbatim.toLowerCase().replace(/\s+/g, " ").trim()
	const mainTag = (kindTags[0] || "").toLowerCase().trim()
	const basis = `${normQuote.slice(0, 160)}|${mainTag}`
	return stringHash(basis)
}

async function resolveFacetCatalog(
	db: SupabaseClient<Database>,
	accountId: string,
	projectId?: string | null,
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

type EvidenceFromBaml = Awaited<ReturnType<typeof b.ExtractEvidenceFromTranscript>>

interface ProcessEvidenceOptions {
	db: SupabaseClient<Database>
	metadata: InterviewMetadata
	interviewRecord: Interview
	transcriptData: Record<string, unknown>
	language: string
	fullTranscript: string
}

interface ProcessEvidenceResult {
	personData: { id: string }
	primaryPersonName: string | null
	primaryPersonRole: string | null
	primaryPersonDescription: string | null
	primaryPersonOrganization: string | null
	primaryPersonSegments: string[]
	insertedEvidenceIds: string[]
	evidenceUnits: EvidenceFromBaml["evidence"]
}

async function processEvidencePhase({
	db,
	metadata,
	interviewRecord,
	transcriptData,
	language,
	fullTranscript,
}: ProcessEvidenceOptions): Promise<ProcessEvidenceResult> {
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
	let evidencePeople: EvidenceFromBaml["people"] = []
	let insertedEvidenceIds: string[] = []
	const personKeyForEvidence: (string | null)[] = []
	const personRoleByKey = new Map<string, string | null>()

	const facetCatalog = await resolveFacetCatalog(db, metadata.accountId, metadata.projectId)
	const evidenceResponse = await b.ExtractEvidenceFromTranscript(
		fullTranscript || "",
		chapters,
		language,
		facetCatalog,
	)
	consola.log("🔍 Raw BAML evidence response:", JSON.stringify(evidenceResponse, null, 2))
	evidenceUnits = Array.isArray(evidenceResponse?.evidence) ? evidenceResponse.evidence : []
	evidencePeople = Array.isArray(evidenceResponse?.people) ? evidenceResponse.people : []

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
	for (const ev of evidenceUnits) {
		const personKey = typeof (ev as any).person_key === "string" ? (ev as any).person_key.trim() : null
		const verb = sanitizeVerbatim((ev as { verbatim?: string }).verbatim)
		if (!verb) continue
		const chunk = sanitizeVerbatim((ev as { chunk?: string }).chunk) ?? verb
		const gist = sanitizeVerbatim((ev as { gist?: string }).gist) ?? verb
		const topic = sanitizeVerbatim((ev as { topic?: string }).topic)
		const support = normalizeSupport((ev as { support?: string }).support)
		const kind_tags = Array.isArray(ev.kind_tags)
			? (ev.kind_tags as string[])
			: Object.values(ev.kind_tags ?? {})
					.flat()
					.filter((x): x is string => typeof x === "string")
		const confidenceStr = (ev as { confidence?: EvidenceInsert["confidence"] }).confidence ?? "medium"
		const weight_quality = confidenceStr === "high" ? 0.95 : confidenceStr === "low" ? 0.6 : 0.8
		const weight_relevance = confidenceStr === "high" ? 0.9 : confidenceStr === "low" ? 0.6 : 0.8
		const providedIndKey = (ev as { independence_key?: string }).independence_key
		const independence_key =
			providedIndKey && providedIndKey.trim().length > 0
				? providedIndKey.trim()
				: computeIndependenceKey(gist ?? verb, kind_tags)
		const rawAnchors = Array.isArray((ev as { anchors?: unknown }).anchors)
			? (((ev as { anchors?: unknown }).anchors ?? []) as Array<Record<string, any>>)
			: []
		const sanitizedAnchors = rawAnchors
			.map((anchor) => {
				if (!anchor || typeof anchor !== "object") return null
				const targetValue = anchor.target
				if (typeof targetValue === "string") {
					const trimmed = targetValue.trim()
					if (!trimmed.length) return { ...anchor, target: null }
					if (trimmed.toLowerCase() === "transcript") {
						return { ...anchor, target: interviewMediaUrl ?? null }
					}
					return { ...anchor, target: trimmed }
				}
				return anchor
			})
			.filter((anchor): anchor is Record<string, any> => Boolean(anchor))
		const row: EvidenceInsert = {
			account_id: metadata.accountId,
			project_id: metadata.projectId,
			interview_id: interviewRecord.id,
			source_type: "primary",
			method: "interview",
			modality: "qual",
			support,
			kind_tags,
			personas: (ev.personas ?? []) as string[],
			segments: (ev.segments ?? []) as string[],
			journey_stage: ev.journey_stage || null,
			chunk,
			gist,
			topic: topic || null,
			weight_quality,
			weight_relevance,
			independence_key,
			confidence: confidenceStr,
			verbatim: verb,
			anchors: sanitizedAnchors as unknown as Json,
		}

		const _says = Array.isArray((ev as any).says) ? ((ev as any).says as string[]) : []
		const _does = Array.isArray((ev as any).does) ? ((ev as any).does as string[]) : []
		const _thinks = Array.isArray((ev as any).thinks) ? ((ev as any).thinks as string[]) : []
		const _feels = Array.isArray((ev as any).feels) ? ((ev as any).feels as string[]) : []
		const _pains = Array.isArray((ev as any).pains) ? ((ev as any).pains as string[]) : []
		const _gains = Array.isArray((ev as any).gains) ? ((ev as any).gains as string[]) : []
		;(row as Record<string, unknown>)["says"] = _says
		;(row as Record<string, unknown>)["does"] = _does
		;(row as Record<string, unknown>)["thinks"] = _thinks
		;(row as Record<string, unknown>)["feels"] = _feels
		;(row as Record<string, unknown>)["pains"] = _pains
		;(row as Record<string, unknown>)["gains"] = _gains

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
		const context_summary = (ev as { context_summary?: string }).context_summary
		if (context_summary && typeof context_summary === "string" && context_summary.trim().length) {
			;(row as Record<string, unknown>)["context_summary"] = context_summary.trim()
		}

		evidenceRows.push(row)
		personKeyForEvidence.push(personKey && personKey.length ? personKey : null)
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
		}
	}

	const { data: insertedEvidence, error: evidenceInsertError } = await db
		.from("evidence")
		.insert(evidenceRows)
		.select("id, kind_tags")
	if (evidenceInsertError) throw new Error(`Failed to insert evidence: ${evidenceInsertError.message}`)
	insertedEvidenceIds = (insertedEvidence ?? []).map((e) => e.id)

	try {
		const tagsSet = new Set<string>()
		const insertedEvidenceTyped = (insertedEvidence ?? []) as Array<{ id: string; kind_tags: string[] | null }>
		insertedEvidenceTyped.forEach((ev) => {
			for (const t of ev.kind_tags || []) {
				if (typeof t === "string" && t.trim()) tagsSet.add(t.trim())
			}
		})
		const tags = Array.from(tagsSet)

		const tagIdByName = new Map<string, string>()
		for (const tagName of tags) {
			const { data: tagRow, error: tagErr } = await db
				.from("tags")
				.upsert(
					{ account_id: metadata.accountId, tag: tagName, project_id: metadata.projectId },
					{ onConflict: "account_id,tag" }
				)
				.select("id")
				.single()
			if (!tagErr && tagRow?.id) tagIdByName.set(tagName, tagRow.id)
		}

		for (const ev of insertedEvidenceTyped) {
			for (const tagName of ev.kind_tags || []) {
				const tagId = tagIdByName.get(tagName)
				if (!tagId) continue
				const { error: etErr } = await db
					.from("evidence_tag")
					.insert({
						evidence_id: ev.id,
						tag_id: tagId,
						account_id: metadata.accountId,
						project_id: metadata.projectId,
					})
					.select("id")
					.single()
				if (etErr && !etErr.message?.includes("duplicate")) {
					consola.warn(`Failed linking evidence ${ev.id} to tag ${tagName}: ${etErr.message}`)
				}
			}
		}
	} catch (linkErr) {
		consola.warn("Failed to create/link tags for evidence", linkErr)
	}

	const personIdByKey = new Map<string, string>()
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

	const resolveName = (participant: EvidenceFromBaml["people"][number], index: number): string => {
		const candidates = [
			participant.inferred_name,
			participant.display_name,
			participant.person_key && humanizeKey(participant.person_key),
		]
		for (const candidate of candidates) {
			if (typeof candidate === "string" && candidate.trim().length) return candidate.trim()
		}
		return `Participant ${index + 1}`
	}

	const humanizeKey = (value?: string | null): string | null => {
		if (!value) return null
		const cleaned = value.replace(/[_-]+/g, " ").replace(/\s+/g, " ")
		return cleaned.replace(/\b\w/g, (char) => char.toUpperCase()).trim()
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

	if (Array.isArray(evidencePeople) && evidencePeople.length) {
		for (const [index, participant] of evidencePeople.entries()) {
			const participantKey = participant?.person_key?.trim()
			if (participantKey) {
				personRoleByKey.set(participantKey, participant.role ?? null)
			}
			const resolvedName = resolveName(participant, index)
			const segments = Array.isArray(participant?.segments)
				? participant.segments!.filter((seg): seg is string => typeof seg === "string" && seg.trim().length > 0)
				: []
			const participantOverrides: Partial<PeopleInsert> = {
				description: participant.summary?.trim() || null,
				segment: segments[0] || metadata.segment || null,
				company: participant.organization?.trim() || null,
				role: participant.role?.trim() || null,
			}
			const personRecord = await upsertPerson(resolvedName, participantOverrides)
			const key = participantKey && participantKey.length ? participantKey : `participant-${index}`
			personIdByKey.set(key, personRecord.id)
			keyByPersonId.set(personRecord.id, key)
			if (participant?.display_name) {
				displayNameByKey.set(key, participant.display_name.trim())
			}
			personRoleById.set(personRecord.id, participant.role?.trim() || null)

			const isPrimary = (participant.role || "").toLowerCase().includes("participant") || !primaryPersonId
			if (isPrimary) {
				primaryPersonId = personRecord.id
				primaryPersonName = personRecord.name
				primaryPersonRole = participant.role?.trim() || null
				primaryPersonDescription = participantOverrides.description ?? null
				primaryPersonOrganization = participantOverrides.company ?? null
				primaryPersonSegments = segments
			}
		}
	}

	if (!primaryPersonId) {
		const fallback = await upsertPerson(generateFallbackPersonName(metadata))
		primaryPersonId = fallback.id
		primaryPersonName = fallback.name
	}

	if (!primaryPersonId) throw new Error("Failed to resolve primary person for interview")

	personRoleById.set(primaryPersonId, primaryPersonRole ?? "participant")

	const ensuredPersonIds = new Set<string>([primaryPersonId])
	for (const id of personIdByKey.values()) ensuredPersonIds.add(id)
	for (const personId of ensuredPersonIds) {
		const role = personRoleById.get(personId) ?? (personId === primaryPersonId ? "participant" : null)
		const linkPayload: InterviewPeopleInsert = {
			interview_id: interviewRecord.id,
			person_id: personId,
			project_id: metadata.projectId ?? null,
			role,
			transcript_key: keyByPersonId.get(personId) ?? null,
			display_name: keyByPersonId.get(personId)
				? displayNameByKey.get(keyByPersonId.get(personId)!) ?? null
				: null,
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
		const observationInputs = Array.isArray(evidencePeople)
			? evidencePeople
					.map((participant, index) => {
						const key = typeof participant?.person_key === "string" && participant.person_key.trim().length
							? participant.person_key.trim()
							: `participant-${index}`
						const personId = personIdByKey.get(key) || primaryPersonId
						if (!personId) return null
						const facets = Array.isArray(participant?.facets) ? (participant!.facets as PersonFacetObservation[]) : []
						const scales = Array.isArray(participant?.scales) ? (participant!.scales as PersonScaleObservation[]) : []
						if (!facets.length && !scales.length) return null
						return { personId, facets, scales }
					})
					.filter((item): item is { personId: string; facets?: PersonFacetObservation[]; scales?: PersonScaleObservation[] } => item !== null)
			: []
		if (observationInputs.length) {
			await persistFacetObservations({
				db,
				accountId: metadata.accountId,
				projectId: metadata.projectId,
				observations: observationInputs,
				evidenceIds: insertedEvidenceIds,
				reviewerId: metadata.userId ?? null,
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
export async function processInterviewTranscriptWithAdminClient({
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
	transcriptData,
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
	if (metadata.projectId) {
		const { data: projectRow } = await db
			.from("projects")
			.select("account_id")
			.eq("id", metadata.projectId)
			.single()
		if (projectRow?.account_id) {
			if (!metadata.accountId || metadata.accountId !== projectRow.account_id) {
				consola.warn("Overriding metadata.accountId with project account", {
					provided: metadata.accountId,
					projectAccount: projectRow.account_id,
				})
				metadata.accountId = projectRow.account_id
			}
		}
	}

	// 1. Ensure we have an interview record to attach artifacts to
	const fullTranscript = transcriptData.full_transcript as string
	let interviewRecord: Interview
	consola.log("assembly audio_duration ", (transcriptData as any).audio_duration)
	if (existingInterviewId) {
		// Update existing interview and reuse it
		const { data: existing, error: fetchErr } = await db
			.from("interviews")
			.select("*")
			.eq("id", existingInterviewId)
			.single()
		if (fetchErr || !existing) {
			throw new Error(`Existing interview ${existingInterviewId} not found: ${fetchErr?.message}`)
		}
		const { data: updated, error: updateErr } = await db
			.from("interviews")
			.update({
				status: "processing",
				transcript: fullTranscript,
				transcript_formatted: transcriptData as unknown as Json,
				duration_sec: (transcriptData as any).audio_duration,
			})
			.eq("id", existingInterviewId)
			.select("*")
			.single()
		if (updateErr || !updated) {
			throw new Error(`Failed to update existing interview: ${updateErr?.message}`)
		}
		interviewRecord = updated as unknown as Interview
	} else {
		// Create the interview record
		const interviewData: InterviewInsert = {
			account_id: metadata.accountId,
			project_id: metadata.projectId,
			title: metadata.interviewTitle || metadata.fileName,
			interview_date: metadata.interviewDate || new Date().toISOString().split("T")[0],
			participant_pseudonym: metadata.participantName || "Anonymous",
			segment: metadata.segment || null,
			media_url: mediaUrl || null,
			transcript: fullTranscript,
			transcript_formatted: transcriptData as unknown as Json,
			duration_sec: (transcriptData as any).audio_duration,
			status: "processing" as const,
		} as InterviewInsert

		const { data: created, error: interviewError } = await db.from("interviews").insert(interviewData).select().single()
		if (interviewError || !created) {
			throw new Error(`Failed to create interview record: ${interviewError?.message}`)
		}
		interviewRecord = created as unknown as Interview
	}

	if (metadata.projectId && interviewRecord?.id) {
		await createPlannedAnswersForInterview(db, {
			projectId: metadata.projectId,
			interviewId: interviewRecord.id,
		})
	}

	// 2. Extract and persist Evidence units from transcript (BAML)
	// Prepare optional chapters if present in transcriptData
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
			consola.log("rawChapters: ", JSON.stringify(rawChapters))

			chapters = rawChapters
				.map((c: RawChapter) => ({
					start_ms: typeof c.start_ms === "number" ? c.start_ms : typeof c.start === "number" ? c.start : 0,
					end_ms: typeof c.end_ms === "number" ? c.end_ms : typeof c.end === "number" ? c.end : undefined,
					summary: c.summary ?? c.gist ?? undefined,
					title: c.title ?? undefined,
				}))
				.filter((c) => typeof c.start_ms === "number")
		}
	} catch (e) {
		consola.warn("Failed to normalize chapters for evidence extraction", e)
	}

	const language = (transcriptData as any).language || (transcriptData as any).detected_language || "en"

	const {
		personData: primaryPersonData,
		primaryPersonName,
		primaryPersonRole,
		primaryPersonDescription,
		primaryPersonOrganization,
		primaryPersonSegments,
		insertedEvidenceIds,
		evidenceUnits,
	} = await processEvidencePhase({
		db,
		metadata,
		interviewRecord,
		transcriptData,
		language,
		fullTranscript,
	})

	// 3. Auto-generate themes from accumulated evidence before insights
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

	// 4. Now extract Insights from transcript (after evidence and themes)
	// Add lightweight retry to handle transient LLM/JSON parsing issues
	async function extractInsightsWithRetry(text: string, instructions: string, attempts = 2) {
		let lastErr: unknown = null
		for (let i = 0; i <= attempts; i++) {
			try {
				return await b.ExtractInsights(text, instructions)
			} catch (e) {
				lastErr = e
				const delayMs = 500 * (i + 1)
				consola.warn(`ExtractInsights failed (attempt ${i + 1}/${attempts + 1}), retrying in ${delayMs}ms`, e)
				// Basic backoff
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
		// Let the caller (webhook/action) handle marking analysis_jobs/interviews as error
		const errMsg = err instanceof Error ? err.message : String(err)
		consola.error("ExtractInsights ultimately failed after retries:", errMsg)
		throw new Error(`Insights extraction failed: ${errMsg}`)
	}

	// Extract insights from the BAML response
	const { insights, interviewee, highImpactThemes, openQuestionsAndNextSteps, observationsAndNotes } = response

	if (!insights?.length) {
		// Update interview status to ready even if no insights (themes/evidence may exist)
		await db.from("interviews").update({ status: "ready" }).eq("id", interviewRecord.id)

		return { stored: [], interview: interviewRecord }
	}

	// 5. Transform insights into DB rows - map BAML types to database schema
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
		confidence: i.confidence ? (i.confidence > 3 ? "high" : i.confidence > 1 ? "medium" : "low") : null, // Convert number to enum
		contradictions: i.contradictions ?? null,
		impact: i.impact ?? null,
		novelty: i.novelty ?? null,
		created_by: metadata.userId, // Add user ID for audit
		updated_by: metadata.userId,
	}))

	// 6. Bulk upsert insights into Supabase
	const { data, error } = await db.from("insights").insert(rows).select()
	if (error) throw new Error(`Failed to insert insights: ${error.message}`)

	// 6.a Upsert person and link to interview - now that we have interviewee
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

	const personData = primaryPersonData
	const personName = interviewee?.name?.trim() || primaryPersonName || generateFallbackName()
	const personUpdatePayload: PeopleUpdate = {
		name: personName,
		description: interviewee?.participantDescription?.trim() || primaryPersonDescription || null,
		segment: interviewee?.segment?.trim() || primaryPersonSegments[0] || metadata.segment || null,
		contact_info: interviewee?.contactInfo || null,
		company: primaryPersonOrganization || null,
		role: primaryPersonRole || null,
	}
	const { error: personUpdateErr } = await db.from("people").update(personUpdatePayload).eq("id", personData.id)
	if (personUpdateErr) {
		consola.warn("Failed to update primary person with interviewee details", personUpdateErr.message)
	}
	// personName already contains the updated value, no need to reassign

	// Heuristic: Map evidence -> answers by category against latest questions set
	try {
		// 1) Prefer planned answers for this interview; fallback to project_sections meta
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

		// 2) Build a category -> representative question map (first in each category)
		const categoryToQuestion = new Map<string, { id: string; text: string }>()
		for (const q of latestQuestions) {
			if (!q.id || !q.text) continue
			if (q.categoryId && !categoryToQuestion.has(q.categoryId)) {
				categoryToQuestion.set(q.categoryId, { id: q.id, text: q.text })
			}
		}

		// Known categories from UI (keep in sync):
		const knownCategories = new Set([
			"context",
			"pain",
			"workflow",
			"goals",
			"constraints",
			"willingness",
			"demographics",
		])

		// 3) For each inserted evidence, if it has a matching category tag, upsert project_answers and link
		if (Array.isArray(evidenceUnits) && evidenceUnits.length && metadata.projectId) {
			// We also need the DB IDs of inserted evidence to link; we have insertedEvidenceIds in the same order as evidenceRows mapping
			// However types may differ; we already captured insertedEvidenceIds above
			for (let i = 0; i < insertedEvidenceIds.length; i++) {
				const evId = insertedEvidenceIds[i]
				// Safeguard: find the corresponding evidence unit's kind_tags if available
				const evUnit = Array.isArray(evidenceUnits) ? (evidenceUnits[i] as any) : undefined
				const tags: string[] = Array.isArray(evUnit?.kind_tags)
					? evUnit.kind_tags
					: Object.values(evUnit?.kind_tags ?? {})
							.flat()
							.filter((x: unknown): x is string => typeof x === "string")

				const matchCat = (tags || []).find((t) => knownCategories.has(String(t)))
				const qRep = matchCat ? categoryToQuestion.get(matchCat) : undefined
				if (!qRep) continue

				// See if answer already exists for (project_id, interview_id, question_id)
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
							question_category: qRep.categoryId || matchCat || null,
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
				if (!existingAnswer?.question_category && (qRep?.categoryId || matchCat)) {
					answerUpdatePayload.question_category = qRep?.categoryId || matchCat || null
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
		role: "participant",
		project_id: metadata.projectId,
	}
	const { error: junctionError } = await db
		.from("interview_people")
		.upsert(junctionData, { onConflict: "interview_id,person_id" })
		.select("id")
		.single()
	if (junctionError) {
		// Ignore duplicate unique violation explicitly; surface other errors
		if (!junctionError.message?.toLowerCase().includes("duplicate key value")) {
			throw new Error(`Failed to link person to interview: ${junctionError.message}`)
		}
		consola.info("interview_people already linked; skipping duplicate link", {
			interview_id: interviewRecord.id,
			person_id: personData.id,
		})
	}

	// Assign persona to the person using BAML client
	try {
		// Fetch existing personas for this project (RLS scopes to account)
		let personasQuery = db.from("personas").select("id, name, description").order("created_at", { ascending: false })

		if (metadata.projectId) {
			personasQuery = personasQuery.eq("project_id", metadata.projectId)
		}

		const { data: existingPersonas, error: personasError } = await personasQuery

		if (personasError) {
			consola.warn(`Failed to fetch existing personas: ${personasError.message}`)
		}

		// Prepare interviewee info for persona assignment
		const intervieweeInfo = JSON.stringify({
			name: personName,
			segment: interviewee?.segment || metadata.segment || null,
			description: interviewee?.participantDescription || null,
		})

		// Convert personas to the format expected by BAML
		const existingPersonasForBaml = JSON.stringify(
			(existingPersonas || []).map((p) => ({
				id: p.id,
				name: p.name,
				description: p.description,
			}))
		)

		// Call BAML to decide whether to assign to existing persona or create new one
		const personaDecision = await b.AssignPersonaToInterview(fullTranscript, intervieweeInfo, existingPersonasForBaml)

		consola.log("Persona assignment decision:", personaDecision)

		let personaId: string | null = null

		if (personaDecision.action === "assign_existing" && personaDecision.persona_id) {
			// Use existing persona
			personaId = personaDecision.persona_id
			consola.log(`Assigning to existing persona: ${personaDecision.persona_name} (${personaId})`)
		} else if (personaDecision.action === "create_new" && personaDecision.new_persona_data) {
			// Create new persona
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

		// Link person to persona if we have a valid persona ID
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
		// Don't fail the whole process if persona assignment fails
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

	// 5. Create tags from relatedTags array and populate junction tables
	// Collect all unique tags from all insights' relatedTags arrays
	const allTags = insights.flatMap((insight) => insight.relatedTags || [])
	const uniqueTags = [...new Set(allTags.filter(Boolean))]

	consola.log(`Creating ${uniqueTags.length} unique tags:`, uniqueTags)

	for (const tagName of uniqueTags) {
		// Upsert tag - use column names for ON CONFLICT
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

		// Link insights to tags based on relatedTags array
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

	// 6. Trigger persona-insight linking for all created insights
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

	// 7. Run research evidence analysis to link answers/evidence
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

	// 8. Update interview status to ready
	await db.from("interviews").update({ status: "ready" }).eq("id", interviewRecord.id)

	return { stored: data as InsightInsert[], interview: interviewRecord }
}
