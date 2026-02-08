import type { ActionFunctionArgs } from "@react-router/node";
import { refreshInterviewQuestions } from "~/lib/database/project-answers.server";
import { createSupabaseServerClient } from "~/lib/supabase/client.server";

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 });
	}

	try {
		const formData = await request.formData();
		const projectId = formData.get("projectId") as string;
		const interviewId = formData.get("interviewId") as string;

		if (!projectId || !interviewId) {
			return Response.json({ error: "Missing projectId or interviewId" }, { status: 400 });
		}

		const supabase = createSupabaseServerClient(request);

		// Refresh the interview questions to sync with current interview_prompts
		await refreshInterviewQuestions(supabase, { projectId, interviewId });

		return Response.json({ success: true });
	} catch (error) {
		console.error("Error refreshing interview questions:", error);
		return Response.json({ error: "Failed to refresh interview questions" }, { status: 500 });
	}
}
