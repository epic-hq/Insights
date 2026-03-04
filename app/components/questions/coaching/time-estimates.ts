/**
 * Per-question-type time estimate heuristics.
 * Based on survey methodology research:
 * - Short text: ~20s (name, one-liner)
 * - Long text: ~60s (paragraph response)
 * - Single select: ~15s (scan + pick)
 * - Multi select: ~20s (scan + pick several)
 * - Likert: ~12s (read scale + pick)
 * - Image select: ~25s (visual scan + pick)
 * - Auto/unknown: ~30s (conservative default)
 */

const TIME_BY_TYPE: Record<string, number> = {
	short_text: 20,
	long_text: 60,
	single_select: 15,
	multi_select: 20,
	likert: 12,
	image_select: 25,
	auto: 30,
};

/** Estimated seconds to complete a single question */
export function estimateQuestionSeconds(type: string): number {
	return TIME_BY_TYPE[type] ?? 30;
}

/** Estimated total seconds for a list of question types */
export function estimateTotalSeconds(types: string[]): number {
	return types.reduce((sum, t) => sum + estimateQuestionSeconds(t), 0);
}

/** Format seconds as human-readable "~Xm" or "~Xs" */
export function formatEstimate(seconds: number): string {
	if (seconds >= 60) {
		const mins = Math.round(seconds / 60);
		return `~${mins} min`;
	}
	return `~${seconds}s`;
}

/** Threshold in seconds beyond which we warn about survey length */
export const SURVEY_LENGTH_WARN_SECONDS = 5 * 60; // 5 minutes
