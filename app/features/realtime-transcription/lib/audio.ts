/**
 * Audio processing utilities for real-time transcription.
 * Extraced as pure functions for testability.
 */

export const TARGET_SAMPLE_RATE = 16000;

/**
 * Downsamples Float32 audio from inputRate to 16kHz PCM16 (Int16Array).
 * Uses linear interpolation for sample conversion.
 * Returns null if input is too short to produce any output samples.
 */
export function downsampleTo16kPCM16(input: Float32Array, inputRate: number): Int16Array | null {
	const ratio = inputRate / TARGET_SAMPLE_RATE;
	const outputLen = Math.floor(input.length / ratio);
	if (outputLen < 1) return null;
	const out = new Int16Array(outputLen);
	for (let i = 0; i < outputLen; i++) {
		const srcIdx = i * ratio;
		const lo = Math.floor(srcIdx);
		const hi = Math.min(lo + 1, input.length - 1);
		const frac = srcIdx - lo;
		const sample = input[lo] + frac * (input[hi] - input[lo]);
		out[i] = Math.max(-32767, Math.min(32767, Math.round(sample * 32767)));
	}
	return out;
}

/**
 * Formats a duration in milliseconds to "MM:SS" string.
 */
export function formatDuration(ms: number): string {
	const totalSec = Math.floor(ms / 1000);
	const min = Math.floor(totalSec / 60);
	const sec = totalSec % 60;
	return `${min.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

/**
 * Formats a millisecond timestamp to "M:SS" string for evidence anchors.
 * Returns "--:--" for null/undefined values.
 */
export function formatMs(ms: number | null | undefined): string {
	if (ms == null) return "--:--";
	const totalSec = Math.floor(ms / 1000);
	const min = Math.floor(totalSec / 60);
	const sec = totalSec % 60;
	return `${min}:${sec.toString().padStart(2, "0")}`;
}

/**
 * Deduplicates evidence turns by gist + verbatim key.
 * Returns only the new (unseen) evidence items.
 */
export function deduplicateEvidence<T extends { gist: string; verbatim: string }>(existing: T[], incoming: T[]): T[] {
	const existingKeys = new Set(existing.map((e) => `${e.gist}::${e.verbatim}`));
	return incoming.filter((e) => !existingKeys.has(`${e.gist}::${e.verbatim}`));
}
