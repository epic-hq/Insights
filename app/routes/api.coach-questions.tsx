/**
 * API endpoint for question coaching via BAML.
 * Returns pithy coaching nudges for problematic questions.
 *
 * POST /api/coach-questions
 * Body: { questions: string[], context: string, mode: "interview" | "survey" }
 */
import consola from "consola";
import type { ActionFunctionArgs } from "react-router";
import { z } from "zod";
import { runBamlWithBilling, userBillingContext } from "~/lib/billing";
import { getServerClient } from "~/lib/supabase/client.server";

const CoachRequestSchema = z.object({
	questions: z.array(z.string()).min(1, "At least one question required").max(30, "Too many questions"),
	context: z.string().default("General research"),
	mode: z.enum(["interview", "survey"]).default("survey"),
});

export const action = async ({ request }: ActionFunctionArgs) => {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 });
	}

	try {
		const { client: supabase } = getServerClient(request);
		const { data: jwt } = await supabase.auth.getClaims();
		const accountId = jwt?.claims.sub || "anonymous";

		const body = await request.json();
		const parsed = CoachRequestSchema.safeParse(body);
		if (!parsed.success) {
			return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
		}

		const { questions, context, mode } = parsed.data;

		const billingCtx = userBillingContext(accountId, accountId, "question_coaching");

		const { result } = await runBamlWithBilling(
			billingCtx,
			{
				functionName: "CoachQuestionSet",
				traceName: "baml.coach-questions",
				bamlCall: (client) => client.CoachQuestionSet(questions, context, mode),
				resourceType: "question",
			},
			`coach-questions:${accountId}:${questions.length}q:${Date.now()}`
		);

		return Response.json(result);
	} catch (error) {
		consola.error("Question coaching error:", error);
		return Response.json({ error: "Failed to coach questions" }, { status: 500 });
	}
};
