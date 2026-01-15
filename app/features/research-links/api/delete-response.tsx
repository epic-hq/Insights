/**
 * API route for deleting a survey response
 */
import consola from "consola";
import type { ActionFunctionArgs } from "react-router";
import { getServerClient } from "~/lib/supabase/client.server";

export const loader = () =>
  Response.json({ message: "Method not allowed" }, { status: 405 });

export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== "DELETE" && request.method !== "POST") {
    return Response.json({ message: "Method not allowed" }, { status: 405 });
  }

  const { listId, responseId } = params;
  if (!listId || !responseId) {
    return Response.json(
      { message: "Missing listId or responseId" },
      { status: 400 },
    );
  }

  const { client: supabase } = getServerClient(request);

  // Verify the response belongs to this list and user has access
  const { data: response, error: fetchError } = await supabase
    .from("research_link_responses")
    .select("id, research_link_id")
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

  // Delete the response
  const { error: deleteError } = await supabase
    .from("research_link_responses")
    .delete()
    .eq("id", responseId);

  if (deleteError) {
    consola.error("[delete-response] Delete error:", deleteError);
    return Response.json({ message: deleteError.message }, { status: 500 });
  }

  consola.info("[delete-response] Deleted response:", responseId);
  return Response.json({ success: true });
}
