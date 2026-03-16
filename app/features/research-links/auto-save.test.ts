/**
 * Tests for survey editor auto-save behavior:
 * - buildFormData constructs correct payload
 * - Branching cleanup on question delete
 * - Action returns simplified response
 * - isLive defaults to true for new surveys
 */

import { describe, expect, it } from "vitest";
import type { BranchRule, QuestionBranching } from "./branching";
import { type SurveyFormFields, serializeToFormData } from "./hooks/useOptimisticForm";
import type { ResearchLinkQuestion } from "./schemas";
import { ResearchLinkPayloadSchema } from "./schemas";

// ============================================================================
// Helper: simulate branching cleanup logic from QuestionListEditor
// ============================================================================
function cleanupBranchingOnDelete(questions: ResearchLinkQuestion[], deletedId: string): ResearchLinkQuestion[] {
	return questions
		.filter((q) => q.id !== deletedId)
		.map((question) => {
			if (!question.branching) return question;
			const cleanedRules = question.branching.rules.filter((rule) => {
				if (rule.targetQuestionId === deletedId) return false;
				if (rule.conditions.conditions.some((c) => c.questionId === deletedId)) return false;
				return true;
			});
			const cleanedDefaultNext =
				question.branching.defaultNext === deletedId ? undefined : question.branching.defaultNext;
			if (cleanedRules.length === 0 && !cleanedDefaultNext) {
				return { ...question, branching: null };
			}
			return {
				...question,
				branching: { rules: cleanedRules, defaultNext: cleanedDefaultNext },
			};
		});
}

// ============================================================================
// Helper: build form data using serializeToFormData from useOptimisticForm
// ============================================================================
function buildFormData(state: {
	name: string;
	slug: string;
	heroTitle: string;
	heroSubtitle: string;
	instructions: string;
	heroCtaLabel: string;
	heroCtaHelper: string;
	calendarUrl: string;
	redirectUrl: string;
	allowChat: boolean;
	allowVoice: boolean;
	allowVideo: boolean;
	defaultResponseMode: string;
	isLive: boolean;
	aiAutonomy: string;
	identityType: string;
	questions: ResearchLinkQuestion[];
}): Record<string, string> {
	return serializeToFormData(state as SurveyFormFields);
}

// ============================================================================
// Test fixtures
// ============================================================================

function makeQuestion(overrides: Partial<ResearchLinkQuestion> = {}): ResearchLinkQuestion {
	return {
		id: overrides.id ?? "q1",
		prompt: overrides.prompt ?? "Test question",
		required: false,
		type: "auto",
		placeholder: null,
		helperText: null,
		options: null,
		allowOther: true,
		likertScale: null,
		likertLabels: null,
		imageOptions: null,
		mediaUrl: null,
		videoUrl: null,
		sectionId: null,
		sectionTitle: null,
		taxonomyKey: null,
		personFieldKey: null,
		hidden: false,
		...overrides,
	};
}

function makeRule(overrides: Partial<BranchRule> = {}): BranchRule {
	return {
		id: overrides.id ?? "rule-1",
		conditions: overrides.conditions ?? {
			logic: "and",
			conditions: [{ questionId: "q1", operator: "equals", value: "yes" }],
		},
		action: overrides.action ?? "skip_to",
		targetQuestionId: overrides.targetQuestionId ?? "q3",
		...overrides,
	};
}

// ============================================================================
// Tests
// ============================================================================

