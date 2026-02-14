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

Guidelines:
- Ask open-ended questions that elicit detailed, thoughtful responses
- Focus on understanding motivations, pain points, and desired outcomes
- Avoid yes/no questions
- Make questions conversational and easy to understand
- Each question should provide unique insight
${customPrompt ? "- Follow the user's specific instructions above" : ""}

Generate questions that will help gather valuable research insights.`,
		});

		return Response.json({ questions: result.object.questions });
	} catch (error) {
		console.error("Failed to generate questions:", error);
		return Response.json({ error: "Failed to generate questions. Please try again." }, { status: 500 });
	}
}
