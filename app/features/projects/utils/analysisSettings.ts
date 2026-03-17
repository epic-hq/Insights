export const DEFAULT_THEME_DEDUP_THRESHOLD = 0.85;
export const DEFAULT_EVIDENCE_LINK_THRESHOLD = 0.65;

export type ProjectAnalysisSettings = {
	theme_dedup_threshold: number;
	evidence_link_threshold: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function coerceThreshold(value: unknown, fallback: number, min: number, max: number): number {
	const parsed =
		typeof value === "number" ? value : typeof value === "string" ? Number.parseFloat(value) : Number.NaN;

	if (!Number.isFinite(parsed)) {
		return fallback;
	}

	return Math.min(max, Math.max(min, parsed));
}

export function getProjectAnalysisSettings(projectSettings: unknown): ProjectAnalysisSettings {
	const settings = isRecord(projectSettings) ? projectSettings : {};
	const analysis = isRecord(settings.analysis) ? settings.analysis : {};

	return {
		theme_dedup_threshold: coerceThreshold(
			analysis.theme_dedup_threshold,
			DEFAULT_THEME_DEDUP_THRESHOLD,
			0.5,
			0.95
		),
		evidence_link_threshold: coerceThreshold(
			analysis.evidence_link_threshold,
			DEFAULT_EVIDENCE_LINK_THRESHOLD,
			0.2,
			0.7
		),
	};
}
