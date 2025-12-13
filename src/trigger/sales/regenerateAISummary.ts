import { task } from "@trigger.dev/sdk"
import consola from "consola"

import { b } from "~/../baml_client"
import { createSupabaseAdminClient } from "~/lib/supabase/client.server"
import { workflowRetryConfig } from "~/utils/processInterview.server"

type Payload = {
	interviewId: string
	customInstructions?: string | null
	computedBy?: string | null
}

/**
 * Regenerate AI summary (conversation takeaways) for an interview.
 * Can be called with optional custom instructions to guide the AI's analysis.
 */
export const regenerateAISummaryTask = task({
	id: "sales.regenerate-ai-summary",
	retry: workflowRetryConfig,
	run: async (payload: Payload) => {
		const { interviewId, customInstructions } = payload
		const client = createSupabaseAdminClient()

		consola.info(`[regenerateAISummary] Starting for interview ${interviewId}`, {
			hasCustomInstructions: !!customInstructions,
		})

		// Fetch interview metadata
		const { data: interview, error: interviewError } = await client
			.from("interviews")
			.select("duration_sec")
			.eq("id", interviewId)
			.single()

		if (interviewError || !interview) {
			consola.error(`[regenerateAISummary] Error fetching interview ${interviewId}:`, interviewError)
			throw new Error(`Interview not found: ${interviewId}`)
		}

		// Fetch evidence items for this interview with linked person data
		const { data: evidenceItems, error: evidenceError } = await client
			.from("evidence")
			.select(`
				id,
				verbatim,
				gist,
				topic,
				method,
				anchors,
				evidence_people(
					person_id,
					people(name)
				)
			`)
			.eq("interview_id", interviewId)
			.order("created_at", { ascending: true })

		if (evidenceError) {
			consola.error(`[regenerateAISummary] Error fetching evidence:`, evidenceError)
			throw new Error(`Failed to fetch evidence for interview: ${interviewId}`)
		}

		if (!evidenceItems || evidenceItems.length === 0) {
			consola.warn(`[regenerateAISummary] No evidence found for ${interviewId}`)
			throw new Error(`No evidence found for interview: ${interviewId}`)
		}

		const durationMinutes = interview.duration_sec ? Math.round(interview.duration_sec / 60) : null

		// Fetch sales lens data for framework summaries
		const { data: salesLensData } = await client
			.from("sales_lens_data")
			.select("payload")
			.eq("source_id", interviewId)
			.eq("source_kind", "interview")
			.maybeSingle()

		const extraction = salesLensData?.payload || {}

		// Build summaries from extraction
		const bantFramework = extraction.frameworks?.find((f: any) => f.name === "BANT_GPCT")
		const meddicFramework = extraction.frameworks?.find((f: any) => f.name === "MEDDIC")

		// BANT has 4 key areas: Budget, Authority, Need, Timeline
		const bantCoreSlots = ["budget", "authority", "need", "timeline"]
		const bantCaptured =
			bantFramework?.slots?.filter((s: any) => bantCoreSlots.includes(s.slot) && (s.textValue || s.summary)) || []

		const bantSummary = bantFramework?.slots
			? `${bantCaptured.length}/4 areas identified: ${bantFramework.slots
					.map((s: any) => `${s.label}: ${s.textValue || s.summary || "Not captured"}`)
					.join("; ")}`
			: null

		const meddicSummary =
			meddicFramework?.slots?.map((s: any) => `${s.label}: ${s.textValue || s.summary || "Not captured"}`).join("; ") ||
			null

		const stakeholdersSummary =
			extraction.entities?.stakeholders?.map((s: any) => `${s.displayName} (${s.role || "Unknown role"})`).join(", ") ||
			null

		// Transform evidence to BAML format
		const evidenceForBaml = evidenceItems.map((e: any) => {
			// Extract speaker name from evidence_people join
			const speakerName = e.evidence_people?.[0]?.people?.name || null

			// Extract timestamp from anchors JSONB (first anchor's start_ms converted to seconds)
			const timestampMs = e.anchors?.[0]?.start_ms
			const timestampSec = timestampMs ? timestampMs / 1000 : null

			return {
				id: e.id,
				verbatim: e.verbatim || "",
				gist: e.gist || null,
				speaker: speakerName,
				evidence_type: e.topic || e.method || null,
				timestamp_start: timestampSec,
			}
		})

		// Log input summary for debugging
		consola.info(`[regenerateAISummary] Input summary:`, {
			interviewId,
			evidenceCount: evidenceItems.length,
			durationMinutes,
			hasBantSummary: !!bantSummary,
			hasMeddicSummary: !!meddicSummary,
			stakeholdersCount: extraction.entities?.stakeholders?.length || 0,
			topics: [...new Set(evidenceItems.map((e) => e.topic).filter(Boolean))],
			methods: [...new Set(evidenceItems.map((e) => e.method).filter(Boolean))],
			hasCustomInstructions: !!customInstructions,
		})

		// Call BAML function with evidence array and custom instructions
		consola.info(
			`[regenerateAISummary] Calling BAML ExtractConversationTakeaways with ${evidenceItems.length} evidence items...`
		)
		const takeaways = await b.ExtractConversationTakeaways(
			evidenceForBaml,
			bantSummary,
			meddicSummary,
			stakeholdersSummary,
			durationMinutes,
			customInstructions || null
		)

		consola.info(`[regenerateAISummary] BAML extraction completed`)

		// Combine into a single string for storage
		const keyTakeaways = [takeaways.value_synopsis, takeaways.critical_next_step, takeaways.future_improvement]
			.filter(Boolean)
			.join("\n")

		consola.info(`[regenerateAISummary] Generated takeaways (${keyTakeaways.length} chars):`, {
			value_synopsis: takeaways.value_synopsis?.substring(0, 100),
			critical_next_step: takeaways.critical_next_step?.substring(0, 100),
			future_improvement: takeaways.future_improvement?.substring(0, 100),
			supporting_evidence_count: takeaways.supporting_evidence_ids?.length || 0,
			supporting_evidence_ids: takeaways.supporting_evidence_ids?.map((id) => id.substring(0, 8)),
		})

		// Store in interviews table
		const { error: updateError } = await client.from("interviews").update({ key_takeaways: keyTakeaways }).eq("id", interviewId)

		if (updateError) {
			consola.error(`[regenerateAISummary] Failed to update interview ${interviewId}:`, updateError)
			throw new Error(`Failed to update interview: ${updateError.message}`)
		}

		consola.info(`[regenerateAISummary] Successfully stored takeaways for ${interviewId}`)

		return {
			interviewId,
			keyTakeaways,
			supporting_evidence_ids: takeaways.supporting_evidence_ids || [],
			hasCustomInstructions: !!customInstructions,
		}
	},
})
