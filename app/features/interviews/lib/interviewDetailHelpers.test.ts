import { describe, expect, it } from "vitest";
import {
	deriveMediaFormat,
	type EvidenceRecord,
	extractAnalysisFromInterview,
	extractAnchorSeconds,
	formatTimestamp,
	getFocusAreaColor,
	type KeyTakeaway,
	matchTakeawaysToEvidence,
	normalizeMultilineText,
	parseFullName,
} from "./interviewDetailHelpers";

// =============================================================================
// parseFullName
// =============================================================================

describe("parseFullName", () => {
	it("splits 'Jane Doe' into first + last", () => {
		expect(parseFullName("Jane Doe")).toEqual({ firstname: "Jane", lastname: "Doe" });
	});

	it("handles single name", () => {
		expect(parseFullName("Cher")).toEqual({ firstname: "Cher", lastname: null });
	});

	it("handles three-part name", () => {
		expect(parseFullName("Mary Jane Watson")).toEqual({ firstname: "Mary", lastname: "Jane Watson" });
	});

	it("trims whitespace", () => {
		expect(parseFullName("  Bob   Smith  ")).toEqual({ firstname: "Bob", lastname: "Smith" });
	});

	it("returns empty for empty string", () => {
		expect(parseFullName("")).toEqual({ firstname: "", lastname: null });
	});

	it("returns empty for whitespace-only", () => {
		expect(parseFullName("   ")).toEqual({ firstname: "", lastname: null });
	});
});

// =============================================================================
// normalizeMultilineText
// =============================================================================

describe("normalizeMultilineText", () => {
	it("converts array of strings to bulleted list", () => {
		const result = normalizeMultilineText(["First point", "Second point"]);
		expect(result).toBe("- First point\n- Second point");
	});

	it("preserves existing bullet markers", () => {
		const result = normalizeMultilineText(["- Already bulleted", "* Star marker", "1. Numbered"]);
		expect(result).toBe("- Already bulleted\n* Star marker\n1. Numbered");
	});

	it("parses JSON stringified array", () => {
		const result = normalizeMultilineText('["Item A","Item B"]');
		expect(result).toBe("- Item A\n- Item B");
	});

	it("returns plain string as-is", () => {
		expect(normalizeMultilineText("Just a paragraph")).toBe("Just a paragraph");
	});

	it("returns empty for null/undefined", () => {
		expect(normalizeMultilineText(null)).toBe("");
		expect(normalizeMultilineText(undefined)).toBe("");
	});

	it("returns empty for number", () => {
		expect(normalizeMultilineText(42)).toBe("");
	});

	it("handles invalid JSON string gracefully", () => {
		expect(normalizeMultilineText("{not valid json")).toBe("{not valid json");
	});

	it("filters empty strings from arrays", () => {
		const result = normalizeMultilineText(["Keep this", "", "  ", "And this"]);
		expect(result).toBe("- Keep this\n- And this");
	});
});

// =============================================================================
// deriveMediaFormat
// =============================================================================

describe("deriveMediaFormat", () => {
	describe("by file extension", () => {
		it.each([
			["mp3", "audio"],
			["wav", "audio"],
			["m4a", "audio"],
			["aac", "audio"],
			["ogg", "audio"],
			["flac", "audio"],
			["mp4", "video"],
			["mov", "video"],
			["avi", "video"],
			["mkv", "video"],
		] as const)("%s → %s", (ext, expected) => {
			expect(deriveMediaFormat(ext, null, null)).toBe(expected);
		});

		it("handles dotted extension (.mp3)", () => {
			expect(deriveMediaFormat(".mp3", null, null)).toBe("audio");
		});

		it("is case-insensitive", () => {
			expect(deriveMediaFormat("MP4", null, null)).toBe("video");
		});
	});

	describe("webm disambiguation", () => {
		it("webm + audio_upload → audio", () => {
			expect(deriveMediaFormat("webm", "audio_upload", null)).toBe("audio");
		});

		it("webm + video_upload → video", () => {
			expect(deriveMediaFormat("webm", "video_upload", null)).toBe("video");
		});

		it("webm + no source_type → video (default)", () => {
			expect(deriveMediaFormat("webm", null, null)).toBe("video");
		});
	});

	describe("by source_type", () => {
		it("audio_upload → audio", () => {
			expect(deriveMediaFormat(null, "audio_upload", null)).toBe("audio");
		});

		it("video_url → video", () => {
			expect(deriveMediaFormat(null, "video_url", null)).toBe("video");
		});

		it("recall → video", () => {
			expect(deriveMediaFormat(null, "recall", null)).toBe("video");
		});

		it("realtime_recording → video", () => {
			expect(deriveMediaFormat(null, "realtime_recording", null)).toBe("video");
		});
	});

	describe("by media_type", () => {
		it("voice_memo → audio", () => {
			expect(deriveMediaFormat(null, null, "voice_memo")).toBe("audio");
		});

		it("interview → null (no hint)", () => {
			expect(deriveMediaFormat(null, null, "interview")).toBeNull();
		});
	});

	it("returns null when no signals", () => {
		expect(deriveMediaFormat(null, null, null)).toBeNull();
	});

	it("extension takes priority over source_type", () => {
		// mp3 extension = audio, even if source_type says video
		expect(deriveMediaFormat("mp3", "video_upload", null)).toBe("audio");
	});
});

