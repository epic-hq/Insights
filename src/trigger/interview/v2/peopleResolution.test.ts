import { describe, expect, it } from "vitest";
import {
	isGenericPersonLabel,
	parseFullName,
	generateFallbackPersonName,
	humanizeKey,
	sanitizePersonKey,
	coerceString,
	resolveName,
	type NormalizedParticipant,
} from "./peopleResolution";

// =============================================================================
// isGenericPersonLabel
// =============================================================================
describe("isGenericPersonLabel", () => {
	it("detects numbered participants", () => {
		expect(isGenericPersonLabel("Participant 1")).toBe(true);
		expect(isGenericPersonLabel("participant 2")).toBe(true);
		expect(isGenericPersonLabel("Participant A")).toBe(true);
		expect(isGenericPersonLabel("PARTICIPANT_1")).toBe(true);
	});

	it("detects speakers", () => {
		expect(isGenericPersonLabel("Speaker A")).toBe(true);
		expect(isGenericPersonLabel("speaker 1")).toBe(true);
		expect(isGenericPersonLabel("SPEAKER B")).toBe(true);
	});

	it("detects interviewers and moderators", () => {
		expect(isGenericPersonLabel("Interviewer")).toBe(true);
		expect(isGenericPersonLabel("Moderator")).toBe(true);
		expect(isGenericPersonLabel("Facilitator")).toBe(true);
	});

	it("detects ordinal labels", () => {
		expect(isGenericPersonLabel("Participant One")).toBe(true);
		expect(isGenericPersonLabel("Speaker Two")).toBe(true);
		expect(isGenericPersonLabel("Participant First")).toBe(true);
	});

	it("detects other generic labels", () => {
		expect(isGenericPersonLabel("Customer")).toBe(true);
		expect(isGenericPersonLabel("Interviewee")).toBe(true);
		expect(isGenericPersonLabel("User")).toBe(true);
		expect(isGenericPersonLabel("Client")).toBe(true);
		expect(isGenericPersonLabel("Respondent")).toBe(true);
		expect(isGenericPersonLabel("Guest")).toBe(true);
		expect(isGenericPersonLabel("Attendee")).toBe(true);
	});

	it("does NOT flag real names", () => {
		expect(isGenericPersonLabel("Sarah Chen")).toBe(false);
		expect(isGenericPersonLabel("John")).toBe(false);
		expect(isGenericPersonLabel("Dr. Smith")).toBe(false);
	});

	it("returns false for null/undefined/empty", () => {
		expect(isGenericPersonLabel(null)).toBe(false);
		expect(isGenericPersonLabel(undefined)).toBe(false);
		expect(isGenericPersonLabel("")).toBe(false);
		expect(isGenericPersonLabel("   ")).toBe(false);
	});
});

// =============================================================================
// parseFullName
// =============================================================================
describe("parseFullName", () => {
	it("splits two-part names", () => {
		expect(parseFullName("Sarah Chen")).toEqual({
			firstname: "Sarah",
			lastname: "Chen",
		});
	});

	it("handles single-word names", () => {
		expect(parseFullName("Madonna")).toEqual({
			firstname: "Madonna",
			lastname: null,
		});
	});

	it("joins multi-part last names", () => {
		expect(parseFullName("Mary Jane Watson")).toEqual({
			firstname: "Mary",
			lastname: "Jane Watson",
		});
	});

	it("handles empty string", () => {
		expect(parseFullName("")).toEqual({ firstname: "", lastname: null });
	});

	it("trims whitespace", () => {
		expect(parseFullName("  John   Doe  ")).toEqual({
			firstname: "John",
			lastname: "Doe",
		});
	});
});

// =============================================================================
// generateFallbackPersonName
// =============================================================================
describe("generateFallbackPersonName", () => {
	it("uses participantName when available", () => {
		expect(
			generateFallbackPersonName({
				accountId: "test",
				participantName: "Sarah Chen",
			}),
		).toBe("Sarah Chen");
	});

	it("trims participantName", () => {
		expect(
			generateFallbackPersonName({
				accountId: "test",
				participantName: "  Sarah  ",
			}),
		).toBe("Sarah");
	});

	it("falls back to 'Unknown Participant' when no name available", () => {
		expect(generateFallbackPersonName({ accountId: "test" })).toBe(
			"Unknown Participant",
		);
	});

	it("does NOT use interviewTitle as person name", () => {
		expect(
			generateFallbackPersonName({
				accountId: "test",
				interviewTitle: "Customer Discovery Session",
			}),
		).toBe("Unknown Participant");
	});

	it("does NOT use fileName as person name", () => {
		expect(
			generateFallbackPersonName({
				accountId: "test",
				fileName: "interview_2026_01_15.mp3",
			}),
		).toBe("Unknown Participant");
	});
});

