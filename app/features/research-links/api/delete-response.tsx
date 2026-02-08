/**
 * API route for deleting a single survey response
 */
import consola from "consola";
import type { ActionFunctionArgs } from "react-router";
import { getServerClient, supabaseAdmin } from "~/lib/supabase/client.server";

export const loader = () => Response.json({ message: "Method not allowed" }, { status: 405 });

export async function action({ request, params }: ActionFunctionArgs) {
	if (request.method !== "DELETE" && request.method !== "POST") {
		return Response.json({ message: "Method not allowed" }, { status: 405 });
	}

	const { listId, responseId } = params;
	if (!listId || !responseId) {
		return Response.json({ message: "Missing listId or responseId" }, { status: 400 });
	}

	const { client: supabase } = getServerClient(request);

	// Verify user has access to the research link (via RLS)
	const { data: researchLink, error: linkError } = await supabase
		.from("research_links")
		.select("id, account_id")
		.eq("id", listId)
		.maybeSingle();

	if (linkError || !researchLink) {
		consola.error("[delete-response] Access denied or link not found:", linkError);
		return Response.json({ message: "Access denied or survey not found" }, { status: 403 });
	}

	// Verify the response belongs to this list using admin client
	const { data: response, error: fetchError } = await supabaseAdmin
		.from("research_link_responses")
		.select("id")
		.eq("id", responseId)
		.eq("research_link_id", listId)
		.maybeSingle();

	if (fetchError) {
		consola.error("[delete-response] Fetch error:", fetchError);
		return Response.json({ message: fetchError.message }, { status: 500 });
	}

	if (!response) {
		return Response.json({ message: "Response not found" }, { status: 404 });
	}

	// Delete the response using admin client to bypass RLS
	const { error: deleteError } = await supabaseAdmin.from("research_link_responses").delete().eq("id", responseId);

	if (deleteError) {
		consola.error("[delete-response] Delete error:", deleteError);
		return Response.json({ message: deleteError.message }, { status: 500 });
	}

	consola.info("[delete-response] Deleted response:", responseId);
	return Response.json({ success: true });
}
