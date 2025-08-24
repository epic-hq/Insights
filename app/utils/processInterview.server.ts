// Import the BAML async client helper ("b"), following the official BoundaryML docs.
// After running `baml-cli generate`, all functions are exposed on this client.
// NOTE: tsconfig path alias `~` maps to `app/`, so baml_client (generated at project root)
// is accessible via `~/../baml_client`.
// Import BAML client - this file is server-only so it's safe to import directly
import consola from "consola"
import { b } from "~/../baml_client"
import { autoGroupThemesAndApply } from "~/features/themes/db.autoThemes.server"
import type { Database, Json } from "~/../supabase/types"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getServerClient } from "~/lib/supabase/server"
import type { InsightInsert, Interview, InterviewInsert } from "~/types" // path alias provided by project setup

// Supabase table types
type PeopleInsert = Database["public"]["Tables"]["people"]["Insert"]
type InterviewPeopleInsert = Database["public"]["Tables"]["interview_people"]["Insert"]
type PersonasRow = Database["public"]["Tables"]["personas"]["Row"]

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
}: {
	metadata: InterviewMetadata
	transcriptData: Record<string, unknown>
	mediaUrl: string
	userCustomInstructions?: string
	adminClient: SupabaseClient<Database>
}): Promise<ProcessingResult> {
	return await processInterviewTranscriptWithClient({
		metadata,
		mediaUrl,
		transcriptData,
		userCustomInstructions,
		client: adminClient,
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
}: {
	metadata: InterviewMetadata
	transcriptData: Record<string, unknown>
	mediaUrl: string
	userCustomInstructions?: string
	client: SupabaseClient<Database>
}): Promise<ProcessingResult> {
	// 1. Create the interview record early so downstream steps can reference it
	const fullTranscript = transcriptData.full_transcript as string
	// 1.a Create the interview record
	const interviewData: InterviewInsert = {
		account_id: metadata.accountId,
		project_id: metadata.projectId,
		title: metadata.interviewTitle || metadata.fileName,
		interview_date: metadata.interviewDate || new Date().toISOString().split("T")[0],
		participant_pseudonym: metadata.participantName || "Anonymous",
		segment: metadata.segment || null,
		// interviewer_name: metadata.interviewerName || null,
		media_url: mediaUrl || null,
		transcript: fullTranscript,
		transcript_formatted: transcriptData,
		duration_min: transcriptData.audio_duration ? Math.round((transcriptData.audio_duration as number) / 60) : null,
		status: "processing" as const,
	} as InterviewInsert

	const { data: interviewRecord, error: interviewError } = await db
		.from("interviews")
		.insert(interviewData)
		.select()
		.single()

	if (interviewError) {
		throw new Error(`Failed to create interview record: ${interviewError.message}`)
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
		const rawChapters = ((transcriptData as Record<string, unknown>).chapters as RawChapter[] | undefined)
			|| ((transcriptData as Record<string, unknown>).segments as RawChapter[] | undefined)
			|| []
		if (Array.isArray(rawChapters)) {
			chapters = rawChapters
				.map((c: RawChapter) => ({
					start_ms: typeof c.start_ms === "number" ? c.start_ms : (typeof c.start === "number" ? c.start : 0),
					end_ms: typeof c.end_ms === "number" ? c.end_ms : (typeof c.end === "number" ? c.end : undefined),
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

	try {
		consola.log('ExtractEvidence starting')
		evidenceUnits = await b.ExtractEvidenceFromTranscript(fullTranscript || "", chapters, language)
		consola.log(`Extracted ${evidenceUnits?.length || 0} evidence units`)
	} catch (e) {
		consola.warn("Evidence extraction failed; continuing without evidence", e)
	}

	if (evidenceUnits?.length) {
		// Map BAML EvidenceUnit -> DB rows
		const evidenceRows = evidenceUnits.map((ev: EvidenceFromBaml[number]) => ({
			account_id: metadata.accountId,
			project_id: metadata.projectId,
			interview_id: interviewRecord.id,
			source_type: "primary",
			method: "interview",
			modality: "qual",
			support: ev.support ?? "supports",
			kind_tags: Array.isArray(ev.kind_tags)
				? ev.kind_tags
				: (
					// ev.kind_tags could be a structured object; flatten its string arrays into a single array
					Object.values(ev.kind_tags ?? {})
						.flat()
						.filter((x): x is string => typeof x === "string")
				),
			personas: (ev.personas ?? []) as string[],
			segments: (ev.segments ?? []) as string[],
			journey_stage: ev.journey_stage || null,
			weight_quality: 0.8,
			weight_relevance: 0.8,
			confidence: ev.confidence ?? "medium",
			verbatim: ev.verbatim,
			anchors: (ev.anchors ?? []) as unknown as Json,
			created_by: metadata.userId,
			updated_by: metadata.userId,
		}))

		const { data: insertedEvidence, error: evidenceError } = await db
			.from("evidence")
			.insert(evidenceRows)
			.select("id, kind_tags")

		if (evidenceError) {
			consola.warn(`Failed to insert evidence: ${evidenceError.message}`)
		} else if (insertedEvidence?.length) {
			// Optionally upsert tags from kind_tags and link via evidence_tag
			try {
				// Build unique tag list
				const tagsSet = new Set<string>()
				const insertedEvidenceTyped = insertedEvidence as Array<{ id: string; kind_tags: string[] | null }>
				insertedEvidenceTyped.forEach((ev) => {
					; (ev.kind_tags || []).forEach((t) => {
						if (typeof t === "string" && t.trim()) tagsSet.add(t.trim())
					})
				})
				const tags = Array.from(tagsSet)

				const tagIdByName = new Map<string, string>()
				for (const tagName of tags) {
					const { data: tagRow, error: tagErr } = await db
						.from("tags")
						.upsert({ account_id: metadata.accountId, tag: tagName, project_id: metadata.projectId }, { onConflict: "account_id,tag" })
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
	const response = await b.ExtractInsights(fullTranscript, userCustomInstructions || "")
	consola.log("BAML response:", response)

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

	// Intelligent persona assignment using BAML
	let personaData: PersonasRow | null = null
	try {
		const { data: existingPersonas, error: personasError } = await db
			.from("personas")
			.select("*")
			.eq("account_id", metadata.accountId)
		if (personasError) consola.warn(`Failed to fetch existing personas: ${personasError.message}`)

		const intervieweeInfo = JSON.stringify({
			name: interviewee?.name || "Unknown",
			persona: interviewee?.persona || null,
			segment: interviewee?.segment || null,
			participantDescription: interviewee?.participantDescription || null,
			contactInfo: interviewee?.contactInfo || null,
		})
		const existingPersonasData = JSON.stringify(existingPersonas || [])

		const decision = await b.AssignPersonaToInterview(
			interviewRecord.transcript || "",
			intervieweeInfo,
			existingPersonasData,
		)
		consola.log(`Persona assignment decision: ${decision.action} (confidence: ${decision.confidence_score})`)
		consola.log(`Reasoning: ${decision.reasoning}`)

		if (decision.action === "assign_existing" && decision.persona_id) {
			const existingPersona = existingPersonas?.find((p: PersonasRow) => p.id === decision.persona_id)
			if (existingPersona) {
				personaData = existingPersona
				consola.log(`Assigned to existing persona: ${existingPersona.name}`)
			} else {
				consola.warn(`Persona ID ${decision.persona_id} not found, falling back to creation`)
			}
		}

		if (decision.action === "create_new" && decision.new_persona_data) {
			const newPersonaInsert = {
				account_id: metadata.accountId,
				project_id: metadata.projectId,
				name: decision.new_persona_data.name,
				description: decision.new_persona_data.description || `Auto-generated from interview: ${interviewRecord.title}`,
				age: decision.new_persona_data.age,
				gender: decision.new_persona_data.gender,
				location: decision.new_persona_data.location,
				education: decision.new_persona_data.education,
				occupation: decision.new_persona_data.occupation,
				income: decision.new_persona_data.income,
				languages: decision.new_persona_data.languages,
				segment: decision.new_persona_data.segment,
				role: decision.new_persona_data.role,
				color_hex: decision.new_persona_data.color_hex,
				image_url: decision.new_persona_data.image_url,
				percentage: decision.new_persona_data.percentage,
			}
			const { data: newPersona, error: createError } = await db
				.from("personas")
				.insert(newPersonaInsert)
				.select("*")
				.single()
			if (createError) consola.warn(`Failed to create new persona: ${createError.message}`)
			else {
				personaData = newPersona
				consola.log(`Created new persona: ${newPersona.name}`)
			}
		}

		if (!personaData && interviewee?.persona?.trim()) {
			const personaName = interviewee.persona.trim()
			consola.log(`Fallback: Creating simple persona for "${personaName}"`)
			const { data: fallbackPersona, error: fallbackError } = await db
				.from("personas")
				.insert({
					account_id: metadata.accountId,
					project_id: metadata.projectId,
					name: personaName,
					description: `Auto-generated from interview: ${interviewRecord.title}`,
				})
				.select("*")
				.single()
			if (!fallbackError) {
				personaData = fallbackPersona
				consola.log(`Created fallback persona: ${personaName}`)
			}
		}
	} catch (error) {
		consola.error(`Error in intelligent persona assignment: ${error}`)
		if (interviewee?.persona?.trim()) {
			const personaName = interviewee.persona.trim()
			consola.log(`BAML failed, using simple fallback for "${personaName}"`)
			const { data: simplePersona, error: simpleError } = await db
				.from("personas")
				.insert({
					account_id: metadata.accountId,
					project_id: metadata.projectId,
					name: personaName,
					description: `Auto-generated from interview: ${interviewRecord.title}`,
				})
				.select("*")
				.single()
			if (!simpleError) {
				personaData = simplePersona
				consola.log(`Created simple fallback persona: ${personaName}`)
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

	if (personaData?.id) {
		const { error: personaLinkError } = await db.from("people_personas").upsert(
			{
				person_id: personData.id,
				persona_id: personaData.id,
				interview_id: interviewRecord.id,
				project_id: metadata.projectId,
				confidence_score: 1.0,
				source: "ai_extraction",
			},
			{ onConflict: "person_id,persona_id" },
		)
		if (personaLinkError) consola.warn(`Failed to link person to persona: ${personaLinkError.message}`)
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
