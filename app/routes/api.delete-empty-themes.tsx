/**
 * API endpoint to delete themes with 0 evidence
 * POST /api/delete-empty-themes
 */

import type { ActionFunctionArgs } from "react-router";
import { userContext } from "~/server/user-context";

export async function action({ request, context }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 });
	}

	const { supabase } = context.get(userContext);
	if (!supabase) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	const formData = await request.formData();
	const project_id = formData.get("project_id") as string;

	if (!project_id) {
		return Response.json({ error: "Missing project_id" }, { status: 400 });
	}

	// Find themes with 0 evidence using two queries
	// Get all themes
	const { data: allThemes, error: themesError } = await supabase
		.from("themes")
		.select("id, name")
		.eq("project_id", project_id);

	if (themesError) {
		console.error("Error fetching themes:", themesError);
		return Response.json({ error: "Failed to fetch themes" }, { status: 500 });
	}

	// Get themes with evidence
	const { data: themesWithEvidence } = await supabase
		.from("theme_evidence")
		.select("theme_id")
		.eq("project_id", project_id);

	const themesWithEvidenceSet = new Set(themesWithEvidence?.map((t) => t.theme_id) || []);
	const emptyThemesList = allThemes?.filter((t) => !themesWithEvidenceSet.has(t.id)) || [];

	if (!emptyThemesList || emptyThemesList.length === 0) {
		return Response.json({ ok: true, deleted: 0, message: "No empty themes found" });
	}

	const themeIds = emptyThemesList.map((t) => t.id);

	// Delete the empty themes
	const { error: deleteError } = await supabase.from("themes").delete().in("id", themeIds);

	if (deleteError) {
		console.error("Error deleting empty themes:", deleteError);
		return Response.json({ error: "Failed to delete empty themes" }, { status: 500 });
	}

	return Response.json({
		ok: true,
		deleted: themeIds.length,
		message: `Deleted ${themeIds.length} themes with no linked evidence`,
		deleted_themes: emptyThemesList.map((t) => t.name),
	});
}
