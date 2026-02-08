/**
 * Tests for research link schemas — focused on the response save schema
 * and question schema validation.
 */

import { describe, expect, it } from "vitest";
import {
	ResearchLinkAnonymousStartSchema,
	ResearchLinkQuestionSchema,
	ResearchLinkResponseSaveSchema,
	ResearchLinkResponseStartSchema,
} from "./schemas";

describe("ResearchLinkResponseSaveSchema", () => {
	it("should accept a valid completed response", () => {
		const payload = {
			responseId: "22c66a0c-cfbb-4caf-a1c6-704ac5596bda",
			responses: {
				q1: "Weekly",
				q2: "Thick crust",
				q3: "Pepperoni",
			},
			completed: true,
		};
		const result = ResearchLinkResponseSaveSchema.safeParse(payload);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.completed).toBe(true);
			expect(result.data.responseId).toBe("22c66a0c-cfbb-4caf-a1c6-704ac5596bda");
			expect(result.data.merge).toBe(false); // default
		}
	});

	it("should accept a partial save (no completed flag)", () => {
		const payload = {
			responseId: "22c66a0c-cfbb-4caf-a1c6-704ac5596bda",
			responses: { q1: "Weekly" },
		};
		const result = ResearchLinkResponseSaveSchema.safeParse(payload);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.completed).toBeUndefined();
		}
	});

	it("should accept merge flag", () => {
		const payload = {
			responseId: "22c66a0c-cfbb-4caf-a1c6-704ac5596bda",
			responses: { q1: "Updated answer" },
			merge: true,
		};
		const result = ResearchLinkResponseSaveSchema.safeParse(payload);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.merge).toBe(true);
		}
	});

	it("should reject missing responseId", () => {
		const payload = { responses: { q1: "Answer" } };
		const result = ResearchLinkResponseSaveSchema.safeParse(payload);
		expect(result.success).toBe(false);
	});

	it("should reject non-UUID responseId", () => {
		const payload = {
			responseId: "not-a-uuid",
			responses: {},
		};
		const result = ResearchLinkResponseSaveSchema.safeParse(payload);
		expect(result.success).toBe(false);
	});

	it("should default responses to empty object when omitted", () => {
		const payload = {
			responseId: "22c66a0c-cfbb-4caf-a1c6-704ac5596bda",
		};
		const result = ResearchLinkResponseSaveSchema.safeParse(payload);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.responses).toEqual({});
		}
	});

	it("should accept array values in responses (multi_select)", () => {
		const payload = {
			responseId: "22c66a0c-cfbb-4caf-a1c6-704ac5596bda",
			responses: {
				q1: ["Option A", "Option B"],
				q2: "Single answer",
			},
		};
		const result = ResearchLinkResponseSaveSchema.safeParse(payload);
		expect(result.success).toBe(true);
	});

	it("should accept boolean values in responses", () => {
		const payload = {
			responseId: "22c66a0c-cfbb-4caf-a1c6-704ac5596bda",
			responses: { q1: true, q2: false },
		};
		const result = ResearchLinkResponseSaveSchema.safeParse(payload);
		expect(result.success).toBe(true);
	});

	it("should accept null values in responses", () => {
		const payload = {
			responseId: "22c66a0c-cfbb-4caf-a1c6-704ac5596bda",
			responses: { q1: null },
		};
		const result = ResearchLinkResponseSaveSchema.safeParse(payload);
		expect(result.success).toBe(true);
	});
});

describe("ResearchLinkAnonymousStartSchema", () => {
	it("should accept empty payload (fully anonymous)", () => {
		const result = ResearchLinkAnonymousStartSchema.safeParse({});
		expect(result.success).toBe(true);
	});

	it("should accept payload with responseId for resuming", () => {
		const result = ResearchLinkAnonymousStartSchema.safeParse({
			responseId: "22c66a0c-cfbb-4caf-a1c6-704ac5596bda",
		});
		expect(result.success).toBe(true);
	});

	it("should accept payload with responseMode", () => {
		const result = ResearchLinkAnonymousStartSchema.safeParse({
			responseMode: "chat",
		});
		expect(result.success).toBe(true);
	});

	it("should reject invalid responseMode", () => {
		const result = ResearchLinkAnonymousStartSchema.safeParse({
			responseMode: "invalid",
		});
		expect(result.success).toBe(false);
	});
});

describe("ResearchLinkResponseStartSchema", () => {
	it("should accept valid email", () => {
		const result = ResearchLinkResponseStartSchema.safeParse({
			email: "test@example.com",
		});
		expect(result.success).toBe(true);
	});

	it("should reject missing email", () => {
		const result = ResearchLinkResponseStartSchema.safeParse({});
		expect(result.success).toBe(false);
	});

	it("should reject invalid email format", () => {
		const result = ResearchLinkResponseStartSchema.safeParse({
			email: "not-an-email",
		});
		expect(result.success).toBe(false);
	});
});

describe("ResearchLinkQuestionSchema", () => {
	it("should accept minimal question", () => {
		const result = ResearchLinkQuestionSchema.safeParse({
			id: "q1",
			prompt: "What is your favorite color?",
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.type).toBe("auto"); // default
			expect(result.data.required).toBe(false); // default
		}
	});

	it("should accept all question types", () => {
		const types = ["auto", "short_text", "long_text", "single_select", "multi_select", "likert", "image_select"];
		for (const type of types) {
			const result = ResearchLinkQuestionSchema.safeParse({
				id: "q1",
				prompt: "Test question",
				type,
			});
			expect(result.success).toBe(true);
		}
	});

	it("should reject question without id", () => {
		const result = ResearchLinkQuestionSchema.safeParse({
			prompt: "Question without id",
		});
		expect(result.success).toBe(false);
	});

	it("should reject question without prompt", () => {
		const result = ResearchLinkQuestionSchema.safeParse({
			id: "q1",
		});
		expect(result.success).toBe(false);
	});

	it("should accept likert config", () => {
		const result = ResearchLinkQuestionSchema.safeParse({
			id: "q1",
			prompt: "Rate this",
			type: "likert",
			likertScale: 7,
			likertLabels: { low: "Bad", high: "Good" },
		});
		expect(result.success).toBe(true);
	});

	it("should reject likert scale out of range", () => {
		const tooLow = ResearchLinkQuestionSchema.safeParse({
			id: "q1",
			prompt: "Rate this",
			type: "likert",
			likertScale: 2,
		});
		expect(tooLow.success).toBe(false);

		const tooHigh = ResearchLinkQuestionSchema.safeParse({
			id: "q1",
			prompt: "Rate this",
			type: "likert",
			likertScale: 11,
		});
		expect(tooHigh.success).toBe(false);
	});

	it("should accept image options", () => {
		const result = ResearchLinkQuestionSchema.safeParse({
			id: "q1",
			prompt: "Pick an image",
			type: "image_select",
			imageOptions: [
				{ label: "Cat", imageUrl: "https://example.com/cat.jpg" },
				{ label: "Dog", imageUrl: "https://example.com/dog.jpg" },
			],
		});
		expect(result.success).toBe(true);
	});

	it("should accept branching config", () => {
		const result = ResearchLinkQuestionSchema.safeParse({
			id: "q1",
			prompt: "Pick one",
			type: "single_select",
			options: ["A", "B"],
			branching: null,
		});
		expect(result.success).toBe(true);
	});
});
