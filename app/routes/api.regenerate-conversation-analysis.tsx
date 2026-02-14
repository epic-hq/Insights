/**
 * Lightweight endpoint to (re)generate the conversation-overview lens
 * on an existing interview, without re-running the full processing pipeline.
 *
 * POST /api/regenerate-conversation-analysis
 * Body: { interviewId: string }
 */

import consola from "consola";
import type { ActionFunctionArgs } from "react-router";
import { upsertConversationOverviewLens } from "~/lib/conversation-analyses/upsertConversationOverviewLens.server";
import { createSupabaseAdminClient, getAuthenticatedUser } from "~/lib/supabase/client.server";
import {
	enrichConversationAnalysisWithEvidenceIds,
	generateConversationAnalysis,
} from "~/utils/conversationAnalysis.server";

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 });
	}

	try {
		const { user } = await getAuthenticatedUser(request);
		if (!user?.sub) {
			return Response.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { interviewId } = await request.json();
		if (!interviewId) {
			return Response.json({ error: "interviewId required" }, { status: 400 });
		}

		const supabase = createSupabaseAdminClient();

		const { data: interview, error: fetchError } = await supabase
			.from("interviews")
			.select("id, title, transcript, participant_pseudonym, account_id, project_id")
			.eq("id", interviewId)
			.single();

		if (fetchError || !interview) {
			return Response.json({ error: "Interview not found" }, { status: 404 });
		}

		if (!interview.transcript) {
			return Response.json({ error: "No transcript available to analyze" }, { status: 400 });
		}

		consola.info("[regenerate-conversation-analysis] Starting for interview", interview.id);

		const result = await generateConversationAnalysis({
			transcript: interview.transcript,
			context: {
				meetingTitle: interview.title || undefined,
				attendees: interview.participant_pseudonym ? [interview.participant_pseudonym] : undefined,
			},
		});

		const { data: evidenceForTraceability } = await supabase
			.from("evidence")
			.select("id, verbatim, gist")
			.eq("interview_id", interview.id);

		const enrichedResult = enrichConversationAnalysisWithEvidenceIds(
			result,
			(evidenceForTraceability || []).map((item) => ({
				id: item.id,
				verbatim: item.verbatim,
				gist: item.gist,
			}))
		);

		const { success, error: upsertError } = await upsertConversationOverviewLens({
			db: supabase,
			interviewId: interview.id,
			accountId: interview.account_id,
			projectId: interview.project_id,
			analysis: enrichedResult,
			computedBy: user.sub,
		});

		if (!success) {
			consola.error("[regenerate-conversation-analysis] Upsert failed:", upsertError);
			return Response.json({ error: "Failed to save analysis" }, { status: 500 });
		}

		consola.info("[regenerate-conversation-analysis] Done for interview", interview.id, {
			keyTakeaways: enrichedResult.key_takeaways.length,
			recommendations: enrichedResult.recommended_next_steps.length,
			openQuestions: enrichedResult.open_questions.length,
		});

		return Response.json({
			success: true,
			keyTakeaways: enrichedResult.key_takeaways.length,
			recommendations: enrichedResult.recommended_next_steps.length,
		});
	} catch (error) {
		consola.error("[regenerate-conversation-analysis] Error:", error);
		return Response.json(
			{ error: error instanceof Error ? error.message : "Analysis generation failed" },
			{ status: 500 }
		);
	}
}
