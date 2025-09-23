// Import the BAML async client helper ("b"), following the official BoundaryML docs.
// After running `baml-cli generate`, all functions are exposed on this client.
// NOTE: tsconfig path alias `~` maps to `app/`, so baml_client (generated at project root)
// is accessible via `~/../baml_client`.
// Import BAML client - this file is server-only so it's safe to import directly

import type { SupabaseClient } from "@supabase/supabase-js"
import consola from "consola"
import { b } from "~/../baml_client"
import type { Database, Json } from "~/../supabase/types"
import { autoGroupThemesAndApply } from "~/features/themes/db.autoThemes.server"
import { createPlannedAnswersForInterview } from "~/lib/database/project-answers.server"
import { getServerClient } from "~/lib/supabase/server"
import type { InsightInsert, Interview, InterviewInsert } from "~/types" // path alias provided by project setup

// Supabase table types
type Tables = Database["public"]["Tables"]
type PeopleInsert = Tables["people"]["Insert"]
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
async function processInterviewTranscriptWithClient({
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
				duration_sec: (transcriptData as any).audio_duration
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

	// Use the exact return type from BAML to avoid drift
	type EvidenceFromBaml = Awaited<ReturnType<typeof b.ExtractEvidenceFromTranscript>>
	let evidenceUnits: EvidenceFromBaml | null = []
	// Track inserted evidence IDs to link to people later
	let insertedEvidenceIds: string[] = []

	try {
		consola.log("ExtractEvidence starting")
		evidenceUnits = await b.ExtractEvidenceFromTranscript(fullTranscript || "", chapters, language)
		consola.log("🔍 Raw BAML evidence response:", JSON.stringify(evidenceUnits, null, 2))

		if (evidenceUnits?.length) {
			// Map BAML EvidenceUnit -> DB rows
			const empathyStats = { says: 0, does: 0, thinks: 0, feels: 0, pains: 0, gains: 0 }
			const empathySamples: Record<keyof typeof empathyStats, string[]> = {
				says: [], does: [], thinks: [], feels: [], pains: [], gains: [],
			}

			const evidenceRows: EvidenceInsert[] = (evidenceUnits as EvidenceFromBaml["evidence"]).map((ev) => {
				const verb = sanitizeVerbatim((ev as unknown as { verbatim?: string })?.verbatim)
				if (!verb) return null
				const support = normalizeSupport((ev as unknown as { support?: string })?.support)
				const kind_tags = Array.isArray(ev.kind_tags)
					? (ev.kind_tags as string[])
					: Object.values(ev.kind_tags ?? {})
						.flat()
						.filter((x): x is string => typeof x === "string")
				const confidenceStr = (ev as unknown as { confidence?: EvidenceInsert["confidence"] })?.confidence ?? "medium"
				const weight_quality = confidenceStr === "high" ? 0.95 : confidenceStr === "low" ? 0.6 : 0.8
				const weight_relevance = confidenceStr === "high" ? 0.9 : confidenceStr === "low" ? 0.6 : 0.8
				const providedIndKey = (ev as unknown as { independence_key?: string })?.independence_key
				const independence_key = providedIndKey && providedIndKey.trim().length > 0
				  ? providedIndKey.trim()
				  : computeIndependenceKey(verb, kind_tags)
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
					weight_quality,
					weight_relevance,
					independence_key,
					confidence: confidenceStr,
					verbatim: verb,
					anchors: (ev.anchors ?? []) as unknown as Json,
				}

				// Empathy map facets (optional arrays)
				const _says = Array.isArray((ev as any).says) ? (ev as any).says as string[] : []
				const _does = Array.isArray((ev as any).does) ? (ev as any).does as string[] : []
				const _thinks = Array.isArray((ev as any).thinks) ? (ev as any).thinks as string[] : []
				const _feels = Array.isArray((ev as any).feels) ? (ev as any).feels as string[] : []
				const _pains = Array.isArray((ev as any).pains) ? (ev as any).pains as string[] : []
				const _gains = Array.isArray((ev as any).gains) ? (ev as any).gains as string[] : []
				;(row as unknown as Record<string, unknown>)["says"] = _says
				;(row as unknown as Record<string, unknown>)["does"] = _does
				;(row as unknown as Record<string, unknown>)["thinks"] = _thinks
				;(row as unknown as Record<string, unknown>)["feels"] = _feels
				;(row as unknown as Record<string, unknown>)["pains"] = _pains
				;(row as unknown as Record<string, unknown>)["gains"] = _gains

				// Update empathy stats + capture a few samples
				empathyStats.says += _says.length; empathyStats.does += _does.length
				empathyStats.thinks += _thinks.length; empathyStats.feels += _feels.length
				empathyStats.pains += _pains.length; empathyStats.gains += _gains.length
				for (const [k, arr] of Object.entries({ says: _says, does: _does, thinks: _thinks, feels: _feels, pains: _pains, gains: _gains }) as Array<[keyof typeof empathyStats, string[]]>) {
					for (const v of arr) {
						if (typeof v === "string" && v.trim() && empathySamples[k].length < 3) empathySamples[k].push(v.trim())
					}
				}
				const context_summary = (ev as unknown as { context_summary?: string })?.context_summary
				if (context_summary && typeof context_summary === "string" && context_summary.trim().length) {
					;(row as unknown as Record<string, unknown>)["context_summary"] = context_summary.trim()
				}
				return row
			})
			.filter((row): row is EvidenceInsert => row !== null)

			if (evidenceRows.length === 0) {
				consola.warn("No valid evidence rows after sanitization; skipping evidence insert")
			} else {
				try {
					const { data: insertedEvidence, error: evidenceInsertError } = await db
						.from("evidence")
						.insert(evidenceRows)
						.select("id, kind_tags")
					if (evidenceInsertError) throw new Error(`Failed to insert evidence: ${evidenceInsertError.message}`)
					insertedEvidenceIds = (insertedEvidence ?? []).map((e) => e.id)
					// Log empathy stats snapshot for observability
					consola.info("🧠 Empathy facets extracted", {
						counts: empathyStats,
						samples: empathySamples,
					})
					// Optionally upsert tags from kind_tags and link via evidence_tag
					try {
						// Build unique tag list
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

						// Link evidence -> tags
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
									.select()
									.single()
								if (etErr && !etErr.message?.includes("duplicate")) {
									consola.warn(`Failed linking evidence ${ev.id} to tag ${tagName}: ${etErr.message}`)
								}
							}
						}
					} catch (linkErr) {
						consola.warn("Failed to create/link tags for evidence", linkErr)
					}
				} catch (evidenceInsertErr) {
					consola.warn("Evidence insert phase failed; continuing", evidenceInsertErr)
				}
			}
		}
	} catch (evidenceExtractErr) {
		consola.warn("Evidence extraction phase failed; continuing", evidenceExtractErr)
	}

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

	const personName = interviewee?.name?.trim() || generateFallbackName()
	const personInsertData: PeopleInsert = {
		account_id: metadata.accountId,
		project_id: metadata.projectId,
		name: personName,
		description: interviewee?.participantDescription?.trim() || null,
		segment: interviewee?.segment?.trim() || metadata.segment || null,
		contact_info: interviewee?.contactInfo || null,
	}

	consola.log("Creating person with data:", personInsertData)
	const { data: personData, error: personError } = await db
		.from("people")
		.upsert(personInsertData, { onConflict: "account_id,name_hash" })
		.select("id")
		.single()
	if (personError) throw new Error(`Failed to upsert person: ${personError.message}`)
	if (!personData?.id) throw new Error("Person upsert succeeded but no ID returned")

	// Link evidence -> person via evidence_people for this interview's participant
	if (insertedEvidenceIds.length) {
		for (const evId of insertedEvidenceIds) {
			const { error: epErr } = await db.from("evidence_people").insert({
				evidence_id: evId,
				person_id: personData.id,
				account_id: metadata.accountId,
				project_id: metadata.projectId,
				role: "speaker",
			})
			if (epErr && !epErr.message?.includes("duplicate")) {
				consola.warn(`Failed linking evidence ${evId} to person ${personData.id}: ${epErr.message}`)
			}
		}
	}

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
				const evUnit = Array.isArray(evidenceUnits) ? evidenceUnits[i] as any : undefined
				const tags: string[] = Array.isArray(evUnit?.kind_tags)
					? evUnit.kind_tags
					: Object.values(evUnit?.kind_tags ?? {}).flat().filter((x: unknown): x is string => typeof x === "string")

				const matchCat = (tags || []).find((t) => knownCategories.has(String(t)))
				const qRep = matchCat ? categoryToQuestion.get(matchCat) : undefined
				if (!qRep) continue

				// See if answer already exists for (project_id, interview_id, question_id)
				let answerId: string | null = null
				let existingAnswer: Pick<Tables["project_answers"]["Row"], "id" | "answered_at" | "respondent_person_id" | "question_category" | "estimated_time_minutes" | "order_index" | "origin"> | null = null
				const { data: existingAns } = await db
					.from("project_answers")
					.select("id, answered_at, respondent_person_id, question_category, estimated_time_minutes, order_index, origin")
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
		} else {
			consola.info("interview_people already linked; skipping duplicate link", {
				interview_id: interviewRecord.id,
				person_id: personData.id,
			})
		}
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

	// 7. Update interview status to ready
	await db.from("interviews").update({ status: "ready" }).eq("id", interviewRecord.id)

	return { stored: data as InsightInsert[], interview: interviewRecord }
}
