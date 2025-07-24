// Import the BAML async client helper ("b"), following the official BoundaryML docs.
// After running `baml-cli generate`, all functions are exposed on this client.
// NOTE: tsconfig path alias `~` maps to `app/`, so baml_client (generated at project root)
// is accessible via `~/../baml_client`.
// Import BAML client - this file is server-only so it's safe to import directly
import { b } from "~/../baml_client"
import { getServerClient } from "~/lib/supabase/server"
import type { Database } from "~/../supabase/types"
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
	transcript,
	userCustomInstructions,
	request,
}: {
	metadata: InterviewMetadata
	transcript: string
	mediaUrl: string
	userCustomInstructions?: string
	request: Request
}): Promise<ProcessingResult> {
	// Create authenticated client to respect RLS policies
	const { client: db } = getServerClient(request)

	// 1. Call the BAML process – this will invoke OpenAI GPT-4o under the hood
	// Per BAML conventions, call the generated function directly on the `b` client.
	// The function name must match the declaration in `baml_src/extract_insights.baml`.
	const response = await b.ExtractInsights(transcript, userCustomInstructions || "")

	// Extract insights from the BAML response
	const { insights, interviewee, highImpactThemes, openQuestionsAndNextSteps, observationsAndNotes } = response

	// 2. First, create the interview record
	const interviewData: InterviewInsert = {
		account_id: metadata.accountId,
		title: metadata.interviewTitle || "Untitled Interview",
		interview_date: metadata.interviewDate || new Date().toISOString().split("T")[0],
		participant_pseudonym: metadata.participantName || "Anonymous",
		segment: metadata.segment || null,
		// interviewer_name: metadata.interviewerName || null,
		media_url: mediaUrl || null,
		transcript,
		duration_min: metadata.durationMin || null,
		status: "processing" as const,
		...(metadata.projectId ? { project_id: metadata.projectId } : {}),
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
	const rows: InsightInsert[] = insights.map((i) => ({
		account_id: metadata.accountId,
		interview_id: interviewRecord.id,
		name: i.name, // Database uses 'name' field, not 'tag'
		category: i.category,
		journey_stage: i.journeyStage ?? null, // BAML uses camelCase
		jtbd: i.jtbd ?? null,
		details: i.details ?? null,
		evidence: i.evidence ?? null,
		motivation: i.underlyingMotivation ?? null, // BAML uses different field name
		pain: i.pain ?? null,
		desired_outcome: i.desiredOutcome ?? null, // BAML uses camelCase
		emotional_response: i.emotionalResponse ?? null, // BAML uses camelCase
		opportunity_ideas: i.opportunityIdeas ?? null, // BAML uses camelCase
		confidence: i.confidence ? (i.confidence > 3 ? "high" : i.confidence > 1 ? "medium" : "low") : null, // Convert number to enum
		contradictions: i.contradictions ?? null,
		impact: i.impact ?? null,
		novelty: i.novelty ?? null,
	}))

	// 4. Bulk upsert insights into Supabase
	const { data, error } = await db.from("insights").insert(rows).select()
	if (error) throw new Error(`Failed to insert insights: ${error.message}`)

	// 4.1 Upsert person and link to interview
	if (interviewee?.name && interviewee.name.trim()) {
		// Prepare person data with proper typing
		const personInsertData: PeopleInsert = {
			account_id: metadata.accountId,
			name: interviewee.name.trim(),
			description: interviewee.participantDescription?.trim() || null,
			segment: interviewee.segment?.trim() || null,
			contact_info: interviewee.contactInfo || null,
		}

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

		// Find persona by name or use null for "Other"
		let personaData: PersonasRow | null = null
		if (interviewee.persona?.trim()) {
			const { data, error: personaError } = await db
				.from("personas")
				.select("*")
				.eq("account_id", metadata.accountId)
				.ilike("name", interviewee.persona.trim())
				.maybeSingle()

			if (personaError) {
				console.warn(`Failed to lookup persona "${interviewee.persona}": ${personaError.message}`)
			} else {
				personaData = data
			}
		}

		// Insert into interview_people junction table
		const junctionData: InterviewPeopleInsert = {
			interview_id: interviewRecord.id,
			person_id: personData.id,
			role: "participant",
		}

		const { error: junctionError } = await db
			.from("interview_people")
			.insert(junctionData)

		if (junctionError) {
			throw new Error(`Failed to link person to interview: ${junctionError.message}`)
		}

		// Update person with persona reference if found
		if (personaData?.id) {
			const { error: updateError } = await db
				.from("people")
				.update({ persona_id: personaData.id })
				.eq("id", personData.id)

			if (updateError) {
				console.warn(`Failed to update person with persona: ${updateError.message}`)
			}
		}
	}

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

	// 5. Update interview status to ready
	await db.from("interviews").update({ status: "ready" }).eq("id", interviewRecord.id)

	return { stored: data as InsightInsert[], interview: interviewRecord }
}
