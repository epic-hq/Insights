/**
 * API route to manually regenerate AI summary (conversation takeaways) for an interview.
 * Supports optional custom instructions to guide the AI's analysis.
 */

import { tasks } from "@trigger.dev/sdk/v3";
import type { ActionFunctionArgs } from "react-router";
import type { regenerateAISummaryTask } from "~/../src/trigger/sales/regenerateAISummary";
import { getServerClient } from "~/lib/supabase/client.server";

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 });
	}

	try {
		// Get authenticated user
		const { getAuthenticatedUser } = await import("~/lib/supabase/client.server");
		const { user: claims } = await getAuthenticatedUser(request);
		if (!claims?.sub) {
			return Response.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Get user-scoped client
		const { client: userDb } = getServerClient(request);

		const formData = await request.formData();
		const interviewId = formData.get("interview_id")?.toString();
		const customInstructions = formData.get("custom_instructions")?.toString() || null;

		if (!interviewId) {
			return Response.json({ ok: false, error: "Missing interview_id" }, { status: 400 });
		}

		// Verify interview exists and user has access
		const { data: interview, error: interviewError } = await userDb
			.from("interviews")
			.select("id, account_id, project_id")
			.eq("id", interviewId)
			.single();

		if (interviewError || !interview) {
			return Response.json({ ok: false, error: "Interview not found" }, { status: 404 });
		}

		// Trigger the AI summary regeneration task
		const handle = await tasks.trigger<typeof regenerateAISummaryTask>("sales.regenerate-ai-summary", {
			interviewId: interview.id,
			customInstructions,
			computedBy: claims.sub,
		});

		return Response.json({
			ok: true,
			taskId: handle.id,
			message: customInstructions
				? "AI summary regeneration started with custom instructions"
				: "AI summary regeneration started",
		});
	} catch (error: any) {
		console.error("[regenerate-ai-summary] Error:", error);
		return Response.json(
			{
				ok: false,
				error: error?.message || "Failed to regenerate AI summary",
			},
			{ status: 500 }
		);
	}
}
