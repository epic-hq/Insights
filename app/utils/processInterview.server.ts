// Import the BAML async client helper ("b"), following the official BoundaryML docs.
// After running `baml-cli generate`, all functions are exposed on this client.
// NOTE: tsconfig path alias `~` maps to `app/`, so baml_client (generated at project root)
// is accessible via `~/../baml_client`.
// Import BAML client - this file is server-only so it's safe to import directly
import consola from "consola"
import { b } from "~/../baml_client"
import type { Database } from "~/../supabase/types"
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

	// 1. Call the BAML process – this will invoke OpenAI GPT-4o under the hood
	// Per BAML conventions, call the generated function directly on the `b` client.
	// The function name must match the declaration in `baml_src/extract_insights.baml`.
	const fullTranscript = transcriptData.full_transcript as string
	const response = await b.ExtractInsights(fullTranscript, userCustomInstructions || "")
	consola.log("BAML response:", response)

	// Extract insights from the BAML response
	const { insights, interviewee, highImpactThemes, openQuestionsAndNextSteps, observationsAndNotes } = response

	// 2. First, create the interview record
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

	if (!insights?.length) {
		// Update interview status to ready even if no insights
		await db.from("interviews").update({ status: "ready" }).eq("id", interviewRecord.id)

		return { stored: [], interview: interviewRecord }
	}

	// 3. Transform insights into DB rows - map BAML types to database schema
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
	}))

	// 4. Bulk upsert insights into Supabase
	const { data, error } = await db.from("insights").insert(rows).select()
	if (error) throw new Error(`Failed to insert insights: ${error.message}`)

	// 4.1 Upsert person and link to interview - ALWAYS create a person record
	// Smart fallback naming: use AI-extracted name, or generate from filename/metadata
	const generateFallbackName = (): string => {
		// Try filename first (remove extension and clean up)
		if (metadata.fileName) {
			const nameFromFile = metadata.fileName
				.replace(/\.[^/.]+$/, "") // Remove extension
				.replace(/[_-]/g, " ") // Replace underscores/hyphens with spaces
				.replace(/\b\w/g, (l) => l.toUpperCase()) // Title case
				.trim()

			if (nameFromFile.length > 0) {
				return `Participant (${nameFromFile})`
			}
		}

		// Fallback to interview title or generic name
		if (metadata.interviewTitle && !metadata.interviewTitle.includes("Interview -")) {
			return `Participant (${metadata.interviewTitle})`
		}

		// Final fallback with timestamp
		const timestamp = new Date().toISOString().split("T")[0]
		return `Participant (${timestamp})`
	}

	// Determine the person name: AI-extracted name or smart fallback
	const personName = interviewee?.name?.trim() || generateFallbackName()

	// Prepare person data with proper typing
	const personInsertData: PeopleInsert = {
		account_id: metadata.accountId,
		project_id: metadata.projectId,
		name: personName,
		description: interviewee?.participantDescription?.trim() || null,
		segment: interviewee?.segment?.trim() || metadata.segment || null,
		contact_info: interviewee?.contactInfo || null,
	}

	consola.log("Creating person with data:", personInsertData)

	// Upsert person by normalized name + account_id
	const { data: personData, error: personError } = await db
		.from("people")
		.upsert(personInsertData, { onConflict: "account_id,name_hash" })
		.select("id")
		.single()

	if (personError) {
		throw new Error(`Failed to upsert person: ${personError.message}`)
	}

	if (!personData?.id) {
		throw new Error("Person upsert succeeded but no ID returned")
	}

	// Find or create persona
	let personaData: PersonasRow | null = null
	if (interviewee?.persona?.trim()) {
		const personaName = interviewee.persona.trim()

		// First try to find existing persona
		const { data: existingPersona, error: lookupError } = await db
			.from("personas")
			.select("*")
			.eq("account_id", metadata.accountId)
			.ilike("name", personaName)
			.maybeSingle()

		if (lookupError) {
			consola.warn(`Failed to lookup persona "${personaName}": ${lookupError.message}`)
		} else if (existingPersona) {
			personaData = existingPersona
			consola.log(`Found existing persona: ${personaName}`)
		} else {
			// Create new persona if not found
			const { data: newPersona, error: createError } = await db
				.from("personas")
				.insert({
					account_id: metadata.accountId,
					project_id: metadata.projectId,
					name: personaName,
					description: `Auto-generated from interview: ${interviewRecord.title}`,
				})
				.select("*")
				.single()

			if (createError) {
				consola.warn(`Failed to create persona "${personaName}": ${createError.message}`)
			} else {
				personaData = newPersona
				consola.log(`Created new persona: ${personaName}`)
			}
		}
	}

	// Insert into interview_people junction table
	const junctionData: InterviewPeopleInsert = {
		interview_id: interviewRecord.id,
		person_id: personData.id,
		role: "participant",
		project_id: metadata.projectId,
	}

	const { error: junctionError } = await db.from("interview_people").insert(junctionData)

	if (junctionError) {
		throw new Error(`Failed to link person to interview: ${junctionError.message}`)
	}

	// Link person to persona via junction table if found
	if (personaData?.id) {
		const { error: personaLinkError } = await db
			.from("people_personas")
			.upsert({
				person_id: personData.id,
				persona_id: personaData.id,
				interview_id: interviewRecord.id,
				project_id: metadata.projectId,
				confidence_score: 1.0,
				source: 'ai_extraction'
			}, {
				onConflict: 'person_id,persona_id'
			})

		if (personaLinkError) {
			consola.warn(`Failed to link person to persona: ${personaLinkError.message}`)
		}
	}

	consola.log(`Successfully created/linked person "${personName}" to interview ${interviewRecord.id}`)

	// 4.2 Update interview with additional BAML fields
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
	const allTags = insights.flatMap(insight => insight.relatedTags || [])
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

			if (junctionError && !junctionError.message.includes('duplicate')) {
				consola.warn(`Failed to link insight ${storedInsight.id} to tag ${tagName}: ${junctionError.message}`)
			}
		}
	}

	// 6. Trigger persona-insight linking for all created insights
	if (data?.length) {
		for (const insight of data) {
			const { error: personaLinkError } = await db.rpc('auto_link_persona_insights', {
				p_insight_id: insight.id
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
