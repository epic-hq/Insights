import type { LoaderFunctionArgs } from "react-router";
import { getResearchAnswerRollup } from "~/lib/database/research-answers.server";
import { getServerClient } from "~/lib/supabase/client.server";

export async function loader({ request }: LoaderFunctionArgs) {
	const url = new URL(request.url);
	const projectId = url.searchParams.get("projectId");
	if (!projectId) {
		return Response.json({ error: "projectId is required" }, { status: 400 });
	}

	const { client: supabase } = getServerClient(request);

	try {
		const data = await getResearchAnswerRollup(supabase, projectId);
		return Response.json({ data });
	} catch (error) {
		return Response.json(
			{
				error: error instanceof Error ? error.message : "Failed to load research answers",
			},
			{ status: 500 }
		);
	}
}
