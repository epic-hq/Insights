/**
 * API route for creating a new survey campaign.
 * Creates a research_link with campaign_strategy and campaign_goal.
 */

import consola from "consola";
import type { ActionFunctionArgs } from "react-router";
import { z } from "zod";
import { getServerClient } from "~/lib/supabase/client.server";

const CreateCampaignSchema = z.object({
	strategy: z.enum(["pricing_validation", "sparse_data_discovery", "theme_validation", "general_research"]),
	goal: z.string().optional(),
	name: z.string().optional(),
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

	const parsed = CreateCampaignSchema.safeParse(payload);
	if (!parsed.success) {
		return Response.json({ error: "Invalid request", details: parsed.error }, { status: 400 });
	}

	const { strategy, goal } = parsed.data;
	const { client: supabase } = getServerClient(request);

	const campaignName = parsed.data.name || generateCampaignName(strategy, new Date());
	const slug = generateSlug(campaignName);

	const { data: campaign, error } = await supabase
		.from("research_links")
		.insert({
			account_id: accountId,
			project_id: projectId,
			name: campaignName,
			slug,
			campaign_strategy: strategy,
			campaign_goal: goal || null,
			campaign_status: "draft",
			questions: [],
			is_live: false,
		})
		.select("id, name, slug, campaign_strategy, campaign_goal, campaign_status")
		.single();

	if (error) {
		consola.error("Failed to create campaign:", error);
		return Response.json({ error: error.message }, { status: 500 });
	}

	return Response.json({ campaign });
}

export const loader = () => Response.json({ error: "Method not allowed" }, { status: 405 });

function generateCampaignName(strategy: string, date: Date): string {
	const strategyNames: Record<string, string> = {
		pricing_validation: "Pricing Validation",
		sparse_data_discovery: "Discovery Campaign",
		theme_validation: "Theme Validation",
		general_research: "Research Campaign",
	};

	const strategyName = strategyNames[strategy] || "Survey Campaign";
	const dateStr = date.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
	});

	return `${strategyName} - ${dateStr}`;
}

function generateSlug(name: string): string {
	const base = name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");

	const suffix = Math.random().toString(36).substring(2, 8);
	return `${base}-${suffix}`;
}
