import type { ActionFunctionArgs } from "react-router";
import { runBamlWithBilling, userBillingContext } from "~/lib/billing";
import { getLangfuseClient } from "~/lib/langfuse.server";
import { getServerClient } from "~/lib/supabase/client.server";

export const action = async ({ request }: ActionFunctionArgs) => {
	const langfuse = getLangfuseClient();
	const lfTrace = (langfuse as any).trace?.({ name: "api.evaluate-question" });
	try {
		// Get user from request
		const { client: supabase } = getServerClient(request);
		const { data: jwt } = await supabase.auth.getClaims();
		const accountId = jwt?.claims.sub || "anonymous";

		const { question, research_context } = await request.json();

		if (!question || typeof question !== "string") {
			return Response.json({ error: "Question is required" }, { status: 400 });
		}

		const cleanedQuestion = question.trim();

		const billingCtx = userBillingContext(accountId, accountId, "question_evaluation");

		const { result: evaluation } = await runBamlWithBilling(
			billingCtx,
			{
				functionName: "EvaluateInterviewQuestion",
				traceName: "baml.evaluate-question",
				bamlCall: (client) =>
					client.EvaluateInterviewQuestion(cleanedQuestion, research_context || "General user research interview"),
				resourceType: "question",
			},
			`evaluate-question:${accountId}:${cleanedQuestion.slice(0, 30)}:${Date.now()}`
		);
		lfTrace?.update?.({
			metadata: {
				research_context,
				question: cleanedQuestion,
			},
			output: evaluation,
		});
		return Response.json(evaluation);
	} catch (error) {
		console.error("Question evaluation error:", error);
		return Response.json({ error: "Failed to evaluate question" }, { status: 500 });
	} finally {
		lfTrace?.end?.();
	}
};
