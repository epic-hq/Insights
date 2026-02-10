import { describe, expect, it } from "vitest";
import {
	coerceSeconds,
	normalizeTokens,
	normalizeForSearchText,
	buildWordTimeline,
	buildSegmentTimeline,
	findStartSecondsForSnippet,
	type WordTimelineEntry,
	type SegmentTimelineEntry,
} from "./timestampMapping";

// =============================================================================
// coerceSeconds
// =============================================================================
describe("coerceSeconds", () => {
	it("passes through small numbers as seconds", () => {
		expect(coerceSeconds(42)).toBe(42);
		expect(coerceSeconds(0)).toBe(0);
		expect(coerceSeconds(499)).toBe(499);
	});

	it("converts large numbers (>500) from ms to seconds", () => {
		expect(coerceSeconds(1000)).toBe(1);
		expect(coerceSeconds(60000)).toBe(60);
		expect(coerceSeconds(501)).toBeCloseTo(0.501);
	});

	it("returns null for non-finite numbers", () => {
		expect(coerceSeconds(NaN)).toBeNull();
		expect(coerceSeconds(Infinity)).toBeNull();
		expect(coerceSeconds(-Infinity)).toBeNull();
	});

	it("parses 'NNNms' string format", () => {
		expect(coerceSeconds("1200ms")).toBeCloseTo(1.2);
		expect(coerceSeconds("0ms")).toBe(0);
		expect(coerceSeconds("500ms")).toBeCloseTo(0.5);
	});

	it("parses 'mm:ss' format", () => {
		expect(coerceSeconds("2:30")).toBe(150);
		expect(coerceSeconds("0:05")).toBe(5);
		expect(coerceSeconds("10:00")).toBe(600);
	});

	it("parses plain numeric strings", () => {
		expect(coerceSeconds("42")).toBe(42);
		expect(coerceSeconds("1000")).toBe(1); // >500 → ms conversion
	});

	it("returns null for invalid strings", () => {
		expect(coerceSeconds("abc")).toBeNull();
		expect(coerceSeconds("")).toBeNull();
		expect(coerceSeconds("not:a:time:stamp")).toBeNull();
	});

	it("returns null for non-number/non-string types", () => {
		expect(coerceSeconds(null)).toBeNull();
		expect(coerceSeconds(undefined)).toBeNull();
		expect(coerceSeconds({})).toBeNull();
		expect(coerceSeconds([])).toBeNull();
		expect(coerceSeconds(true)).toBeNull();
	});
});

// =============================================================================
// normalizeTokens
// =============================================================================
describe("normalizeTokens", () => {
	it("lowercases and splits on whitespace", () => {
		expect(normalizeTokens("Hello World")).toEqual(["hello", "world"]);
	});

	it("strips punctuation except apostrophes", () => {
		expect(normalizeTokens("It's a test!")).toEqual(["it's", "a", "test"]);
	});

	it("handles multiple spaces and special chars", () => {
		expect(normalizeTokens("  foo   bar--baz  ")).toEqual(["foo", "bar", "baz"]);
	});

	it("returns empty array for empty string", () => {
		expect(normalizeTokens("")).toEqual([]);
	});

	it("preserves numbers", () => {
		expect(normalizeTokens("version 2.0 release")).toEqual([
			"version",
			"2",
			"0",
			"release",
		]);
	});
});

// =============================================================================
// normalizeForSearchText
// =============================================================================
describe("normalizeForSearchText", () => {
	it("lowercases and trims", () => {
		expect(normalizeForSearchText("  Hello World  ")).toBe("hello world");
	});

	it("replaces smart quotes with standard quotes", () => {
		expect(normalizeForSearchText("\u2018test\u2019")).toBe("'test'");
		expect(normalizeForSearchText("\u201Ctest\u201D")).toBe('"test"');
	});

	it("collapses whitespace", () => {
		expect(normalizeForSearchText("foo   bar\n\tbaz")).toBe("foo bar baz");
	});

	it("replaces non-breaking spaces", () => {
		expect(normalizeForSearchText("hello\u00A0world")).toBe("hello world");
	});

	it("returns empty string for null/undefined", () => {
		expect(normalizeForSearchText(null)).toBe("");
		expect(normalizeForSearchText(undefined)).toBe("");
	});
});

// =============================================================================
// buildWordTimeline
// =============================================================================
describe("buildWordTimeline", () => {
	it("builds timeline from words array with start times", () => {
		const transcriptData = {
			words: [
				{ text: "Hello", start: 1.0 },
				{ text: "world", start: 1.5 },
			],
		};
		const result = buildWordTimeline(transcriptData);
		expect(result).toEqual([
			{ text: "hello", start: 1.0 },
			{ text: "world", start: 1.5 },
		]);
	});

	it("handles start_ms format (milliseconds)", () => {
		const transcriptData = {
			words: [{ text: "Test", start_ms: 5000 }],
		};
		const result = buildWordTimeline(transcriptData);
		expect(result).toEqual([{ text: "test", start: 5 }]);
	});

	it("skips words without valid start time", () => {
		const transcriptData = {
			words: [
				{ text: "Good", start: 1 },
				{ text: "Bad" },
				{ text: "Also good", start: 2 },
			],
		};
		const result = buildWordTimeline(transcriptData);
		expect(result).toHaveLength(2);
	});

	it("skips empty/invalid words", () => {
		const transcriptData = {
			words: [null, { text: "", start: 1 }, { text: "ok", start: 2 }],
		};
		const result = buildWordTimeline(transcriptData);
		expect(result).toHaveLength(1);
		expect(result[0].text).toBe("ok");
	});

	it("returns empty array when no words key", () => {
		expect(buildWordTimeline({})).toEqual([]);
		expect(buildWordTimeline({ words: "not an array" })).toEqual([]);
	});
});

