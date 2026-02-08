/**
 * API route for deleting a survey (research_link) and its responses.
 * Cascade delete handles research_link_responses automatically.
 * Interviews with research_link_id are set to null (ON DELETE SET NULL).
 */
import consola from "consola";
import type { ActionFunctionArgs } from "react-router";
import { getServerClient, supabaseAdmin } from "~/lib/supabase/client.server";

export const loader = () => Response.json({ message: "Method not allowed" }, { status: 405 });

export async function action({ request, params }: ActionFunctionArgs) {
	if (request.method !== "DELETE" && request.method !== "POST") {
		return Response.json({ message: "Method not allowed" }, { status: 405 });
	}

	const { listId } = params;
	if (!listId) {
		return Response.json({ message: "Missing listId" }, { status: 400 });
	}

	const { client: supabase } = getServerClient(request);

	// Verify user has access to the research link (via RLS)
	const { data: researchLink, error: linkError } = await supabase
		.from("research_links")
		.select("id")
		.eq("id", listId)
		.maybeSingle();

	if (linkError || !researchLink) {
		consola.error("[delete-survey] Access denied or survey not found:", linkError);
		return Response.json({ message: "Access denied or survey not found" }, { status: 403 });
	}

	// Delete the research link using admin client to bypass RLS
	const { error: deleteError } = await supabaseAdmin.from("research_links").delete().eq("id", listId);

	if (deleteError) {
		consola.error("[delete-survey] Delete error:", deleteError);
		return Response.json({ message: deleteError.message }, { status: 500 });
	}

	consola.info("[delete-survey] Deleted survey:", listId);
	return Response.json({ success: true });
}
