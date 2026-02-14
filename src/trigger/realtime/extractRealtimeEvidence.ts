/**
 * Trigger.dev task for real-time evidence extraction from partial transcripts.
 * Designed for incremental processing during live recording sessions.
 * Uses BAML ExtractEvidenceFromTranscriptV2 on smaller batches with
 * metadata streaming to push results back to the client.
 */
import { b } from "baml_client"
import { logger, metadata, task } from "@trigger.dev/sdk"

export const extractRealtimeEvidence = task({
	id: "realtime.extract-evidence",
	retry: { maxAttempts: 2, factor: 1.5, minTimeoutInMs: 1000, maxTimeoutInMs: 10_000 },
	maxDuration: 120, // 2 minutes max for a realtime batch
	run: async (payload: {
		utterances: Array<{ speaker: string; text: string; start?: number | null; end?: number | null }>
		language: string
		batchIndex: number
		sessionId?: string
	}) => {
		const { utterances, language, batchIndex, sessionId } = payload

		metadata.set("status", "extracting")
		metadata.set("batchIndex", batchIndex)
		metadata.set("utteranceCount", utterances.length)
		if (sessionId) metadata.set("sessionId", sessionId)

		logger.info("Starting realtime evidence extraction", {
			batchIndex,
			utteranceCount: utterances.length,
			sessionId,
		})

			const result = await b.ExtractEvidenceFromTranscriptV2(
				utterances.map((u) => ({
					speaker: u.speaker,
					text: u.text,
					start: u.start ?? null,
					end: u.end ?? null,
				})),
				[], // no chapters for realtime
				language || "en",
			)

		const evidenceCount = result.evidence?.length || 0
		const peopleCount = result.people?.length || 0

		metadata.set("status", "complete")
		metadata.set("evidenceCount", evidenceCount)
		metadata.set("peopleCount", peopleCount)

		logger.info("Realtime evidence extraction complete", {
			batchIndex,
			evidenceCount,
			peopleCount,
		})

		return {
			evidence: result.evidence || [],
			people: result.people || [],
			scenes: result.scenes || [],
			interactionContext: result.interaction_context,
			contextConfidence: result.context_confidence,
			contextReasoning: result.context_reasoning,
			batchIndex,
		}
	},
})
