// Import the BAML async client helper ("b"), following the official BoundaryML docs.
// After running `baml-cli generate`, all functions are exposed on this client.
// NOTE: tsconfig path alias `~` maps to `app/`, so baml_client (generated at project root)
// is accessible via `~/../baml_client`.
// Import BAML client - this file is server-only so it's safe to import directly
import { b } from "~/../baml_client"

import type { InsightInsert, Interview, InterviewInsert } from "~/types" // path alias provided by project setup
import { db } from "~/utils/supabase.server"

export interface ProcessingResult {
	stored: InsightInsert[]
	interview: Interview
}

export interface InterviewMetadata {
	orgId: string
	projectId?: string
	interviewTitle?: string
	interviewDate?: string
	interviewerName?: string
	participantName?: string
	segment?: string
	contact?: string
	duration?: int
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
export async function processInterviewTranscript(
	metadata: InterviewMetadata,
	transcript: string
): Promise<ProcessingResult> {
	// 1. Call the BAML process – this will invoke OpenAI GPT-4o under the hood
	// Per BAML conventions, call the generated function directly on the `b` client.
	// The function name must match the declaration in `baml_src/extract_insights.baml`.
	const response = await b.ExtractInsights(transcript, "")

	// Extract insights from the BAML response
	const { insights, interviewee, highImpactThemes, openQuestionsAndNextSteps, observationsAndNotes } = response

	// 2. First, create the interview record
	const interviewData: InterviewInsert = {
		org_id: metadata.orgId,
		title: metadata.interviewTitle || "Untitled Interview",
		interview_date: metadata.interviewDate || new Date().toISOString().split("T")[0],
		participant_pseudonym: metadata.participantName || "Anonymous",
		segment: metadata.segment || null,
		transcript,
		contact: metadata.contact || null,
		duration: metadata.duration || null,
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
		org_id: metadata.orgId,
		interview_id: interviewRecord.id,
		name: i.name, // Database uses 'name' field, not 'tag'
		category: i.category,
		journey_stage: i.journeyStage ?? null, // BAML uses camelCase
		jtbd: i.jtbd ?? null,
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

	// 4.1 Insert interviewee if present
	if (interviewee) {
		await db.from("interviewee").insert({
			org_id: metadata.orgId,
			interview_id: interviewRecord.id,
			name: interviewee.name || null,
			persona: interviewee.persona || null,
			participant_description: interviewee.participantDescription || null,
			segment: interviewee.segment || null,

		})
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
