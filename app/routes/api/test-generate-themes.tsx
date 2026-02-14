import consola from "consola";
import type { ActionFunctionArgs } from "react-router";
import { userContext } from "~/server/user-context";

export async function action({ context, request }: ActionFunctionArgs) {
	const { supabase, account_id } = context.get(userContext);
	const formData = await request.formData();
	const projectId = formData.get("projectId") as string;

	consola.log("[Test Generate Themes] Starting diagnostic test");
	consola.log("[Test Generate Themes] Project ID:", projectId);
	consola.log("[Test Generate Themes] Account ID:", account_id);

	if (!projectId || !account_id) {
		return Response.json(
			{
				success: false,
				error: "Missing projectId or account_id",
				projectId,
				account_id,
			},
			{ status: 400 }
		);
	}

	try {
		// Test 1: Check Supabase connection
		consola.log("[Test Generate Themes] Testing Supabase connection...");
		const { data: testData, error: testError } = await supabase
			.from("evidence")
			.select("count(*)")
			.eq("project_id", projectId)
			.single();

		if (testError) {
			consola.error("[Test Generate Themes] Supabase test failed:", testError);
			return Response.json(
				{
					success: false,
					error: "Supabase connection failed",
					details: testError.message,
				},
				{ status: 500 }
			);
		}

		consola.log("[Test Generate Themes] Evidence count for project:", testData);

		// Test 2: Load actual evidence
		const { data: evidence, error: evidenceError } = await supabase
			.from("evidence")
			.select("id, verbatim, personas, segments, journey_stage, support")
			.eq("project_id", projectId)
			.order("created_at", { ascending: false })
			.limit(10);

		if (evidenceError) {
			consola.error("[Test Generate Themes] Evidence loading failed:", evidenceError);
			return Response.json(
				{
					success: false,
					error: "Evidence loading failed",
					details: evidenceError.message,
				},
				{ status: 500 }
			);
		}

		const evidenceRows = (evidence ?? []) as Array<{ id: string } & Record<string, unknown>>;
		if (evidenceRows.length) {
			const { data: facetRows, error: facetError } = await supabase
				.from("evidence_facet")
				.select("evidence_id, kind_slug, label")
				.in(
					"evidence_id",
					evidenceRows.map((row) => row.id)
				);
			if (facetError) throw facetError;

			const map = new Map<string, string[]>();
			for (const facet of facetRows ?? []) {
				if (!facet || typeof facet !== "object") continue;
				const evidence_id = (facet as any).evidence_id as string | undefined;
				const kind_slug = (facet as any).kind_slug as string | undefined;
				const label = (facet as any).label as string | undefined;
				if (!evidence_id) continue;
				const list = map.get(evidence_id) ?? [];
				const derivedTag = kind_slug && label ? `${kind_slug}:${label}` : kind_slug || label;
				if (derivedTag) list.push(derivedTag);
				map.set(evidence_id, list);
			}

			for (const row of evidenceRows) {
				(row as any).kind_tags = map.get(row.id) ?? [];
			}
		}

		consola.log("[Test Generate Themes] Evidence loaded:", evidenceRows.length, "items");

		// Test 3: Try BAML import
		try {
			const { b } = await import("baml_client");
			consola.log("[Test Generate Themes] BAML client imported successfully");

			return Response.json({
				success: true,
				tests: {
					supabase: "✅ Connected",
					evidence_count: evidence?.length || 0,
					baml_client: "✅ Imported",
					first_evidence: evidence?.[0] ? "✅ Available" : "❌ None found",
				},
			});
		} catch (bamlError) {
			consola.error("[Test Generate Themes] BAML import failed:", bamlError);
			return Response.json(
				{
					success: false,
					error: "BAML client import failed",
					details: bamlError instanceof Error ? bamlError.message : String(bamlError),
					tests: {
						supabase: "✅ Connected",
						evidence_count: evidence?.length || 0,
						baml_client: "❌ Import failed",
					},
				},
				{ status: 500 }
			);
		}
	} catch (error) {
		consola.error("[Test Generate Themes] Unexpected error:", error);
		return Response.json(
			{
				success: false,
				error: "Unexpected error",
				details: error instanceof Error ? error.message : String(error),
			},
			{ status: 500 }
		);
	}
}
