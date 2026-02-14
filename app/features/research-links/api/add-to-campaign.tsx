/**
 * API route for adding people to a campaign.
 * Creates personalized_surveys records in draft status.
 */

import consola from "consola";
import type { ActionFunctionArgs } from "react-router";
import { z } from "zod";
import { getServerClient } from "~/lib/supabase/client.server";

const AddToCampaignSchema = z.object({
	campaignId: z.string().uuid(),
	personIds: z.array(z.string().uuid()).min(1),
	surveyGoal: z.enum(["validate", "discover", "deep_dive", "pricing"]).default("discover"),
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

	const parsed = AddToCampaignSchema.safeParse(payload);
	if (!parsed.success) {
		return Response.json({ error: "Invalid request", details: parsed.error }, { status: 400 });
	}

	const { campaignId, personIds, surveyGoal } = parsed.data;
	const { client: supabase } = getServerClient(request);

	// Verify campaign exists and belongs to this account/project
	const { data: campaign, error: campaignError } = await supabase
		.from("research_links")
		.select("id, name, campaign_strategy")
		.eq("id", campaignId)
		.eq("account_id", accountId)
		.eq("project_id", projectId)
		.single();

	if (campaignError || !campaign) {
		return Response.json({ error: "Campaign not found" }, { status: 404 });
	}

	const surveysToInsert = personIds.map((personId) => ({
		account_id: accountId,
		project_id: projectId,
		research_link_id: campaignId,
		person_id: personId,
		survey_goal: surveyGoal,
		generation_metadata: {},
		questions: [],
		status: "draft" as const,
	}));

	const { data: surveys, error: insertError } = await supabase
		.from("personalized_surveys")
		.insert(surveysToInsert)
		.select("id, person_id, status");

	if (insertError) {
		if (insertError.code === "23505") {
			return Response.json({ error: "One or more people are already in this campaign" }, { status: 409 });
		}
		consola.error("Failed to add people to campaign:", insertError);
		return Response.json({ error: insertError.message }, { status: 500 });
	}

	return Response.json({
		added: surveys?.length || 0,
		surveys,
	});
}

export const loader = () => Response.json({ error: "Method not allowed" }, { status: 405 });
