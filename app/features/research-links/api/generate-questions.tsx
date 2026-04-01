/**
 * API endpoint for LLM-powered survey question generation
 * Generates relevant questions based on survey name and description
 */

import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import type { ActionFunctionArgs } from "react-router";
import { z } from "zod";

const RequestSchema = z.object({
	surveyName: z.string().min(1),
	surveyDescription: z.string().optional().default(""),
	existingQuestions: z.string().optional().default("[]"),
	customPrompt: z.string().optional().default(""),
});

const QuestionsResponseSchema = z.object({
	questions: z.array(z.string()).min(1).max(5),
});

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 });
	}

	try {
		const formData = await request.formData();
		const rawPayload = {
			surveyName: formData.get("surveyName") ?? "",
			surveyDescription: formData.get("surveyDescription") ?? "",
			existingQuestions: formData.get("existingQuestions") ?? "[]",
			customPrompt: formData.get("customPrompt") ?? "",
		};

		const parsed = RequestSchema.safeParse(rawPayload);
		if (!parsed.success) {
			return Response.json({ error: "Invalid request" }, { status: 400 });
		}

		const { surveyName, surveyDescription, existingQuestions, customPrompt } = parsed.data;

		let existing: string[] = [];
		try {
			existing = JSON.parse(existingQuestions);
		} catch {
			existing = [];
		}

		const existingContext =
			existing.length > 0
				? `\n\nExisting questions (don't repeat these):\n${existing.map((q, i) => `${i + 1}. ${q}`).join("\n")}`
				: "";

		const customInstructions = customPrompt ? `\n\nUser's specific instructions:\n${customPrompt}` : "";

		const result = await generateObject({
			model: anthropic("claude-sonnet-4-20250514"),
			schema: QuestionsResponseSchema,
			prompt: `You are helping create a research survey. Generate 3-5 high-quality questions for this survey.

Survey name: ${surveyName}
${surveyDescription ? `Description: ${surveyDescription}` : ""}
${existingContext}
${customInstructions}

Survey design guidelines:
- Default to quick, low-friction surveys for first-time/no-incentive respondents
- Keep wording plain and simple (one idea per question, no jargon)
- Prioritize past behavior and lived experiences over hypotheticals
- Include a mix of: context, behavior/experience, pain/impact, and goals/outcomes
- Avoid leading language and emotionally loaded wording
- Avoid yes/no unless it is a true screener
- Each question should provide unique insight (no redundancy)
- Keep cognitive load low; avoid long or compound questions
- Never add respondent-facing phrases like "Optional but encouraged"
${customPrompt ? "- Follow the user's specific instructions above" : ""}

Generate questions that maximize completion rate and produce actionable insights.`,
		});

		return Response.json({ questions: result.object.questions });
	} catch (error) {
		console.error("Failed to generate questions:", error);
		return Response.json({ error: "Failed to generate questions. Please try again." }, { status: 500 });
	}
}
