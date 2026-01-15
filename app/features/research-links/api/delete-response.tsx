/**
 * API route for deleting survey responses (single or bulk)
 */
import consola from "consola";
import type { ActionFunctionArgs } from "react-router";
import { getServerClient, supabaseAdmin } from "~/lib/supabase/client.server";

export const loader = () =>
  Response.json({ message: "Method not allowed" }, { status: 405 });

export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== "DELETE" && request.method !== "POST") {
    return Response.json({ message: "Method not allowed" }, { status: 405 });
  }

  const { listId } = params;
  if (!listId) {
    return Response.json({ message: "Missing listId" }, { status: 400 });
  }

  // Get responseId from params or body (for bulk delete)
  let responseIds: string[] = [];

  if (params.responseId) {
    responseIds = [params.responseId];
  } else {
    // Try to get IDs from request body for bulk delete
    try {
      const body = await request.json();
      if (Array.isArray(body.responseIds)) {
        responseIds = body.responseIds;
      }
    } catch {
      // No body or invalid JSON
    }
  }

  if (responseIds.length === 0) {
    return Response.json(
      { message: "No response IDs provided" },
      { status: 400 },
    );
  }

  const { client: supabase } = getServerClient(request);

  // Verify user has access to the research link (via RLS)
  const { data: researchLink, error: linkError } = await supabase
    .from("research_links")
    .select("id, account_id")
    .eq("id", listId)
    .maybeSingle();

  if (linkError || !researchLink) {
    consola.error(
      "[delete-response] Access denied or link not found:",
      linkError,
    );
    return Response.json(
      { message: "Access denied or survey not found" },
      { status: 403 },
    );
  }

  // Verify all responses belong to this list using admin client
  const { data: responses, error: fetchError } = await supabaseAdmin
    .from("research_link_responses")
    .select("id")
    .eq("research_link_id", listId)
    .in("id", responseIds);

  if (fetchError) {
    consola.error("[delete-response] Fetch error:", fetchError);
    return Response.json({ message: fetchError.message }, { status: 500 });
  }

  const validIds = responses?.map((r) => r.id) ?? [];
  if (validIds.length === 0) {
    return Response.json(
      { message: "No valid responses found" },
      { status: 404 },
    );
  }

  // Delete the responses using admin client to bypass RLS
  const { error: deleteError, count } = await supabaseAdmin
    .from("research_link_responses")
    .delete()
    .in("id", validIds);

  if (deleteError) {
    consola.error("[delete-response] Delete error:", deleteError);
    return Response.json({ message: deleteError.message }, { status: 500 });
  }

  consola.info("[delete-response] Deleted responses:", validIds.length);
  return Response.json({ success: true, deleted: validIds.length });
}
