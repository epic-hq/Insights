/**
 * API endpoint for deleting walkthrough videos
 * DELETE /api/research-links/:listId/delete-walkthrough
 */
import consola from "consola";
import type { ActionFunctionArgs } from "react-router";
import { getServerClient } from "~/lib/supabase/client.server";

export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== "DELETE") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const { listId } = params;
  if (!listId) {
    return Response.json({ error: "Missing list ID" }, { status: 400 });
  }

  // Create authenticated client
  const { client: supabase, headers } = getServerClient(request);

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers });
  }

  try {
    // Verify the user has access to this research link
    const { data: link, error: linkError } = await supabase
      .from("research_links")
      .select("id, walkthrough_video_url")
      .eq("id", listId)
      .single();

    if (linkError || !link) {
      return Response.json(
        { error: "Ask link not found" },
        { status: 404, headers },
      );
    }

    // Clear the walkthrough video URL
    const { error: updateError } = await supabase
      .from("research_links")
      .update({ walkthrough_video_url: null })
      .eq("id", listId);

    if (updateError) {
      consola.error("Failed to delete walkthrough video URL", updateError);
      return Response.json(
        { error: "Failed to delete video" },
        { status: 500, headers },
      );
    }

    // Note: We're not deleting from R2 here to avoid complexity
    // The file will be orphaned but can be cleaned up later if needed

    consola.info("Walkthrough video deleted", { listId });

    return Response.json({ success: true }, { headers });
  } catch (error) {
    consola.error("Error deleting walkthrough video", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500, headers },
    );
  }
}
