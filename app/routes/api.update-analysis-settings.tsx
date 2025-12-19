/**
 * API Route: Update Analysis Settings
 *
 * Updates the analysis settings (theme deduplication and evidence linking thresholds)
 * stored in the project's project_settings JSONB column.
 */

import consola from "consola";
import type { ActionFunctionArgs } from "react-router";
import { getServerClient } from "~/lib/supabase/client.server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const formData = await request.formData();
  const projectId = formData.get("project_id") as string;
  const themeDedupStr = formData.get("theme_dedup_threshold") as string;
  const evidenceLinkStr = formData.get("evidence_link_threshold") as string;

  if (!projectId) {
    return Response.json({ error: "project_id is required" }, { status: 400 });
  }

  const themeDedup = Number.parseFloat(themeDedupStr || "0.8");
  const evidenceLink = Number.parseFloat(evidenceLinkStr || "0.4");

  // Validate thresholds are within reasonable bounds
  if (themeDedup < 0.5 || themeDedup > 0.95) {
    return Response.json(
      { error: "theme_dedup_threshold must be between 0.5 and 0.95" },
      { status: 400 },
    );
  }
  if (evidenceLink < 0.2 || evidenceLink > 0.7) {
    return Response.json(
      { error: "evidence_link_threshold must be between 0.2 and 0.7" },
      { status: 400 },
    );
  }

  const { client: supabase } = getServerClient(request);

  // Get current project_settings to merge
  const { data: currentProject, error: fetchError } = await supabase
    .from("projects")
    .select("project_settings")
    .eq("id", projectId)
    .single();

  if (fetchError) {
    consola.error(
      "[update-analysis-settings] Failed to fetch project:",
      fetchError,
    );
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  const currentSettings =
    (currentProject?.project_settings as Record<string, unknown>) || {};

  const updatedSettings = {
    ...currentSettings,
    analysis: {
      ...(currentSettings.analysis as Record<string, unknown> | undefined),
      theme_dedup_threshold: themeDedup,
      evidence_link_threshold: evidenceLink,
    },
  };

  const { error: updateError } = await supabase
    .from("projects")
    .update({
      project_settings: updatedSettings,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId);

  if (updateError) {
    consola.error(
      "[update-analysis-settings] Failed to update project:",
      updateError,
    );
    return Response.json(
      { error: `Failed to update settings: ${updateError.message}` },
      { status: 500 },
    );
  }

  consola.info(
    `[update-analysis-settings] Updated settings for project ${projectId}:`,
    {
      themeDedup,
      evidenceLink,
    },
  );

  return Response.json({ success: true });
}
