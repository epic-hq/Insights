/**
 * API route for AI-powered campaign recipient recommendations.
 * Returns ranked people based on campaign strategy using the
 * get_campaign_recommendations RPC.
 */

import consola from "consola";
import type { ActionFunctionArgs } from "react-router";
import { z } from "zod";
import { getServerClient } from "~/lib/supabase/client.server";

const GetRecommendationsSchema = z.object({
	strategy: z.enum(["pricing_validation", "sparse_data_discovery", "theme_validation", "general_research"]),
	limit: z.number().int().min(1).max(50).default(10),
});

export async function action({ request, params }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 });
	}

	const { accountId, projectId } = params;
	if (!accountId || !projectId) {
		return Response.json({ error: "Missing account or project ID" }, { status: 400 });
	}

	let payload: unknown;
	try {
		payload = await request.json();
	} catch {
		return Response.json({ error: "Invalid JSON" }, { status: 400 });
	}

	const parsed = GetRecommendationsSchema.safeParse(payload);
	if (!parsed.success) {
		return Response.json({ error: "Invalid request", details: parsed.error }, { status: 400 });
	}

	const { strategy, limit } = parsed.data;
	const { client: supabase } = getServerClient(request);

	const { data, error } = await supabase.rpc("get_campaign_recommendations", {
		p_account_id: accountId,
		p_project_id: projectId,
		p_strategy: strategy,
		p_limit: limit,
	});

	if (error) {
		consola.error("Failed to get campaign recommendations:", error);
		return Response.json({ error: error.message }, { status: 500 });
	}

	const recommendations = (data || []).map(
		(rec: {
			person_id: string;
			person_name: string;
			person_email: string;
			person_title: string;
			icp_score: number;
			evidence_count: number;
			recommendation_score: number;
			recommendation_reason: string;
		}) => ({
			personId: rec.person_id,
			name: rec.person_name,
			email: rec.person_email,
			title: rec.person_title,
			icpScore: rec.icp_score,
			evidenceCount: rec.evidence_count,
			recommendationScore: rec.recommendation_score,
			reason: rec.recommendation_reason,
		})
	);

	return Response.json({ recommendations });
}

export const loader = () => Response.json({ error: "Method not allowed" }, { status: 405 });
