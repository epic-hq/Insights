/**
 * Batch Evidence Extraction Utility
 *
 * Splits large transcripts into batches and processes them in parallel.
 * Uses gpt-5-mini (fast) with BAML fallback to gpt-4o on API errors.
 * Quality validation retries batches that return suspiciously empty results.
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
	facet_mentions?: any[];
	scenes: any[];
};

function toMs(value: number | string | null): number | null {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value === "string" && value.trim().length > 0) {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : null;
	}
	return null;
}

function normalizeText(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function hasTerminalPunctuation(value: string): boolean {
	return /[.!?]["')\]]*$/.test(value.trim());
}

function endsWithDanglingWord(value: string): boolean {
	const normalized = normalizeText(value);
	if (!normalized) return false;
	const words = normalized.split(" ");
	const lastWord = words[words.length - 1];
	return new Set(["a", "an", "and", "because", "for", "if", "of", "or", "so", "that", "the", "to", "with"]).has(
		lastWord
	);
}

function startsLikeContinuation(value: string): boolean {
	const trimmed = value.trim();
	if (!trimmed) return false;
	return /^[a-z]/.test(trimmed) || /^(and|but|because|so|or|that|which|who|when|where)\b/i.test(trimmed);
}

function isLikelySplitThought(current: SpeakerUtterance, next: SpeakerUtterance): boolean {
	const currentText = current.text.trim();
	const nextText = next.text.trim();
	if (!currentText || !nextText) return false;

	const currentLength = currentText.length;
	const nextLength = nextText.length;
	const currentEnd = toMs(current.end);
	const nextStart = toMs(next.start);
	const gapMs = currentEnd !== null && nextStart !== null ? Math.max(0, nextStart - currentEnd) : 0;

	if (gapMs > 1600) return false;

	if (current.speaker === next.speaker) {
		return (
			currentLength < 180 ||
			nextLength < 100 ||
			!hasTerminalPunctuation(currentText) ||
			endsWithDanglingWord(currentText)
		);
	}

	// Handle diarization churn where a single thought is split across adjacent speaker labels.
	return (
		currentLength < 220 &&
		nextLength < 100 &&
		(!hasTerminalPunctuation(currentText) || endsWithDanglingWord(currentText)) &&
		startsLikeContinuation(nextText)
	);
}

export function coalesceSpeakerTranscripts(speakerTranscripts: SpeakerUtterance[]): SpeakerUtterance[] {
	const cleaned = speakerTranscripts.filter((item) => typeof item?.text === "string" && item.text.trim().length > 0);
	if (cleaned.length <= 1) return cleaned;

	const merged: SpeakerUtterance[] = [];
	let current: SpeakerUtterance | null = null;

	for (const utterance of cleaned) {
		if (!current) {
			current = { ...utterance, text: utterance.text.trim() };
			continue;
		}

		if (isLikelySplitThought(current, utterance)) {
			current = {
				...current,
				text: `${current.text.trim()} ${utterance.text.trim()}`.replace(/\s+/g, " ").trim(),
				end: utterance.end ?? current.end,
			};
			continue;
		}

		merged.push(current);
		current = { ...utterance, text: utterance.text.trim() };
	}

	if (current) {
		merged.push(current);
	}

	return merged;
}

function normalizeSpeakerKey(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	if (!trimmed.length) return null;
	const upper = trimmed.toUpperCase();
	return upper.startsWith("SPEAKER ") ? upper : `SPEAKER ${upper}`;
}

export interface BatchProgressInfo {
	batchIndex: number;
	totalBatches: number;
	completedBatches: number;
	evidenceCount: number;
}

export type BatchProgressCallback = (info: BatchProgressInfo) => void | Promise<void>;

const DEFAULT_BATCH_SIZE = 30; // Keep each model call shorter to reduce heartbeat stall risk
const DEFAULT_MAX_CONCURRENT_BATCHES = 6; // Run more batches in parallel — GPT-5-mini/4o handle concurrency well
const MAX_BATCH_SIZE = 75;
const MAX_CONCURRENCY = 10;
const BATCH_HEARTBEAT_INTERVAL_MS = 10_000;

function readPositiveIntEnv(name: string, fallback: number): number {
	const raw = process.env[name];
	if (!raw) return fallback;
	const parsed = Number.parseInt(raw, 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const BATCH_SIZE = Math.min(MAX_BATCH_SIZE, readPositiveIntEnv("EVIDENCE_BATCH_SIZE", DEFAULT_BATCH_SIZE));
const MAX_CONCURRENT_BATCHES = Math.min(
	MAX_CONCURRENCY,
	readPositiveIntEnv("EVIDENCE_MAX_CONCURRENT_BATCHES", DEFAULT_MAX_CONCURRENT_BATCHES)
);

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
	const coalescedSpeakerTranscripts = coalesceSpeakerTranscripts(speakerTranscripts);
	const ENABLE_BATCHING = coalescedSpeakerTranscripts.length > BATCH_SIZE;

	if (!ENABLE_BATCHING) {
		// Single call for small transcripts
		consola.info(
			`⚡ Single-batch mode: ${coalescedSpeakerTranscripts.length} utterances ` +
				`(coalesced from ${speakerTranscripts.length}, ≤${BATCH_SIZE}, batching disabled)`
		);
		const startTime = Date.now();
		const result = await withHeartbeatWhilePending(
			() => extractFn(coalescedSpeakerTranscripts),
			BATCH_HEARTBEAT_INTERVAL_MS
		);
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

	consola.info(
		`🚀 Batching enabled: processing ${coalescedSpeakerTranscripts.length} utterances ` +
			`(coalesced from ${speakerTranscripts.length}) in chunks of ${BATCH_SIZE}`
	);

	// Split into batches
	const batches: SpeakerUtterance[][] = [];
	for (let i = 0; i < coalescedSpeakerTranscripts.length; i += BATCH_SIZE) {
		batches.push(coalescedSpeakerTranscripts.slice(i, i + BATCH_SIZE));
	}

	consola.info(`📦 Created ${batches.length} batches (max ${MAX_CONCURRENT_BATCHES} concurrent)`);

	// Track completed batches for progress reporting
	let completedBatches = 0;
	let totalEvidenceCount = 0;

	// Process batches with limited concurrency
	// Quality validation: retry batches that return zero evidence (likely model failure)
	const batchResults = await processWithConcurrency(
		batches,
		async (batch, batchIndex) => {
			await heartbeats.yield();
			const batchStart = Date.now();
			const batchLabel = `Batch ${batchIndex + 1}/${batches.length}`;
			consola.info(`⏳ ${batchLabel}: processing ${batch.length} utterances`);

			let result = await withHeartbeatWhilePending(() => extractFn(batch), BATCH_HEARTBEAT_INTERVAL_MS);

			// Quality gate: if batch returned zero evidence from non-trivial input, retry once
			const evidenceCount = result.evidence?.length ?? 0;
			if (evidenceCount === 0 && batch.length >= 5) {
				consola.warn(`⚠️  ${batchLabel}: 0 evidence from ${batch.length} utterances — retrying`);
				await heartbeats.yield();
				result = await withHeartbeatWhilePending(() => extractFn(batch), BATCH_HEARTBEAT_INTERVAL_MS);
				const retryCount = result.evidence?.length ?? 0;
				consola.info(`🔄 ${batchLabel} retry: ${retryCount} evidence units`);
			}

			const batchDuration = ((Date.now() - batchStart) / 1000).toFixed(1);
			consola.success(`✅ ${batchLabel}: completed in ${batchDuration}s (${result.evidence?.length ?? 0} evidence)`);

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
	const canonicalPersonKeyByIdentity = new Map<string, string>();

	for (const { result } of batchResults) {
		await heartbeats.yield();
		// Merge people using speaker identity first (speaker_label), fallback to person_key.
		// This prevents cross-batch collisions from local person_key numbering.
		const keyRewrite = new Map<string, string>();
		for (const person of result.people || []) {
			const identity =
				normalizeSpeakerKey(person?.speaker_label) ??
				(typeof person?.person_key === "string" ? person.person_key : null);
			const sourceKey = typeof person?.person_key === "string" ? person.person_key : null;
			if (!identity || !sourceKey) continue;

			const existingKey = canonicalPersonKeyByIdentity.get(identity);
			if (existingKey) {
				keyRewrite.set(sourceKey, existingKey);
				continue;
			}

			canonicalPersonKeyByIdentity.set(identity, sourceKey);
			keyRewrite.set(sourceKey, sourceKey);
			mergedPeople.push(person);
		}

		// Merge evidence with corrected indices
		const evidenceOffset = mergedEvidence.length;
		let localEvidenceIndex = 0;
		for (const evidence of result.evidence || []) {
			const rewrittenPersonKey =
				typeof evidence?.person_key === "string"
					? (keyRewrite.get(evidence.person_key) ?? evidence.person_key)
					: evidence?.person_key;
			const correctedIndex =
				typeof evidence?.index === "number" ? evidenceOffset + evidence.index : evidenceOffset + localEvidenceIndex;
			const rewrittenMentions = Array.isArray(evidence?.facet_mentions)
				? evidence.facet_mentions.map((mention: any) => ({
						...mention,
						person_key:
							typeof mention?.person_key === "string"
								? (keyRewrite.get(mention.person_key) ?? mention.person_key)
								: mention?.person_key,
						parent_index:
							typeof mention?.parent_index === "number" ? evidenceOffset + mention.parent_index : correctedIndex,
					}))
				: evidence?.facet_mentions;
			const normalizedEvidence = {
				...evidence,
				person_key: rewrittenPersonKey,
				index: correctedIndex,
				facet_mentions: rewrittenMentions,
			};
			mergedEvidence.push(normalizedEvidence);

			// Merge nested facet_mentions with corrected parent_index
			if (Array.isArray(rewrittenMentions)) {
				for (const mention of rewrittenMentions) {
					const mentionPersonKey =
						typeof mention?.person_key === "string"
							? (keyRewrite.get(mention.person_key) ?? mention.person_key)
							: mention?.person_key;
					mergedFacetMentions.push({
						...mention,
						person_key: mentionPersonKey,
						parent_index: typeof mention?.parent_index === "number" ? mention.parent_index : correctedIndex,
					});
				}
			}
			localEvidenceIndex++;
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
