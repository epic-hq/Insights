/**
 * API endpoint to fetch similar themes using embedding similarity
 * GET /api/similar-themes?theme_id=xxx&project_id=xxx&limit=5
 */

import type { LoaderFunctionArgs } from "react-router";
import { userContext } from "~/server/user-context";

export async function loader({ request, context }: LoaderFunctionArgs) {
	const url = new URL(request.url);
	const theme_id = url.searchParams.get("theme_id");
	const project_id = url.searchParams.get("project_id");
	const limit = Number.parseInt(url.searchParams.get("limit") || "5", 10);

	if (!theme_id || !project_id) {
		return Response.json({ error: "Missing theme_id or project_id" }, { status: 400 });
	}

	const { supabase } = context.get(userContext);

	if (!supabase) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	// 1. Get the theme's embedding
	const { data: theme, error: themeError } = await supabase
		.from("themes")
		.select("id, name, embedding")
		.eq("id", theme_id)
		.single();

	if (themeError || !theme) {
		return Response.json({ error: "Theme not found" }, { status: 404 });
	}

	if (!theme.embedding) {
		return Response.json({ similar_themes: [], message: "Theme has no embedding" });
	}

	// 2. Call find_similar_themes RPC
	const { data: similarThemes, error: rpcError } = await supabase.rpc("find_similar_themes", {
		query_embedding: theme.embedding,
		project_id_param: project_id,
		match_threshold: 0.6, // Lower threshold for more results
		match_count: limit + 1, // +1 to exclude self
	});

	if (rpcError) {
		console.error("find_similar_themes error:", rpcError);
		return Response.json({ error: "Failed to find similar themes" }, { status: 500 });
	}

	// Filter out the current theme and return
	const filtered = (similarThemes || []).filter((t: { id: string }) => t.id !== theme_id).slice(0, limit);

	return Response.json({ similar_themes: filtered });
}
