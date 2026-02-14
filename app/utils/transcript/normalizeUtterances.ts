type RawTime = number | string | null | undefined;

export interface RawUtterance {
	speaker?: string;
	text?: string;
	confidence?: number | null;
	start?: RawTime;
	end?: RawTime;
	start_time?: RawTime;
	end_time?: RawTime;
	begin?: RawTime;
	finish?: RawTime;
	stop?: RawTime;
}

export interface NormalizedUtterance {
	speaker: string;
	text: string;
	confidence: number;
	start: number;
	end: number;
}

const toNumber = (value: RawTime): number | null => {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value === "string") {
		const parsed = Number.parseFloat(value);
		return Number.isFinite(parsed) ? parsed : null;
	}
	return null;
};

const extractTime = (item: RawUtterance): { start: number | null; end: number | null } => {
	const start = toNumber(item.start) ?? toNumber(item.start_time) ?? toNumber(item.begin);
	const end = toNumber(item.end) ?? toNumber(item.end_time) ?? toNumber(item.finish) ?? toNumber(item.stop) ?? start;
	return { start, end };
};

const shouldConvertMilliseconds = (times: number[], audioDurationSec?: number | null) => {
	if (!times.length) return false;
	const maxTime = Math.max(...times);
	if (audioDurationSec && audioDurationSec > 0) {
		return maxTime > audioDurationSec * 3;
	}

	// Fallback: anything beyond a day is almost certainly milliseconds
	return maxTime > 24 * 60 * 60;
};

export function normalizeTranscriptUtterances(
	rawUtterances: RawUtterance[] | undefined,
	options?: { audioDurationSec?: number | null }
): NormalizedUtterance[] {
	if (!rawUtterances || rawUtterances.length === 0) return [];

	const timings = rawUtterances
		.map((item) => extractTime(item))
		.flatMap(({ start, end }) => [start, end])
		.filter((value): value is number => typeof value === "number" && Number.isFinite(value));

	const useMilliseconds = shouldConvertMilliseconds(timings, options?.audioDurationSec);

	const toSeconds = (value: number | null): number => {
		if (value === null || Number.isNaN(value)) return 0;
		const seconds = useMilliseconds ? value / 1000 : value;
		return seconds >= 0 ? seconds : 0;
	};

	return rawUtterances.map((item) => {
		const { start, end } = extractTime(item);
		return {
			speaker: typeof item.speaker === "string" && item.speaker.trim().length ? item.speaker : "A",
			text: typeof item.text === "string" ? item.text : "",
			confidence: typeof item.confidence === "number" && Number.isFinite(item.confidence) ? item.confidence : 0,
			start: toSeconds(start),
			end: toSeconds(end ?? start ?? 0),
		};
	});
}