// =============================================================================
// humanizeKey
// =============================================================================
describe("humanizeKey", () => {
	it("converts underscores to spaces and title-cases", () => {
		expect(humanizeKey("john_doe")).toBe("John Doe");
	});

	it("converts hyphens to spaces", () => {
		expect(humanizeKey("sarah-chen")).toBe("Sarah Chen");
	});

	it("handles mixed separators", () => {
		expect(humanizeKey("first_name-last")).toBe("First Name Last");
	});

	it("collapses multiple separators", () => {
		expect(humanizeKey("foo___bar--baz")).toBe("Foo Bar Baz");
	});

	it("returns null for null/undefined/empty", () => {
		expect(humanizeKey(null)).toBeNull();
		expect(humanizeKey(undefined)).toBeNull();
		expect(humanizeKey("")).toBeNull();
	});
});

// =============================================================================
// sanitizePersonKey
// =============================================================================
describe("sanitizePersonKey", () => {
	it("returns trimmed string value", () => {
		expect(sanitizePersonKey("person-1", "fallback")).toBe("person-1");
		expect(sanitizePersonKey("  key  ", "fallback")).toBe("key");
	});

	it("returns fallback for empty or non-string", () => {
		expect(sanitizePersonKey("", "fallback")).toBe("fallback");
		expect(sanitizePersonKey("  ", "fallback")).toBe("fallback");
		expect(sanitizePersonKey(null, "fallback")).toBe("fallback");
		expect(sanitizePersonKey(undefined, "fallback")).toBe("fallback");
		expect(sanitizePersonKey(42, "fallback")).toBe("fallback");
	});
});

// =============================================================================
// coerceString
// =============================================================================
describe("coerceString", () => {
	it("returns trimmed string", () => {
		expect(coerceString("  hello  ")).toBe("hello");
	});

	it("returns null for empty string after trim", () => {
		expect(coerceString("")).toBeNull();
		expect(coerceString("   ")).toBeNull();
	});

	it("returns null for non-string types", () => {
		expect(coerceString(null)).toBeNull();
		expect(coerceString(undefined)).toBeNull();
		expect(coerceString(42)).toBeNull();
		expect(coerceString({})).toBeNull();
	});
});

// =============================================================================
// resolveName
// =============================================================================
describe("resolveName", () => {
	const baseParticipant: NormalizedParticipant = {
		person_key: "speaker-a",
		speaker_label: "SPEAKER A",
		role: "participant",
		display_name: null,
		inferred_name: null,
		organization: null,
		summary: null,
		segments: [],
		personas: [],
		facets: [],
		scales: [],
	};

	const metadata = { accountId: "test", participantName: "Meta Name" };

	it("prefers display_name", () => {
		const result = resolveName(
			{ ...baseParticipant, display_name: "Sarah Chen" },
			0,
			metadata,
		);
		expect(result).toEqual({ name: "Sarah Chen", source: "display" });
	});

	it("falls back to inferred_name", () => {
		const result = resolveName(
			{ ...baseParticipant, inferred_name: "John Doe" },
			0,
			metadata,
		);
		expect(result).toEqual({ name: "John Doe", source: "inferred" });
	});

	it("falls back to humanized person_key", () => {
		const result = resolveName(
			{ ...baseParticipant, person_key: "john_doe" },
			0,
			{ accountId: "test" },
		);
		expect(result).toEqual({ name: "John Doe", source: "person_key" });
	});

	it("falls back to metadata participantName", () => {
		const result = resolveName(
			{ ...baseParticipant, person_key: "" },
			0,
			metadata,
		);
		expect(result).toEqual({ name: "Meta Name", source: "metadata" });
	});

	it("falls back to indexed 'Participant N' when nothing matches", () => {
		const result = resolveName(
			{ ...baseParticipant, person_key: "" },
			2,
			{ accountId: "test" },
		);
		expect(result).toEqual({ name: "Participant 3", source: "fallback" });
	});

	it("skips empty/whitespace-only candidates", () => {
		const result = resolveName(
			{ ...baseParticipant, display_name: "   ", inferred_name: "Real Name" },
			0,
			{ accountId: "test" },
		);
		expect(result).toEqual({ name: "Real Name", source: "inferred" });
	});
});
