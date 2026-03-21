/**
 * API endpoint for parsing natural language into a BranchRule
 *
 * Takes a plain-English description of skip logic + question context
 * and returns a structured BranchRule with conditions, action, and guidance.
 *
 * Examples:
 * - "If they're a sponsor, skip to the budget question"
 * - "When someone selects 'Enterprise', probe on their approval process and skip to scale questions"
 * - "End the survey if they choose 'Not interested'"
 */

import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import type { ActionFunctionArgs } from "react-router";
import { z } from "zod";
import { PERSON_ATTRIBUTE_KEYS } from "../branching-context";

const RequestSchema = z.object({
	input: z.string().min(1, "Describe the skip logic in plain English"),
	questionId: z.string().min(1),
	questionPrompt: z.string(),
	questionType: z.string(),
	questionOptions: z.array(z.string()).optional().default([]),
	laterQuestions: z
		.array(
			z.object({
				id: z.string(),
				prompt: z.string(),
				index: z.number(),
			})
		)
		.default([]),
	laterSections: z
		.array(
			z.object({
				id: z.string(),
				title: z.string(),
				startQuestionId: z.string(),
			})
		)
		.default([]),
});

const ConditionItemSchema = z.object({
	sourceType: z.enum(["question", "person_attribute"]).default("question"),
	attributeKey: z.string().optional(),
	triggerValue: z
		.string()
		.describe("What response triggers this condition — exact option for select, keyword for text"),
	operator: z
		.enum(["equals", "not_equals", "contains", "not_contains", "selected", "not_selected", "answered", "not_answered"])
		.describe("Condition operator"),
});