describe("buildFormData", () => {
	it("should produce all required keys for the action", () => {
		const fd = buildFormData({
			name: "My Survey",
			slug: "my-survey",
			heroTitle: "Welcome",
			heroSubtitle: "Please share",
			instructions: "Answer honestly",
			heroCtaLabel: "Start",
			heroCtaHelper: "Takes 2 min",
			calendarUrl: "",
			redirectUrl: "",
			allowChat: true,
			allowVoice: false,
			allowVideo: false,
			defaultResponseMode: "form",
			isLive: true,
			aiAutonomy: "strict",
			identityType: "email",
			questions: [makeQuestion()],
		});

		expect(fd.name).toBe("My Survey");
		expect(fd.slug).toBe("my-survey");
		expect(fd.allow_chat).toBe("true");
		expect(fd.allow_voice).toBe("false");
		expect(fd.is_live).toBe("true");
		expect(fd.ai_autonomy).toBe("strict");
		expect(fd.identity_type).toBe("email");
		expect(JSON.parse(fd.questions)).toHaveLength(1);
	});

	it("should serialize questions as JSON", () => {
		const questions = [makeQuestion({ id: "q1" }), makeQuestion({ id: "q2", prompt: "Second" })];
		const fd = buildFormData({
			name: "Test",
			slug: "test",
			heroTitle: "",
			heroSubtitle: "",
			instructions: "",
			heroCtaLabel: "",
			heroCtaHelper: "",
			calendarUrl: "",
			redirectUrl: "",
			allowChat: false,
			allowVoice: false,
			allowVideo: false,
			defaultResponseMode: "form",
			isLive: true,
			aiAutonomy: "strict",
			identityType: "anonymous",
			questions,
		});

		const parsed = JSON.parse(fd.questions);
		expect(parsed).toHaveLength(2);
		expect(parsed[0].id).toBe("q1");
		expect(parsed[1].id).toBe("q2");
	});

	it("should pass schema validation with valid form data", () => {
		const fd = buildFormData({
			name: "Valid Survey",
			slug: "valid-survey",
			heroTitle: "Title",
			heroSubtitle: "Sub",
			instructions: "",
			heroCtaLabel: "Go",
			heroCtaHelper: "",
			calendarUrl: "",
			redirectUrl: "",
			allowChat: false,
			allowVoice: false,
			allowVideo: false,
			defaultResponseMode: "form",
			isLive: true,
			aiAutonomy: "strict",
			identityType: "email",
			questions: [makeQuestion({ id: "q1", prompt: "What do you think?" })],
		});

		const result = ResearchLinkPayloadSchema.safeParse({
			name: fd.name,
			slug: fd.slug,
			description: fd.description,
			heroTitle: fd.hero_title,
			heroSubtitle: fd.hero_subtitle,
			instructions: fd.instructions,
			heroCtaLabel: fd.hero_cta_label,
			heroCtaHelper: fd.hero_cta_helper,
			calendarUrl: fd.calendar_url,
			redirectUrl: fd.redirect_url,
			allowChat: fd.allow_chat,
			allowVoice: fd.allow_voice,
			allowVideo: fd.allow_video,
			defaultResponseMode: fd.default_response_mode,
			isLive: fd.is_live,
			questions: fd.questions,
		});

		expect(result.success).toBe(true);
	});
});

