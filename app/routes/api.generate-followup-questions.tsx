import consola from "consola";
import type { ActionFunctionArgs } from "react-router";
import { generateFollowUpQuestions } from "~/utils/research-analysis.server";

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 });
	}

	try {
		const formData = await request.formData();
		const originalQuestion = formData.get("originalQuestion") as string;
		const researchContext = formData.get("researchContext") as string;
		const targetRoles = formData.get("targetRoles") as string;
		const customInstructions = formData.get("customInstructions") as string;

		if (!originalQuestion) {
			return Response.json({ error: "Original question is required" }, { status: 400 });
		}

		consola.log("Generating follow-up questions for:", originalQuestion);

		const followUpSet = await generateFollowUpQuestions(
			originalQuestion,
			researchContext || "General user research",
			targetRoles || "Various roles",
			customInstructions
		);

		return Response.json({
			success: true,
			followUpSet,
		});
	} catch (error) {
		consola.error("Failed to generate follow-up questions:", error);
		return Response.json(
			{
				error: "Failed to generate follow-up questions",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		);
	}
}
