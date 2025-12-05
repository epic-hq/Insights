/**
 * Apply a single conversation lens to an interview
 *
 * Uses the generic ApplyConversationLens BAML function that works with any template.
 * The template definition from the database drives the extraction - no hardcoded logic.
 * Results are stored in conversation_lens_analyses.analysis_data as flexible JSONB.
 */

import { task } from "@trigger.dev/sdk"
import consola from "consola"

import { b } from "~/../baml_client"
import { createSupabaseAdminClient } from "~/lib/supabase/client.server"
import { workflowRetryConfig } from "~/utils/processInterview.server"

export type ApplyLensPayload = {
	interviewId: string
	templateKey: string
	accountId: string
	projectId?: string | null
	computedBy?: string | null
	customInstructions?: string | null
}

type InterviewParticipant = {
	person_id: string
	display_name: string | null
	role: string | null
}

/**
 * Build interview context string for BAML prompts
 */
function buildInterviewContext(interview: {
	title?: string | null
	interview_date?: string | null
	duration_sec?: number | null
}): string {
	const parts: string[] = []
	if (interview.title) parts.push(`Title: ${interview.title}`)
	if (interview.interview_date) parts.push(`Date: ${interview.interview_date}`)
	if (interview.duration_sec) parts.push(`Duration: ${Math.round(interview.duration_sec / 60)} minutes`)
	return parts.join("\n") || "No context available"
}

/**
 * Match a name string to interview participants
 * Returns the matched participant or null
 */
function matchNameToParticipant(
	name: string | null | undefined,
	participants: InterviewParticipant[]
): InterviewParticipant | null {
	if (!name || participants.length === 0) return null

	const nameLower = name.toLowerCase().trim()

	// Try exact match first
	const exactMatch = participants.find(
		(p) => p.display_name?.toLowerCase().trim() === nameLower
	)
	if (exactMatch) return exactMatch

	// Try partial match (name contains or is contained by)
	const partialMatch = participants.find(
		(p) =>
			p.display_name?.toLowerCase().includes(nameLower) ||
			nameLower.includes(p.display_name?.toLowerCase() || "")
	)
	if (partialMatch) return partialMatch

	// Try first name match
	const firstName = nameLower.split(" ")[0]
	if (firstName.length > 2) {
		const firstNameMatch = participants.find(
			(p) => p.display_name?.toLowerCase().startsWith(firstName)
		)
		if (firstNameMatch) return firstNameMatch
	}

	return null
}

/**
 * Post-process extraction result to match entity names to people records
 */
function enrichEntitiesWithPeople(
	result: any,
	participants: InterviewParticipant[]
): any {
	if (!result?.entities || participants.length === 0) return result

	// Process each entity type
	for (const entityResult of result.entities || []) {
		if (!entityResult.items) continue

		entityResult.items = entityResult.items.map((item: any, idx: number) => {
			// Try to match name field to participants
			const matched = matchNameToParticipant(item.name, participants)
			return {
				...item,
				person_id: matched?.person_id || null,
				entity_key: `${entityResult.entity_type}-${idx}`,
				candidate_name: matched ? null : item.name,
			}
		})
	}

	return result
}