// =============================================================================
// extractAnalysisFromInterview
// =============================================================================

describe("extractAnalysisFromInterview", () => {
	it("extracts analysis fields from conversation_analysis JSONB", () => {
		const interview = {
			id: "int-1",
			conversation_analysis: {
				status: "in_progress",
				status_detail: "Extracting evidence",
				progress: 50,
				trigger_run_id: "run_abc",
			},
			created_at: "2026-01-01T00:00:00Z",
			updated_at: "2026-01-02T00:00:00Z",
		};

		const result = extractAnalysisFromInterview(interview);

		expect(result).toEqual({
			id: "int-1",
			status: "in_progress",
			status_detail: "Extracting evidence",
			progress: 50,
			trigger_run_id: "run_abc",
			created_at: "2026-01-01T00:00:00Z",
			updated_at: "2026-01-02T00:00:00Z",
		});
	});

	it("returns null when conversation_analysis is null", () => {
		expect(
			extractAnalysisFromInterview({
				id: "int-2",
				conversation_analysis: null,
				created_at: null,
				updated_at: null,
			})
		).toBeNull();
	});

	it("returns null fields when JSONB is empty object", () => {
		const result = extractAnalysisFromInterview({
			id: "int-3",
			conversation_analysis: {},
			created_at: null,
			updated_at: null,
		});

		expect(result).toEqual({
			id: "int-3",
			status: null,
			status_detail: null,
			progress: null,
			trigger_run_id: null,
			created_at: null,
			updated_at: null,
		});
	});
});

// =============================================================================
// matchTakeawaysToEvidence — the "wow" linker
// =============================================================================

describe("matchTakeawaysToEvidence", () => {
	const evidence: EvidenceRecord[] = [
		{ id: "ev-1", verbatim: "It takes forever to get started with the onboarding", gist: "Slow onboarding" },
		{
			id: "ev-2",
			verbatim: "I don't want to wait for a sales call to begin using the product",
			gist: "Self-serve preference",
		},
		{ id: "ev-3", verbatim: "The dashboard is great once you're in", gist: "Dashboard satisfaction" },
	];

	it("matches snippet to evidence by verbatim containment", () => {
		const takeaways: KeyTakeaway[] = [
			{
				priority: "high",
				summary: "Onboarding is slow",
				evidenceSnippets: ["It takes forever to get started"],
			},
		];

		matchTakeawaysToEvidence(takeaways, evidence);
		expect(takeaways[0].evidenceId).toBe("ev-1");
	});

	it("matches snippet to evidence by gist containment", () => {
		const takeaways: KeyTakeaway[] = [
			{
				priority: "medium",
				summary: "Users like the dashboard",
				evidenceSnippets: ["Dashboard satisfaction"],
			},
		];

		matchTakeawaysToEvidence(takeaways, evidence);
		expect(takeaways[0].evidenceId).toBe("ev-3");
	});

	it("uses supportingEvidenceIds before fuzzy snippet matching", () => {
		const takeaways: KeyTakeaway[] = [
			{
				priority: "high",
				summary: "Direct link",
				evidenceSnippets: ["This snippet should be ignored when direct ids are present"],
				supportingEvidenceIds: ["ev-2", "ev-1"],
			},
		];

		matchTakeawaysToEvidence(takeaways, evidence);
		expect(takeaways[0].evidenceId).toBe("ev-2");
	});

	it("does not overwrite already-matched takeaways", () => {
		const takeaways: KeyTakeaway[] = [
			{
				priority: "high",
				summary: "Already linked",
				evidenceSnippets: ["It takes forever"],
				evidenceId: "ev-existing",
			},
		];

		matchTakeawaysToEvidence(takeaways, evidence);
		expect(takeaways[0].evidenceId).toBe("ev-existing");
	});

	it("skips takeaways with no snippets", () => {
		const takeaways: KeyTakeaway[] = [
			{
				priority: "low",
				summary: "No snippets",
				evidenceSnippets: [],
			},
		];

		matchTakeawaysToEvidence(takeaways, evidence);
		expect(takeaways[0].evidenceId).toBeUndefined();
	});

	it("picks the best match when multiple evidence items partially match", () => {
		const takeaways: KeyTakeaway[] = [
			{
				priority: "high",
				summary: "Sales call reluctance",
				evidenceSnippets: ["wait for a sales call"],
			},
		];

		matchTakeawaysToEvidence(takeaways, evidence);
		expect(takeaways[0].evidenceId).toBe("ev-2");
	});

	it("matches reverse containment (verbatim inside snippet) for long verbatims", () => {
		const shortEvidence: EvidenceRecord[] = [
			{ id: "ev-short", verbatim: "The onboarding process is painful and slow for most new customers", gist: null },
		];

		const takeaways: KeyTakeaway[] = [
			{
				priority: "high",
				summary: "Painful onboarding",
				evidenceSnippets: [
					"The onboarding process is painful and slow for most new customers and requires hand-holding",
				],
			},
		];

		matchTakeawaysToEvidence(takeaways, shortEvidence);
		expect(takeaways[0].evidenceId).toBe("ev-short");
	});

	it("handles empty evidence array gracefully", () => {
		const takeaways: KeyTakeaway[] = [
			{
				priority: "high",
				summary: "No evidence to match",
				evidenceSnippets: ["Some quote"],
			},
		];

		matchTakeawaysToEvidence(takeaways, []);
		expect(takeaways[0].evidenceId).toBeUndefined();
	});

	it("is case-insensitive", () => {
		const takeaways: KeyTakeaway[] = [
			{
				priority: "medium",
				summary: "Case test",
				evidenceSnippets: ["IT TAKES FOREVER TO GET STARTED"],
			},
		];

		matchTakeawaysToEvidence(takeaways, evidence);
		expect(takeaways[0].evidenceId).toBe("ev-1");
	});
});