// =============================================================================
// buildSegmentTimeline
// =============================================================================
describe("buildSegmentTimeline", () => {
	it("builds from utterances", () => {
		const result = buildSegmentTimeline({
			utterances: [{ text: "Hello there", start: 10 }],
		});
		expect(result).toEqual([{ text: "Hello there", start: 10 }]);
	});

	it("builds from speaker_transcripts", () => {
		const result = buildSegmentTimeline({
			speaker_transcripts: [{ text: "Speaker A said this", start: 5 }],
		});
		expect(result).toEqual([{ text: "Speaker A said this", start: 5 }]);
	});

	it("builds from segments", () => {
		const result = buildSegmentTimeline({
			segments: [{ text: "Segment text", start: 20 }],
		});
		expect(result).toEqual([{ text: "Segment text", start: 20 }]);
	});

	it("combines multiple sources", () => {
		const result = buildSegmentTimeline({
			utterances: [{ text: "From utterances", start: 1 }],
			segments: [{ text: "From segments", start: 2 }],
		});
		expect(result).toHaveLength(2);
	});

	it("uses gist as fallback text", () => {
		const result = buildSegmentTimeline({
			utterances: [{ gist: "Gist text", start: 5 }],
		});
		expect(result).toEqual([{ text: "Gist text", start: 5 }]);
	});

	it("includes segments with null start (for substring matching)", () => {
		const result = buildSegmentTimeline({
			utterances: [{ text: "No timing" }],
		});
		expect(result).toEqual([{ text: "No timing", start: null }]);
	});

	it("returns empty for no data", () => {
		expect(buildSegmentTimeline({})).toEqual([]);
	});
});

// =============================================================================
// findStartSecondsForSnippet
// =============================================================================
describe("findStartSecondsForSnippet", () => {
	const wordTimeline: WordTimelineEntry[] = [
		{ text: "the", start: 0 },
		{ text: "onboarding", start: 1 },
		{ text: "process", start: 2 },
		{ text: "was", start: 3 },
		{ text: "really", start: 4 },
		{ text: "painful", start: 5 },
		{ text: "for", start: 6 },
		{ text: "our", start: 7 },
		{ text: "team", start: 8 },
	];

	const segmentTimeline: SegmentTimelineEntry[] = [
		{
			text: "The onboarding process was really painful for our team",
			start: 0,
		},
		{
			text: "We spent three weeks just getting set up",
			start: 10,
		},
	];

	it("matches via word-level tokens (stage 1)", () => {
		const result = findStartSecondsForSnippet({
			snippet: "onboarding process was",
			wordTimeline,
			segmentTimeline: [],
			durationSeconds: null,
		});
		expect(result).toBe(1); // "onboarding" starts at 1s
	});

	it("falls back to segment substring matching (stage 2)", () => {
		const result = findStartSecondsForSnippet({
			snippet: "really painful for our team",
			wordTimeline: [],
			segmentTimeline,
			durationSeconds: null,
		});
		expect(result).toBe(0); // First segment contains snippet
	});

	it("falls back to segment fuzzy matching (stage 2b)", () => {
		const result = findStartSecondsForSnippet({
			snippet: "onboarding painful team setup",
			wordTimeline: [],
			segmentTimeline,
			durationSeconds: null,
		});
		// Should match first segment via word overlap (onboarding, painful, team)
		expect(result).toBe(0);
	});

	it("falls back to ratio estimation (stage 3)", () => {
		const fullTranscript =
			"The onboarding process was really painful for our team. We spent three weeks just getting set up.";
		const result = findStartSecondsForSnippet({
			snippet: "three weeks",
			wordTimeline: [],
			segmentTimeline: [],
			fullTranscript,
			durationSeconds: 100,
		});
		// "three weeks" appears ~60% through the transcript
		expect(result).toBeGreaterThan(40);
		expect(result).toBeLessThan(80);
	});

	it("returns null when no match found", () => {
		const result = findStartSecondsForSnippet({
			snippet: "completely unrelated text not in any source",
			wordTimeline: [],
			segmentTimeline: [],
			durationSeconds: null,
		});
		expect(result).toBeNull();
	});

	it("handles empty snippet", () => {
		const result = findStartSecondsForSnippet({
			snippet: "",
			wordTimeline,
			segmentTimeline,
			durationSeconds: null,
		});
		expect(result).toBeNull();
	});
});
