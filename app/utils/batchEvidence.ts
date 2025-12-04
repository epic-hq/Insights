/**
 * Batch Evidence Extraction Utility
 *
 * Splits large transcripts into batches and processes them in parallel
 * for faster extraction using GPT-4o-mini.
 */

import consola from "consola"

type SpeakerUtterance = {
	speaker: string
	text: string
	start: number | string | null
	end: number | string | null
}

type EvidenceResult = {
	people: any[]
	evidence: any[]
	facet_mentions: any[]
	scenes: any[]
}

const BATCH_SIZE = 75 // Process ~75 utterances per batch

export async function batchExtractEvidence(
	speakerTranscripts: SpeakerUtterance[],
	extractFn: (batch: SpeakerUtterance[]) => Promise<EvidenceResult>
): Promise<EvidenceResult> {
	const ENABLE_BATCHING = speakerTranscripts.length > BATCH_SIZE

	if (!ENABLE_BATCHING) {
		// Single call for small transcripts
		consola.info(`⚡ Single-batch mode: ${speakerTranscripts.length} utterances (≤${BATCH_SIZE}, batching disabled)`)
		const startTime = Date.now()
		const result = await extractFn(speakerTranscripts)
		const duration = ((Date.now() - startTime) / 1000).toFixed(1)
		consola.success(`✅ Single batch completed in ${duration}s`)
		return result
	}

	consola.info(`🚀 Batching enabled: processing ${speakerTranscripts.length} utterances in chunks of ${BATCH_SIZE}`)

	// Split into batches
	const batches: SpeakerUtterance[][] = []
	for (let i = 0; i < speakerTranscripts.length; i += BATCH_SIZE) {
		batches.push(speakerTranscripts.slice(i, i + BATCH_SIZE))
	}

	consola.info(`📦 Created ${batches.length} batches`)

	// Process batches in parallel
	const batchPromises = batches.map(async (batch, batchIndex) => {
		const batchStart = Date.now()
		consola.info(`⏳ Batch ${batchIndex + 1}/${batches.length}: processing ${batch.length} utterances`)

		const result = await extractFn(batch)

		const batchDuration = ((Date.now() - batchStart) / 1000).toFixed(1)
		consola.success(`✅ Batch ${batchIndex + 1}/${batches.length}: completed in ${batchDuration}s`)

		return { result, batchIndex }
	})

	const batchResults = await Promise.all(batchPromises)

	// Merge results
	const mergedPeople: any[] = []
	const mergedEvidence: any[] = []
	const mergedFacetMentions: any[] = []
	const mergedScenes: any[] = []

	for (const { result } of batchResults) {
		// Merge people (dedupe by person_key)
		for (const person of result.people || []) {
			if (!mergedPeople.find((p) => p.person_key === person.person_key)) {
				mergedPeople.push(person)
			}
		}

		// Merge evidence with corrected indices
		const evidenceOffset = mergedEvidence.length
		for (const evidence of result.evidence || []) {
			mergedEvidence.push(evidence)

			// Merge nested facet_mentions with corrected parent_index
			if (Array.isArray(evidence.facet_mentions)) {
				for (const mention of evidence.facet_mentions) {
					mergedFacetMentions.push({
						...mention,
						parent_index: evidenceOffset + (mention.parent_index || 0),
					})
				}
			}
		}

		// Merge scenes with corrected indices
		for (const scene of result.scenes || []) {
			mergedScenes.push({
				...scene,
				start_index: evidenceOffset + (scene.start_index || 0),
				end_index: evidenceOffset + (scene.end_index || 0),
			})
		}
	}

	const totalDuration = batchResults.reduce((sum, _, idx) => {
		return sum + parseFloat(batchResults[idx].result ? "0" : "0") // Duration already logged per batch
	}, 0)

	consola.success(
		`🎉 Batching complete: merged ${mergedEvidence.length} evidence units from ${batches.length} batches ` +
		`(${mergedPeople.length} people, ${mergedFacetMentions.length} facet mentions, ${mergedScenes.length} scenes)`
	)

	return {
		people: mergedPeople,
		evidence: mergedEvidence,
		facet_mentions: mergedFacetMentions,
		scenes: mergedScenes,
	}
}