export const applyLensTask = task({
	id: "lens.apply-lens",
	retry: workflowRetryConfig,
	run: async (payload: ApplyLensPayload) => {
		const { interviewId, templateKey, accountId, projectId, computedBy, customInstructions } = payload
		const client = createSupabaseAdminClient()

		consola.info(`[applyLens] Applying ${templateKey} to interview ${interviewId}`)

		// 1. Load template definition from database
		type TemplateRow = {
			template_key: string
			template_name: string
			template_definition: any
			is_active: boolean
		}

		const { data: template, error: templateError } = await (client as any)
			.from("conversation_lens_templates")
			.select("template_key, template_name, template_definition, is_active")
			.eq("template_key", templateKey)
			.single() as { data: TemplateRow | null; error: any }

		if (templateError || !template) {
			throw new Error(`Template not found: ${templateKey}`)
		}

		if (!template.is_active) {
			consola.warn(`[applyLens] Template ${templateKey} is not active, skipping`)
			return { skipped: true, reason: "template_inactive" }
		}

		// 2. Load interview
		type InterviewRow = {
			id: string
			title: string | null
			interview_date: string | null
			duration_sec: number | null
			lens_visibility: string | null
			project_id: string | null
		}

		const { data: interview, error: interviewError } = await (client as any)
			.from("interviews")
			.select("id, title, interview_date, duration_sec, lens_visibility, project_id")
			.eq("id", interviewId)
			.single() as { data: InterviewRow | null; error: any }

		if (interviewError) {
			consola.error(`[applyLens] Supabase error loading interview:`, interviewError)
			throw new Error(`Failed to load interview ${interviewId}: ${interviewError.message}`)
		}
		if (!interview) {
			throw new Error(`Interview not found: ${interviewId}`)
		}

		// Skip if private
		if (interview.lens_visibility === "private") {
			consola.info(`[applyLens] Skipping private interview ${interviewId}`)
			return { skipped: true, reason: "private" }
		}

		// 3. Load evidence
		type EvidenceRow = {
			id: string
			gist: string | null
			verbatim: string | null
			chunk: string | null
			anchors: any | null
			created_at: string
		}

		const { data: evidence, error: evidenceError } = await (client as any)
			.from("evidence")
			.select("id, gist, verbatim, chunk, anchors, created_at")
			.eq("interview_id", interviewId)
			.order("created_at", { ascending: true }) as { data: EvidenceRow[] | null; error: any }

		if (evidenceError) {
			throw new Error(`Failed to load evidence: ${evidenceError.message}`)
		}

		if (!evidence || evidence.length === 0) {
			consola.warn(`[applyLens] No evidence for interview ${interviewId}, storing empty analysis`)
			await (client as any).from("conversation_lens_analyses").upsert(
				{
					interview_id: interviewId,
					template_key: templateKey,
					account_id: accountId,
					project_id: projectId,
					analysis_data: { sections: [], entities: [], recommendations: [] },
					confidence_score: 0,
					auto_detected: true,
					status: "completed",
					processed_at: new Date().toISOString(),
					processed_by: computedBy,
				},
				{ onConflict: "interview_id,template_key" }
			)
			return { templateKey, success: true, evidenceCount: 0 }
		}

		// 4. Load interview participants for person matching
		type ParticipantRow = {
			person_id: string
			role: string | null
			people: {
				id: string
				name: string | null
			} | null
		}

		const { data: participantData } = await (client as any)
			.from("interview_people")
			.select("person_id, role, people(id, name)")
			.eq("interview_id", interviewId) as { data: ParticipantRow[] | null; error: any }

		const participants: InterviewParticipant[] = (participantData || []).map((p) => ({
			person_id: p.person_id,
			display_name: p.people?.name || null,
			role: p.role,
		}))

		consola.info(`[applyLens] Loaded ${participants.length} participants for person matching`)

		// 5. Call the generic BAML function
		const evidenceJson = JSON.stringify(evidence)
		const interviewContext = buildInterviewContext(interview)
		const templateDefinition = JSON.stringify(template.template_definition)

		let extraction: any = null
		try {
			consola.info(`[applyLens] Calling ApplyConversationLens for ${template.template_name}`)
			extraction = await b.ApplyConversationLens(
				templateDefinition,
				template.template_name,
				evidenceJson,
				interviewContext,
				customInstructions || null
			)
		} catch (error) {
			consola.error(`[applyLens] BAML extraction failed for ${templateKey}:`, error)
			// Store failed status
			await (client as any).from("conversation_lens_analyses").upsert(
				{
					interview_id: interviewId,
					template_key: templateKey,
					account_id: accountId,
					project_id: projectId,
					analysis_data: {},
					confidence_score: 0,
					auto_detected: true,
					status: "failed",
					error_message: error instanceof Error ? error.message : String(error),
					processed_at: new Date().toISOString(),
					processed_by: computedBy,
				},
				{ onConflict: "interview_id,template_key" }
			)
			throw error
		}

		// 6. Enrich entities with person matching
		const enrichedResult = enrichEntitiesWithPeople(extraction, participants)

		// 7. Store result - the BAML result format matches what we store
		const analysisData = {
			sections: enrichedResult.sections || [],
			entities: enrichedResult.entities || [],
			recommendations: enrichedResult.recommendations || [],
			processing_notes: enrichedResult.processing_notes,
		}

		const { error: upsertError } = await (client as any).from("conversation_lens_analyses").upsert(
			{
				interview_id: interviewId,
				template_key: templateKey,
				account_id: accountId,
				project_id: projectId,
				analysis_data: analysisData,
				confidence_score: enrichedResult.overall_confidence || 0.5,
				auto_detected: true,
				status: "completed",
				processed_at: new Date().toISOString(),
				processed_by: computedBy,
			},
			{ onConflict: "interview_id,template_key" }
		)

		if (upsertError) {
			throw new Error(`Failed to store analysis: ${upsertError.message}`)
		}

		consola.success(`[applyLens] ✓ Applied ${templateKey} to ${interviewId} (confidence: ${(enrichedResult.overall_confidence || 0.5).toFixed(2)})`)

		return {
			templateKey,
			success: true,
			evidenceCount: evidence.length,
			confidenceScore: enrichedResult.overall_confidence || 0.5,
		}
	},
})
