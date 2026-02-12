/**
 * API route for generating personalized questions for campaign surveys.
 * Uses BAML GeneratePersonalizedQuestions to create questions per person
 * based on their context (facets, ICP, themes) and project goals.
 */

import { b } from "baml_client";
import consola from "consola";
import type { ActionFunctionArgs } from "react-router";
import { z } from "zod";
import { fetchPersonContext, fetchProjectContext } from "~/features/research-links/lib/person-context.server";
import { getServerClient } from "~/lib/supabase/client.server";

const GenerateQuestionsSchema = z.object({
	campaignId: z.string().uuid(),
	personIds: z.array(z.string().uuid()).optional(),
	questionCount: z.number().int().min(3).max(10).default(5),
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

	const parsed = GenerateQuestionsSchema.safeParse(payload);
	if (!parsed.success) {
		return Response.json({ error: "Invalid request", details: parsed.error }, { status: 400 });
	}

	const { campaignId, personIds, questionCount } = parsed.data;
	const { client: supabase } = getServerClient(request);

	// Get campaign details
	const { data: campaign, error: campaignError } = await supabase
		.from("research_links")
		.select("id, name, campaign_strategy, campaign_goal")
		.eq("id", campaignId)
		.eq("account_id", accountId)
		.eq("project_id", projectId)
		.single();

	if (campaignError || !campaign) {
		return Response.json({ error: "Campaign not found" }, { status: 404 });
	}

	// Get draft surveys for this campaign
	let query = supabase
		.from("personalized_surveys")
		.select("id, person_id, survey_goal")
		.eq("research_link_id", campaignId)
		.eq("status", "draft");

	if (personIds && personIds.length > 0) {
		query = query.in("person_id", personIds);
	}

	const { data: surveys, error: surveysError } = await query;

	if (surveysError) {
		consola.error("Failed to fetch surveys:", surveysError);
		return Response.json({ error: surveysError.message }, { status: 500 });
	}

	if (!surveys || surveys.length === 0) {
		return Response.json({ error: "No draft surveys found" }, { status: 404 });
	}

	// Fetch project context once (shared across all people)
	const projectContext = await fetchProjectContext(supabase, projectId);

	// Generate questions for each survey
	const results: Array<{
		personId: string;
		surveyId: string;
		success: boolean;
		questionCount?: number;
		questions?: Array<{
			id: string;
			prompt: string;
			type: string;
			rationale: string;
			uses_attributes: string[];
			evidence_type: string;
			order: number;
		}>;
		generationMetadata?: Record<string, unknown>;
		error?: string;
	}> = [];

	for (const survey of surveys) {
		try {
			const personContext = await fetchPersonContext(supabase, survey.person_id, projectId);

			const surveyGoal = survey.survey_goal as "validate" | "discover" | "deep_dive" | "pricing";

			const questions = await b.GeneratePersonalizedQuestions(
				personContext,
				projectContext,
				{
					goal: surveyGoal,
					focus_theme: null,
					target_segment: null,
				},
				questionCount
			);

			const mappedQuestions = questions.map((q) => ({
				id: crypto.randomUUID(),
				prompt: q.text,
				type: "long_text",
				rationale: q.rationale,
				uses_attributes: q.uses_attributes,
				evidence_type: q.evidence_type,
				order: q.order,
			}));

			const { error: updateError } = await supabase
				.from("personalized_surveys")
				.update({
					questions: mappedQuestions,
					generation_metadata: {
						person_context: personContext,
						project_context: projectContext,
						generated_at: new Date().toISOString(),
					},
				})
				.eq("id", survey.id);

			if (updateError) {
				consola.error(`Failed to update survey ${survey.id}:`, updateError);
				results.push({
					personId: survey.person_id,
					surveyId: survey.id,
					success: false,
					error: updateError.message,
				});
			} else {
				results.push({
					personId: survey.person_id,
					surveyId: survey.id,
					success: true,
					questionCount: questions.length,
					questions: mappedQuestions,
					generationMetadata: {
						person_context: {
							icp_band: personContext.icp_band,
							sparse_mode: personContext.sparse_mode,
						},
						generated_at: new Date().toISOString(),
					},
				});
			}
		} catch (error) {
			consola.error(`Failed to generate questions for person ${survey.person_id}:`, error);
			results.push({
				personId: survey.person_id,
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			});
		}
	}

	const successCount = results.filter((r) => r.success).length;

	return Response.json({
		total: results.length,
		success: successCount,
		failed: results.length - successCount,
		results,
	});
}

export const loader = () => Response.json({ error: "Method not allowed" }, { status: 405 });