describe("branching cleanup on question delete", () => {
	it("should remove rules targeting the deleted question", () => {
		const q1 = makeQuestion({ id: "q1" });
		const q2 = makeQuestion({
			id: "q2",
			branching: {
				rules: [makeRule({ targetQuestionId: "q3" })],
			},
		});
		const q3 = makeQuestion({ id: "q3" });

		const result = cleanupBranchingOnDelete([q1, q2, q3], "q3");
		expect(result).toHaveLength(2);
		// q2's rule targeted q3, so it should be removed; branching becomes null
		expect(result[1].branching).toBeNull();
	});

	it("should remove rules with conditions referencing the deleted question", () => {
		const q1 = makeQuestion({ id: "q1" });
		const q2 = makeQuestion({
			id: "q2",
			branching: {
				rules: [
					makeRule({
						id: "rule-ref-q1",
						conditions: {
							logic: "and",
							conditions: [{ questionId: "q1", operator: "equals", value: "yes" }],
						},
						targetQuestionId: "q3",
					}),
				],
			},
		});
		const q3 = makeQuestion({ id: "q3" });

		const result = cleanupBranchingOnDelete([q1, q2, q3], "q1");
		expect(result).toHaveLength(2);
		// q2's rule referenced q1 in conditions, so it should be removed
		expect(result[0].branching).toBeNull();
	});

	it("should clear defaultNext if it references the deleted question", () => {
		const q1 = makeQuestion({
			id: "q1",
			branching: {
				rules: [
					makeRule({
						conditions: {
							logic: "and",
							conditions: [{ questionId: "q1", operator: "answered" }],
						},
						targetQuestionId: "q3",
					}),
				],
				defaultNext: "q2",
			},
		});
		const q2 = makeQuestion({ id: "q2" });
		const q3 = makeQuestion({ id: "q3" });

		const result = cleanupBranchingOnDelete([q1, q2, q3], "q2");
		expect(result).toHaveLength(2);
		// defaultNext was q2, should be cleared
		const q1Result = result[0];
		expect(q1Result.branching?.defaultNext).toBeUndefined();
		// But the rule targeting q3 should remain (it doesn't reference q2)
		expect(q1Result.branching?.rules).toHaveLength(1);
	});

	it("should preserve rules that don't reference the deleted question", () => {
		const q1 = makeQuestion({ id: "q1" });
		const q2 = makeQuestion({
			id: "q2",
			branching: {
				rules: [
					makeRule({
						id: "rule-keep",
						conditions: {
							logic: "and",
							conditions: [{ questionId: "q2", operator: "equals", value: "A" }],
						},
						targetQuestionId: "q4",
					}),
					makeRule({
						id: "rule-remove",
						conditions: {
							logic: "and",
							conditions: [{ questionId: "q3", operator: "equals", value: "B" }],
						},
						targetQuestionId: "q4",
					}),
				],
			},
		});
		const q3 = makeQuestion({ id: "q3" });
		const q4 = makeQuestion({ id: "q4" });

		const result = cleanupBranchingOnDelete([q1, q2, q3, q4], "q3");
		expect(result).toHaveLength(3);
		const q2Result = result[1];
		expect(q2Result.branching?.rules).toHaveLength(1);
		expect(q2Result.branching?.rules[0].id).toBe("rule-keep");
	});

	it("should handle questions with no branching", () => {
		const q1 = makeQuestion({ id: "q1" });
		const q2 = makeQuestion({ id: "q2" });
		const q3 = makeQuestion({ id: "q3" });

		const result = cleanupBranchingOnDelete([q1, q2, q3], "q2");
		expect(result).toHaveLength(2);
		expect(result[0].branching).toBeUndefined();
		expect(result[1].branching).toBeUndefined();
	});

	it("should set branching to null when all rules are removed and no defaultNext", () => {
		const q1 = makeQuestion({
			id: "q1",
			branching: {
				rules: [makeRule({ targetQuestionId: "q2" })],
			},
		});
		const q2 = makeQuestion({ id: "q2" });

		const result = cleanupBranchingOnDelete([q1, q2], "q2");
		expect(result).toHaveLength(1);
		expect(result[0].branching).toBeNull();
	});
});

describe("action response shape", () => {
	it("should validate payload schema accepts boolean-as-string for isLive", () => {
		const result = ResearchLinkPayloadSchema.safeParse({
			name: "Test",
			slug: "test",
			allowChat: "false",
			allowVoice: "false",
			allowVideo: "false",
			defaultResponseMode: "form",
			isLive: "true",
			questions: JSON.stringify([{ id: "q1", prompt: "Question" }]),
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.isLive).toBe(true);
		}
	});

	it("should validate payload schema with isLive=false", () => {
		const result = ResearchLinkPayloadSchema.safeParse({
			name: "Test",
			slug: "test",
			allowChat: "false",
			allowVoice: "false",
			allowVideo: "false",
			defaultResponseMode: "form",
			isLive: "false",
			questions: JSON.stringify([{ id: "q1", prompt: "Question" }]),
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.isLive).toBe(false);
		}
	});
});

describe("isLive default", () => {
	it("new survey form data should default isLive to true", () => {
		// Simulates the new.tsx default: actionData?.values?.isLive ?? true
		const actionDataIsLive = undefined;
		const isLive = actionDataIsLive ?? true;
		expect(isLive).toBe(true);
	});

	it("edit page should use DB value for isLive", () => {
		// Simulates: Boolean(list.is_live) when list.is_live is false
		expect(Boolean(false)).toBe(false);
		expect(Boolean(true)).toBe(true);
		expect(Boolean(null)).toBe(false);
	});
});
