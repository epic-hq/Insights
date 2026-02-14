import consola from "consola";
import type { ActionFunctionArgs } from "react-router";
import { getServerClient } from "~/lib/supabase/client.server";

export async function action({ request }: ActionFunctionArgs) {
	const formData = await request.formData();
	const interviewId = formData.get("interviewId")?.toString();
	const projectId = formData.get("projectId")?.toString();
	const accountId = formData.get("accountId")?.toString();
	const lensId = formData.get("lensId")?.toString();
	const field = formData.get("field")?.toString();
	const value = formData.get("value")?.toString() ?? "";

	if (!interviewId || !projectId || !accountId || !lensId || !field) {
		return Response.json({ ok: false, error: "Missing required parameters" }, { status: 400 });
	}

	if (field !== "summary" && field !== "notes") {
		return Response.json({ ok: false, error: "Unsupported field" }, { status: 400 });
	}

	const { client: supabase } = getServerClient(request);

	const { data, error } = await supabase
		.from("interviews")
		.select("conversation_analysis")
		.eq("id", interviewId)
		.eq("project_id", projectId)
		.single();

	if (error || !data) {
		consola.error("Failed to fetch conversation_analysis for lens update", error);
		return Response.json({ ok: false, error: "Interview not found" }, { status: 404 });
	}

	const conversationAnalysis =
		(data.conversation_analysis as Record<string, unknown> | null | undefined) &&
		typeof data.conversation_analysis === "object"
			? { ...(data.conversation_analysis as Record<string, unknown>) }
			: {};

	const existingCustomLenses =
		conversationAnalysis.custom_lenses && typeof conversationAnalysis.custom_lenses === "object"
			? { ...(conversationAnalysis.custom_lenses as Record<string, { summary?: string; notes?: string }>) }
			: {};

	const currentLens = existingCustomLenses[lensId] ?? {};
	existingCustomLenses[lensId] = {
		...currentLens,
		[field]: value,
	};

	conversationAnalysis.custom_lenses = existingCustomLenses;

	const { error: updateError } = await supabase
		.from("interviews")
		.update({ conversation_analysis: conversationAnalysis })
		.eq("id", interviewId)
		.eq("project_id", projectId);

	if (updateError) {
		consola.error("Failed to persist custom lens update", updateError);
		return Response.json({ ok: false, error: "Failed to update lens" }, { status: 500 });
	}

	return Response.json({ ok: true, lensId, field, value });
}