// =============================================================================
// extractAnchorSeconds — timestamp extraction from evidence anchors
// =============================================================================

describe("extractAnchorSeconds", () => {
	it("extracts start_ms and converts to seconds", () => {
		expect(extractAnchorSeconds([{ start_ms: 45000 }])).toBe(45);
	});

	it("extracts startMs and converts to seconds", () => {
		expect(extractAnchorSeconds([{ startMs: 120000 }])).toBe(120);
	});

	it("extracts start_seconds directly", () => {
		expect(extractAnchorSeconds([{ start_seconds: 30 }])).toBe(30);
	});

	it("extracts start directly (under 500 = seconds)", () => {
		expect(extractAnchorSeconds([{ start: 90 }])).toBe(90);
	});

	it("converts start > 500 from ms to seconds", () => {
		expect(extractAnchorSeconds([{ start: 60000 }])).toBe(60);
	});

	it("returns null for empty array", () => {
		expect(extractAnchorSeconds([])).toBeNull();
	});

	it("returns null for non-array", () => {
		expect(extractAnchorSeconds(null)).toBeNull();
		expect(extractAnchorSeconds(undefined)).toBeNull();
		expect(extractAnchorSeconds("not an array")).toBeNull();
	});

	it("returns null when anchor has no time fields", () => {
		expect(extractAnchorSeconds([{ text: "hello" }])).toBeNull();
	});

	it("prefers start_ms over other keys", () => {
		expect(extractAnchorSeconds([{ start_ms: 5000, start: 999 }])).toBe(5);
	});
});

// =============================================================================
// formatTimestamp
// =============================================================================

describe("formatTimestamp", () => {
	it("formats 0 seconds as 0:00", () => {
		expect(formatTimestamp(0)).toBe("0:00");
	});

	it("formats 65 seconds as 1:05", () => {
		expect(formatTimestamp(65)).toBe("1:05");
	});

	it("formats 600 seconds as 10:00", () => {
		expect(formatTimestamp(600)).toBe("10:00");
	});

	it("floors fractional seconds", () => {
		expect(formatTimestamp(90.7)).toBe("1:30");
	});

	it("clamps negative to 0:00", () => {
		expect(formatTimestamp(-5)).toBe("0:00");
	});

	it("handles large values", () => {
		expect(formatTimestamp(3661)).toBe("61:01");
	});
});

// =============================================================================
// getFocusAreaColor
// =============================================================================

describe("getFocusAreaColor", () => {
	it("returns blue for product", () => {
		expect(getFocusAreaColor("Product Strategy")).toContain("blue");
	});

	it("returns emerald for partner", () => {
		expect(getFocusAreaColor("Partner Relations")).toContain("emerald");
	});

	it("returns purple for research", () => {
		expect(getFocusAreaColor("User Research")).toContain("purple");
	});

	it("returns amber for sales", () => {
		expect(getFocusAreaColor("Sales Enablement")).toContain("amber");
	});

	it("returns primary for unknown", () => {
		expect(getFocusAreaColor("Engineering")).toContain("primary");
	});

	it("is case-insensitive", () => {
		expect(getFocusAreaColor("PRODUCT")).toContain("blue");
	});
});
