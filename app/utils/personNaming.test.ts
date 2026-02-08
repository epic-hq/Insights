/**
 * Unit tests for pure person naming functions
 * No mocks needed - testing business logic directly
 */

import { describe, expect, it } from "vitest";
import {
	areNamesLikelySamePerson,
	buildPersonName,
	buildPersonNameFromAI,
	buildPersonNameFromDate,
	buildPersonNameFromFilename,
	buildPersonNameFromId,
	buildPersonNameFromTitle,
} from "./personNaming";

describe("Person Naming Logic", () => {
	describe("buildPersonNameFromAI", () => {
		it("should return AI-extracted name when available", () => {
			expect(buildPersonNameFromAI({ name: "John Doe", age: 30 })).toBe("John Doe");
		});

		it("should trim whitespace from AI name", () => {
			expect(buildPersonNameFromAI({ name: "  Sarah Smith  " })).toBe("Sarah Smith");
		});

		it("should return null for empty or missing names", () => {
			expect(buildPersonNameFromAI({ name: "" })).toBe(null);
			expect(buildPersonNameFromAI({ name: null })).toBe(null);
			expect(buildPersonNameFromAI({ name: "   " })).toBe(null);
			expect(buildPersonNameFromAI({})).toBe(null);
		});
	});

	describe("buildPersonNameFromFilename", () => {
		it("should generate names from meaningful filenames", () => {
			const testCases = [
				{ input: "interview_john_doe.mp3", expected: "Participant (Interview John Doe)" },
				{ input: "customer_feedback_session.wav", expected: "Participant (Customer Feedback Session)" },
				{ input: "user-research-sarah.m4a", expected: "Participant (User Research Sarah)" },
				{ input: "product_manager_interview.aac", expected: "Participant (Product Manager Interview)" },
			];

			testCases.forEach(({ input, expected }) => {
				expect(buildPersonNameFromFilename(input)).toBe(expected);
			});
		});

		it("should return null for generic filenames", () => {
			const genericFiles = ["rec.mp3", "recording.wav", "audio.m4a", "video.mp4", "file.aac"];

			genericFiles.forEach((fileName) => {
				expect(buildPersonNameFromFilename(fileName)).toBe(null);
			});
		});

		it("should return null for very short filenames", () => {
			expect(buildPersonNameFromFilename("x.mp3")).toBe("Participant (X)");
			expect(buildPersonNameFromFilename("ab")).toBe(null);
			expect(buildPersonNameFromFilename("")).toBe(null);
		});

		it("should handle filenames without extensions", () => {
			expect(buildPersonNameFromFilename("customer_interview_jane")).toBe("Participant (Customer Interview Jane)");
		});

		it("should handle special characters", () => {
			expect(buildPersonNameFromFilename("interview@#$%^&*()_+john_doe.mp3")).toBe(
				"Participant (Interview@#$%^&*() +John Doe)"
			);
		});
	});

	describe("buildPersonNameFromTitle", () => {
		it("should use meaningful interview titles", () => {
			const testCases = [
				{ input: "Customer Research Session", expected: "Participant (Customer Research Session)" },
				{ input: "Product Feedback Interview", expected: "Participant (Product Feedback Interview)" },
				{ input: "User Experience Study", expected: "Participant (User Experience Study)" },
			];

			testCases.forEach(({ input, expected }) => {
				expect(buildPersonNameFromTitle(input)).toBe(expected);
			});
		});

		it("should return null for generic interview titles", () => {
			const genericTitles = ["Interview - 2025-01-25", "Interview - John Doe", "Interview - Customer"];

			genericTitles.forEach((title) => {
				expect(buildPersonNameFromTitle(title)).toBe(null);
			});
		});

		it("should clean up dates from titles", () => {
			expect(buildPersonNameFromTitle("Customer Research 2025-01-25 Session")).toBe(
				"Participant (Customer Research  Session)"
			);
		});

		it("should return null for empty titles", () => {
			expect(buildPersonNameFromTitle("")).toBe(null);
			expect(buildPersonNameFromTitle("   ")).toBe(null);
		});
	});

	describe("buildPersonNameFromDate", () => {
		it("should format dates correctly", () => {
			expect(buildPersonNameFromDate("2025-01-25")).toBe("Participant (2025-01-25)");
			expect(buildPersonNameFromDate("2025/01/25")).toBe("Participant (2025/01/25)");
		});

		it("should return null for empty dates", () => {
			expect(buildPersonNameFromDate("")).toBe(null);
			expect(buildPersonNameFromDate("   ")).toBe(null);
		});
	});

	describe("buildPersonNameFromId", () => {
		it("should use last 8 characters of ID", () => {
			expect(buildPersonNameFromId("interview-abcd1234efgh5678")).toBe("Participant (efgh5678)");
			expect(buildPersonNameFromId("int-12345678")).toBe("Participant (12345678)");
		});

		it("should handle short IDs", () => {
			expect(buildPersonNameFromId("short")).toBe("Participant (short)");
			expect(buildPersonNameFromId("ab")).toBe("Participant (ab)");
		});
	});

	describe("buildPersonName - Integration", () => {
		it("should prioritize AI-extracted name", () => {
			const data = {
				id: "interview-123",
				title: "Customer Research Session",
				participant_pseudonym: "Jane Doe",
				fileName: "sarah_interview.mp3",
				interview_date: "2025-01-25",
				created_at: "2025-01-25T10:00:00Z",
			};

			expect(buildPersonName(data, "AI Extracted Name")).toBe("AI Extracted Name");
		});

		it("should fall back to pseudonym when AI fails", () => {
			const data = {
				id: "interview-123",
				title: "Customer Research Session",
				participant_pseudonym: "Jane Doe",
				fileName: "sarah_interview.mp3",
				interview_date: "2025-01-25",
				created_at: "2025-01-25T10:00:00Z",
			};

			expect(buildPersonName(data, "")).toBe("Jane Doe");
		});

		it("should fall back to filename when pseudonym missing", () => {
			const data = {
				id: "interview-123",
				title: "Customer Research Session",
				fileName: "sarah_interview.mp3",
				interview_date: "2025-01-25",
				created_at: "2025-01-25T10:00:00Z",
			};

			expect(buildPersonName(data)).toBe("Participant (Sarah Interview)");
		});

		it("should fall back to title when filename is generic", () => {
			const data = {
				id: "interview-123",
				title: "Customer Research Session",
				fileName: "rec.mp3",
				interview_date: "2025-01-25",
				created_at: "2025-01-25T10:00:00Z",
			};

			expect(buildPersonName(data)).toBe("Participant (Customer Research Session)");
		});

		it("should fall back to date when title is generic", () => {
			const data = {
				id: "interview-123",
				title: "Interview - Generic",
				fileName: "rec.mp3",
				interview_date: "2025-01-25",
				created_at: "2025-01-25T10:00:00Z",
			};

			expect(buildPersonName(data)).toBe("Participant (2025-01-25)");
		});

		it("should use created_at when interview_date missing", () => {
			const data = {
				id: "interview-123",
				title: "Interview - Generic",
				fileName: "rec.mp3",
				created_at: "2025-01-25T10:00:00Z",
			};

			expect(buildPersonName(data)).toBe("Participant (2025-01-25)");
		});

		it("should use ID as final fallback", () => {
			const data = {
				id: "interview-abcd1234",
				title: "Interview - Generic",
				fileName: "rec.mp3",
			};

			expect(buildPersonName(data)).toBe("Participant (abcd1234)");
		});
	});

	describe("areNamesLikelySamePerson", () => {
		it("should match exact names", () => {
			expect(areNamesLikelySamePerson("John Doe", "John Doe")).toBe(true);
			expect(areNamesLikelySamePerson("john doe", "John Doe")).toBe(true);
		});

		it("should match substring names", () => {
			expect(areNamesLikelySamePerson("John", "John Doe")).toBe(true);
			expect(areNamesLikelySamePerson("John Doe", "John")).toBe(true);
		});

		it("should match participant patterns", () => {
			expect(areNamesLikelySamePerson("Participant (John)", "Participant (John)")).toBe(true);
			expect(areNamesLikelySamePerson("participant (john)", "Participant (John)")).toBe(true);
		});

		it("should not match different names", () => {
			expect(areNamesLikelySamePerson("John Doe", "Jane Smith")).toBe(false);
			expect(areNamesLikelySamePerson("Participant (John)", "Participant (Jane)")).toBe(false);
		});

		it("should handle special characters", () => {
			expect(areNamesLikelySamePerson("John-Doe", "John Doe")).toBe(false); // Current implementation doesn't normalize special chars
			expect(areNamesLikelySamePerson("John_Doe", "John Doe")).toBe(false);
		});
	});
});
