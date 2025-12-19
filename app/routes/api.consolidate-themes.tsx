/**
 * API route to consolidate themes across a project
 *
 * POST: Trigger theme consolidation as a background task with real-time progress
 * Returns a runId that can be used to subscribe to progress updates
 */

import { tasks } from "@trigger.dev/sdk/v3";
import consola from "consola";
import type { ActionFunctionArgs } from "react-router";
import type { consolidateThemesTask } from "~/../src/trigger/themes/consolidateThemes";
import { getServerClient } from "~/lib/supabase/client.server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    // Get authenticated user
    const { getAuthenticatedUser } =
      await import("~/lib/supabase/client.server");
    const { user } = await getAuthenticatedUser(request);
    if (!user?.sub) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { client: userDb } = getServerClient(request);

    const formData = await request.formData();
    const projectId = formData.get("project_id")?.toString();
    const accountId = formData.get("account_id")?.toString();
    const similarityThreshold = parseFloat(
      formData.get("similarity_threshold")?.toString() || "0.85",
    );

    if (!projectId || !accountId) {
      return Response.json(
        { error: "project_id and account_id are required" },
        { status: 400 },
      );
    }

    // Verify user has access to this project
    const { data: project, error: projectError } = await userDb
      .from("projects")
      .select("id, name")
      .eq("id", projectId)
      .eq("account_id", accountId)
      .single();

    if (projectError || !project) {
      return Response.json(
        { error: "Project not found or access denied" },
        { status: 404 },
      );
    }

    consola.info(
      `[consolidate-themes] Triggering consolidation task for project ${project.name} (${projectId})`,
    );

    // Trigger the background task
    const handle = await tasks.trigger<typeof consolidateThemesTask>(
      "themes.consolidate",
      {
        projectId,
        accountId,
        similarityThreshold,
      },
    );

    consola.info(
      `[consolidate-themes] Task triggered with runId: ${handle.id}`,
    );

    return Response.json({
      ok: true,
      runId: handle.id,
      message: "Theme consolidation started",
    });
  } catch (error: unknown) {
    consola.error("[consolidate-themes] Error:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to start theme consolidation";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
