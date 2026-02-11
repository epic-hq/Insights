/**
 * Batch Evidence Extraction Utility
 *
 * Splits large transcripts into batches and processes them in parallel
 * for faster extraction using GPT-4o-mini.
 */

import { heartbeats } from "@trigger.dev/sdk";
import consola from "consola";

type SpeakerUtterance = {
	speaker: string;
	text: string;
	start: number | string | null;
	end: number | string | null;
};

type EvidenceResult = {
	people: any[];
	evidence: any[];
	facet_mentions: any[];
	scenes: any[];
};

export interface BatchProgressInfo {
	batchIndex: number;
	totalBatches: number;
	completedBatches: number;
	evidenceCount: number;
}

export type BatchProgressCallback = (info: BatchProgressInfo) => void | Promise<void>;

const BATCH_SIZE = 75; // Process ~75 utterances per batch
const MAX_CONCURRENT_BATCHES = 3; // Limit parallel API calls to prevent rate limiting
const BATCH_HEARTBEAT_INTERVAL_MS = 10_000;

/**
 * Process items with limited concurrency (pool pattern)
 */
async function processWithConcurrency<T, R>(
	items: T[],
	processor: (item: T, index: number) => Promise<R>,
	concurrency: number
): Promise<R[]> {
	const results: R[] = new Array(items.length);
	let currentIndex = 0;

	async function worker(): Promise<void> {
		while (currentIndex < items.length) {
			const index = currentIndex++;
			results[index] = await processor(items[index], index);
		}
	}

	// Start workers up to concurrency limit
	const workers = Array(Math.min(concurrency, items.length))
		.fill(null)
		.map(() => worker());

	await Promise.all(workers);
	return results;
}

export async function batchExtractEvidence(
	speakerTranscripts: SpeakerUtterance[],
	extractFn: (batch: SpeakerUtterance[]) => Promise<EvidenceResult>,
	onProgress?: BatchProgressCallback
): Promise<EvidenceResult> {
	const ENABLE_BATCHING = speakerTranscripts.length > BATCH_SIZE;

	if (!ENABLE_BATCHING) {
		// Single call for small transcripts
		consola.info(`⚡ Single-batch mode: ${speakerTranscripts.length} utterances (≤${BATCH_SIZE}, batching disabled)`);
		const startTime = Date.now();
		const result = await withHeartbeatWhilePending(() => extractFn(speakerTranscripts), BATCH_HEARTBEAT_INTERVAL_MS);
		const duration = ((Date.now() - startTime) / 1000).toFixed(1);
		consola.success(`✅ Single batch completed in ${duration}s`);

		// Report progress for single batch
		if (onProgress) {
			await onProgress({
				batchIndex: 0,
				totalBatches: 1,
				completedBatches: 1,
				evidenceCount: result.evidence?.length ?? 0,
			});
		}

		return result;
	}

	consola.info(`🚀 Batching enabled: processing ${speakerTranscripts.length} utterances in chunks of ${BATCH_SIZE}`);

	// Split into batches
	const batches: SpeakerUtterance[][] = [];
	for (let i = 0; i < speakerTranscripts.length; i += BATCH_SIZE) {
		batches.push(speakerTranscripts.slice(i, i + BATCH_SIZE));
	}

	consola.info(`📦 Created ${batches.length} batches (max ${MAX_CONCURRENT_BATCHES} concurrent)`);

	// Track completed batches for progress reporting
	let completedBatches = 0;
	let totalEvidenceCount = 0;

	// Process batches with limited concurrency to prevent API rate limiting
	const batchResults = await processWithConcurrency(
		batches,
		async (batch, batchIndex) => {
			await heartbeats.yield();
			const batchStart = Date.now();
			consola.info(`⏳ Batch ${batchIndex + 1}/${batches.length}: processing ${batch.length} utterances`);

			const result = await withHeartbeatWhilePending(() => extractFn(batch), BATCH_HEARTBEAT_INTERVAL_MS);

			const batchDuration = ((Date.now() - batchStart) / 1000).toFixed(1);
			consola.success(`✅ Batch ${batchIndex + 1}/${batches.length}: completed in ${batchDuration}s`);

			// Report progress after each batch completes
			completedBatches++;
			totalEvidenceCount += result.evidence?.length ?? 0;

			if (onProgress) {
				await onProgress({
					batchIndex,
					totalBatches: batches.length,
					completedBatches,
					evidenceCount: totalEvidenceCount,
				});
			}

			return { result, batchIndex };
		},
		MAX_CONCURRENT_BATCHES
	);

	// Merge results
	const mergedPeople: any[] = [];
	const mergedEvidence: any[] = [];
	const mergedFacetMentions: any[] = [];
	const mergedScenes: any[] = [];

	for (const { result } of batchResults) {
		await heartbeats.yield();
		// Merge people (dedupe by person_key)
		for (const person of result.people || []) {
			if (!mergedPeople.find((p) => p.person_key === person.person_key)) {
				mergedPeople.push(person);
			}
		}

		// Merge evidence with corrected indices
		const evidenceOffset = mergedEvidence.length;
		for (const evidence of result.evidence || []) {
			mergedEvidence.push(evidence);

			// Merge nested facet_mentions with corrected parent_index
			if (Array.isArray(evidence.facet_mentions)) {
				for (const mention of evidence.facet_mentions) {
					mergedFacetMentions.push({
						...mention,
						parent_index: evidenceOffset + (mention.parent_index || 0),
					});
				}
			}
		}

		// Merge scenes with corrected indices
		for (const scene of result.scenes || []) {
			mergedScenes.push({
				...scene,
				start_index: evidenceOffset + (scene.start_index || 0),
				end_index: evidenceOffset + (scene.end_index || 0),
			});
		}
	}

	const _totalDuration = batchResults.reduce((sum, _, idx) => {
		return sum + Number.parseFloat(batchResults[idx].result ? "0" : "0"); // Duration already logged per batch
	}, 0);

	consola.success(
		`🎉 Batching complete: merged ${mergedEvidence.length} evidence units from ${batches.length} batches ` +
			`(${mergedPeople.length} people, ${mergedFacetMentions.length} facet mentions, ${mergedScenes.length} scenes)`
	);

	return {
		people: mergedPeople,
		evidence: mergedEvidence,
		facet_mentions: mergedFacetMentions,
		scenes: mergedScenes,
	};
}

async function withHeartbeatWhilePending<T>(operation: () => Promise<T>, intervalMs: number): Promise<T> {
	const timer = setInterval(() => {
		void heartbeats.yield();
	}, intervalMs);

	try {
		return await operation();
	} finally {
		clearInterval(timer);
		await heartbeats.yield();
	}
}