const ParsedRuleSchema = z.object({
	sourceType: z.enum(["question", "person_attribute"]).default("question"),
	attributeKey: z.string().optional(),
	triggerValue: z.string().describe("Primary trigger value (for single-condition rules or backwards compat)"),
	operator: z
		.enum(["equals", "not_equals", "contains", "not_contains", "selected", "not_selected", "answered", "not_answered"])
		.describe("Primary condition operator"),
	additionalConditions: z
		.array(ConditionItemSchema)
		.optional()
		.describe("Additional conditions for compound rules. Each has its own triggerValue and operator."),
	conditionLogic: z
		.enum(["and", "or"])
		.optional()
		.default("and")
		.describe("How to combine conditions: 'and' = all must match, 'or' = any can match"),
	action: z.enum(["skip_to", "end_survey"]).describe("What to do when triggered"),
	targetQuestionIndex: z.number().optional().describe("For skip_to: index of the target question in laterQuestions"),
	targetSectionId: z.string().optional().describe("For skip_to: section id when the rule refers to a later section"),
	summary: z.string().describe("Human-readable summary, e.g. 'When sponsors respond, skip to budget questions'"),
	guidance: z
		.string()
		.optional()
		.describe("AI hint for chat mode probing, e.g. 'Probe on ROI expectations and approval process'"),
	confidence: z.enum(["high", "medium", "low"]).describe("How confident the interpretation is"),
});

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return new Response("Method not allowed", { status: 405 });
	}

	try {
		const body = await request.json();
		const parsed = RequestSchema.safeParse(body);
		if (!parsed.success) {
			return { error: "Invalid request", details: parsed.error.issues };
		}

		const { input, questionId, questionPrompt, questionType, questionOptions, laterQuestions, laterSections } =
			parsed.data;

		const isSelect = questionType === "single_select" || questionType === "multi_select";
		const optionsList = questionOptions.length > 0 ? `\nAvailable options: ${questionOptions.join(", ")}` : "";
		const laterQList =
			laterQuestions.length > 0
				? `\nQuestions that come after this one:\n${laterQuestions.map((q) => `  [${q.index}] "${q.prompt}"`).join("\n")}`
				: "";
		const laterSectionList =
			laterSections.length > 0
				? `\nLater sections:\n${laterSections.map((section) => `  [${section.id}] "${section.title}"`).join("\n")}`
				: "";
		const personAttributeList = `\nPerson attributes available for branching:\n${PERSON_ATTRIBUTE_KEYS.map((entry) => `- ${entry.key}: ${entry.label}`).join("\n")}`;

		const result = await generateObject({
			model: anthropic("claude-sonnet-4-20250514"),
			schema: ParsedRuleSchema,
			prompt: `You are parsing a natural language skip logic rule for a survey question.

CURRENT QUESTION:
"${questionPrompt}"
Type: ${questionType}${optionsList}${laterQList}${laterSectionList}${personAttributeList}

USER'S RULE (plain English):
"${input}"

TASK:
Parse this into a structured skip logic rule.

CONDITION SOURCE:
- Use sourceType="question" when the rule depends on what the respondent answers to the current question.
- Use sourceType="person_attribute" when the rule depends on known CRM/profile data like membership_status, seniority_level, company_size, industry, or icp_band.
- When sourceType="person_attribute", set attributeKey to one of the listed person attribute keys.

OPERATOR SELECTION:
${
	isSelect
		? `- This is a select question. Use "equals" for exact option match, "not_equals" for exclusion.
- The triggerValue MUST be one of the available options (exact match).`
		: `- This is a text question. Use "contains" for keyword matching, "not_contains" for exclusion.
- The triggerValue should be a keyword or short phrase to match against.`
}
- Use "answered" / "not_answered" if the rule is about whether the question was answered at all.
- For person attributes, prefer equals/not_equals/contains/not_contains/answered/not_answered.

COMPOUND CONDITIONS:
If the user describes multiple conditions (e.g. "If sponsor AND selected Enterprise"), use additionalConditions.
- Put the primary condition in triggerValue/operator
- Put extra conditions in additionalConditions array
- Set conditionLogic to "and" (all must match) or "or" (any can match) based on the user's intent
- Most rules are single-condition. Only use additionalConditions when the user explicitly describes multiple conditions.
- When multiple answer values route to the same destination, prefer ONE compound rule with conditionLogic="or" instead of separate duplicate rules.
- Example: Founder/Employee/Student all to the same target => one rule with three conditions combined by OR.

ACTION:
- "skip_to": Jump to a later question or later section. Prefer targetSectionId when the user names a block/section like "shared closing" or "founder path".
- "end_survey": End the survey early.

GUIDANCE (important):
If the user mentions probing, exploring, or diving deeper on a topic, capture that as the "guidance" field.
This guidance is used by the AI chat agent to steer conversation. Examples:
- "Probe on their decision-making process for renewals"
- "Explore what ROI metrics matter most to them"
- "Ask follow-up about team size and budget approval workflow"
Even if not explicitly mentioned, infer useful probing guidance from context when the rule implies a segment worth exploring.

SUMMARY:
Write a concise human-readable summary starting with "When...", "If...", or "For...".
When clear, include a path-like label in the summary (e.g. "For founders/employees, go to growth-path questions").

CONFIDENCE:
- HIGH: Clear condition and action
- MEDIUM: Some ambiguity in what to match or where to skip
- LOW: Multiple interpretations possible`,
		});

		// Build the BranchRule
		const r = result.object;

		if (r.sourceType === "person_attribute" && !r.attributeKey) {
			return {
				error: "AI could not determine which person attribute to branch on. Try naming the attribute more explicitly.",
				parsed: r,
			};
		}

		// Validate targetQuestionIndex is in bounds
		let targetQuestion = null;
		let targetSectionId: string | undefined;
		if (r.action === "skip_to") {
			const matchingSection = r.targetSectionId
				? laterSections.find(
						(section) =>
							section.id === r.targetSectionId || section.title.toLowerCase() === r.targetSectionId?.toLowerCase()
					)
				: null;
			if (matchingSection) {
				targetSectionId = matchingSection.id;
			} else if (r.targetQuestionIndex === undefined || r.targetQuestionIndex === null) {
				return {
					error: "AI could not determine which question or section to skip to. Try being more specific.",
					parsed: r,
				};
			} else if (r.targetQuestionIndex < 0 || r.targetQuestionIndex >= laterQuestions.length) {
				return {
					error: `AI referenced question index ${r.targetQuestionIndex} but only ${laterQuestions.length} later questions exist. Try rephrasing.`,
					parsed: r,
				};
			} else {
				targetQuestion = laterQuestions[r.targetQuestionIndex];
			}
		}

		// Build conditions array (primary + any additional)
		const allConditions = [
			r.sourceType === "person_attribute"
				? {
						sourceType: "person_attribute" as const,
						attributeKey: r.attributeKey ?? "",
						operator: r.operator,
						value: r.triggerValue,
					}
				: {
						sourceType: "question" as const,
						questionId,
						operator: r.operator,
						value: r.triggerValue,
					},
			...(r.additionalConditions ?? []).map((c) => ({
				...(c.sourceType === "person_attribute"
					? {
							sourceType: "person_attribute" as const,
							attributeKey: c.attributeKey ?? "",
						}
					: {
							sourceType: "question" as const,
							questionId,
						}),
				operator: c.operator,
				value: c.triggerValue,
			})),
		];

		const rule = {
			id: `nl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
			conditions: {
				logic: (r.conditionLogic ?? "and") as "and" | "or",
				conditions: allConditions,
			},
			action: r.action,
			targetQuestionId: targetQuestion?.id,
			targetSectionId,
			naturalLanguage: input,
			summary: r.summary,
			guidance: r.guidance,
			source: "ai_generated" as const,
			confidence: r.confidence,
		};

		return { rule, parsed: r };
	} catch (error) {
		console.error("Failed to parse branch rule:", error);
		return { error: "Failed to parse rule. Please try again." };
	}
}
