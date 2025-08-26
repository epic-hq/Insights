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
import { getServerClient } from "~/lib/supabase/server"
import type { InsightInsert, Interview, InterviewInsert } from "~/types" // path alias provided by project setup

// Supabase table types
type PeopleInsert = Database["public"]["Tables"]["people"]["Insert"]
type InterviewPeopleInsert = Database["public"]["Tables"]["interview_people"]["Insert"]
type EvidenceInsert = Database["public"]["Tables"]["evidence"]["Insert"]

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
				duration_min: (transcriptData as any).audio_duration
					? Math.round(((transcriptData as any).audio_duration as number) / 60)
					: (existing.duration_min ?? null),
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
			duration_min: (transcriptData as any).audio_duration
				? Math.round(((transcriptData as any).audio_duration as number) / 60)
				: null,
			status: "processing" as const,
		} as InterviewInsert

		const { data: created, error: interviewError } = await db.from("interviews").insert(interviewData).select().single()
		if (interviewError || !created) {
			throw new Error(`Failed to create interview record: ${interviewError?.message}`)
		}
		interviewRecord = created as unknown as Interview
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

		if (evidenceUnits?.length) {
			// Map BAML EvidenceUnit -> DB rows
			const evidenceRows: EvidenceInsert[] = evidenceUnits
				.map((ev: EvidenceFromBaml[number]) => {
					const verb = sanitizeVerbatim(ev.verbatim)
					if (!verb) return null
					const support = normalizeSupport((ev as unknown as { support?: string })?.support)
					const kind_tags = Array.isArray(ev.kind_tags)
						? (ev.kind_tags as string[])
						: Object.values(ev.kind_tags ?? {})
								.flat()
								.filter((x): x is string => typeof x === "string")
					const row: EvidenceInsert = {
						account_id: metadata.accountId,
						project_id: (metadata.projectId ?? null) as any,
						interview_id: interviewRecord.id,
						source_type: "primary",
						method: "interview",
						modality: "qual",
						support,
						kind_tags,
						personas: (ev.personas ?? []) as string[],
						segments: (ev.segments ?? []) as string[],
						journey_stage: ev.journey_stage || null,
						weight_quality: 0.8,
						weight_relevance: 0.8,
						confidence: (ev as unknown as { confidence?: EvidenceInsert["confidence"] })?.confidence ?? "medium",
						verbatim: verb,
						anchors: (ev.anchors ?? []) as unknown as Json,
					}
					return row
				})
				.filter((row): row is EvidenceInsert => row !== null)

			if (evidenceRows.length === 0) {
				consola.warn("No valid evidence rows after sanitization; skipping evidence insert")
			}

			const { data: insertedEvidence, error: evidenceError } = evidenceRows.length
				? await db.from("evidence").insert(evidenceRows).select("id, kind_tags")
				: { data: [] as Array<{ id: string; kind_tags: string[] | null }>, error: null as null }

			if (evidenceError) {
				consola.warn(`Failed to insert evidence: ${evidenceError.message}`)
			} else if (insertedEvidence?.length) {
				// Stash IDs for later linking to people
				try {
					insertedEvidenceIds = (insertedEvidence as Array<{ id: string }>).map((e) => e.id)
				} catch {}
				// Optionally upsert tags from kind_tags and link via evidence_tag
				try {
					// Build unique tag list
					const tagsSet = new Set<string>()
					const insertedEvidenceTyped = insertedEvidence as Array<{ id: string; kind_tags: string[] | null }>
					insertedEvidenceTyped.forEach((ev) => {
						;(ev.kind_tags || []).forEach((t) => {
							if (typeof t === "string" && t.trim()) tagsSet.add(t.trim())
						})
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
			}
		}
	} catch (evidenceExtractErr) {
		consola.warn("Evidence extraction/insert phase failed; continuing", evidenceExtractErr)
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
		consola.log("BAML response:", response)
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

	const junctionData: InterviewPeopleInsert = {
		interview_id: interviewRecord.id,
		person_id: personData.id,
		role: "participant",
		project_id: metadata.projectId,
	}
	const { error: junctionError } = await db.from("interview_people").insert(junctionData)
	if (junctionError) throw new Error(`Failed to link person to interview: ${junctionError.message}`)

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
