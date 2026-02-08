import consola from "consola";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";

/**
 * Fix stuck interviews that have transcript but wrong status
 *
 * GET /api/fix-stuck-interview - Find all stuck interviews (dry run)
 * POST /api/fix-stuck-interview - Fix interviews
 *   Body: { interviewId: string } - Fix single interview
 *   Body: { fixAll: true } - Fix ALL stuck interviews
 */

export async function loader({ request }: LoaderFunctionArgs) {
	const supabase = createSupabaseAdminClient();

	// Find all stuck interviews (any in processing states, with or without transcript)
	const { data: stuck, error } = await supabase
		.from("interviews")
		.select("id, title, status, project_id, transcript")
		.in("status", ["uploading", "uploaded", "processing", "transcribing"]);

	if (error) {
		consola.error("Error finding stuck interviews:", error);
		return Response.json({ error: "Failed to query interviews" }, { status: 500 });
	}

	return Response.json({
		found: stuck?.length || 0,
		interviews: (stuck || []).map((i) => ({
			id: i.id,
			title: i.title,
			status: i.status,
			project_id: i.project_id,
			has_transcript: !!i.transcript,
		})),
		message: "Use POST with { fixAll: true } to fix all, or { interviewId: 'xxx' } to fix one",
	});
}

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 });
	}

	try {
		const body = await request.json();
		const { interviewId, fixAll } = body;

		const supabase = createSupabaseAdminClient();

		// Bulk fix mode
		if (fixAll) {
			consola.info("Bulk fixing all stuck interviews...");

			// Find all stuck interviews (with or without transcripts)
			const { data: stuck, error: findError } = await supabase
				.from("interviews")
				.select("id, title, status, transcript")
				.in("status", ["uploading", "uploaded", "processing", "transcribing"]);

			if (findError) {
				consola.error("Error finding stuck interviews:", findError);
				return Response.json({ error: "Failed to query interviews" }, { status: 500 });
			}

			if (!stuck || stuck.length === 0) {
				return Response.json({ success: true, fixed: 0, message: "No stuck interviews found" });
			}

			consola.info(`Found ${stuck.length} stuck interviews to fix`);

			// Interviews with transcripts -> ready, without transcripts -> error
			const withTranscript = stuck.filter((i) => i.transcript);
			const withoutTranscript = stuck.filter((i) => !i.transcript);

			let fixedCount = 0;

			// Update ones with transcript to 'ready'
			if (withTranscript.length > 0) {
				const ids = withTranscript.map((i) => i.id);
				const { error: updateError } = await supabase.from("interviews").update({ status: "ready" }).in("id", ids);
				if (updateError) {
					consola.error("Failed to update interviews with transcript:", updateError);
				} else {
					fixedCount += withTranscript.length;
					consola.info(`Set ${withTranscript.length} interviews with transcripts to 'ready'`);
				}
			}

			// Update ones without transcript to 'error'
			if (withoutTranscript.length > 0) {
				const ids = withoutTranscript.map((i) => i.id);
				const { error: updateError } = await supabase.from("interviews").update({ status: "error" }).in("id", ids);
				if (updateError) {
					consola.error("Failed to update interviews without transcript:", updateError);
				} else {
					fixedCount += withoutTranscript.length;
					consola.info(`Set ${withoutTranscript.length} interviews without transcripts to 'error'`);
				}
			}

			consola.success(`Fixed ${fixedCount} stuck interviews`);
			return Response.json({
				success: true,
				fixed: fixedCount,
				withTranscript: withTranscript.length,
				withoutTranscript: withoutTranscript.length,
				message: `Fixed ${fixedCount} stuck interviews (${withTranscript.length} ready, ${withoutTranscript.length} error)`,
			});
		}

		// Single interview mode
		if (!interviewId) {
			return Response.json({ error: "interviewId or fixAll required" }, { status: 400 });
		}

		// 1. Check current state
		const { data: interview, error: interviewError } = await supabase
			.from("interviews")
			.select("id, title, status, media_url, transcript")
			.eq("id", interviewId)
			.single();

		if (interviewError || !interview) {
			consola.error("Interview not found:", interviewError);
			return Response.json({ error: "Interview not found" }, { status: 404 });
		}

		consola.info("Checking interview state:", {
			id: interview.id,
			status: interview.status,
			hasMedia: !!interview.media_url,
			hasTranscript: !!interview.transcript,
		});

		// Determine what status to set based on current state
		const stuckStatuses = ["uploading", "uploaded", "transcribing", "processing"];
		const isStuck = stuckStatuses.includes(interview.status || "");

		if (isStuck) {
			// Get current conversation_analysis metadata
			const { data: currentInterview } = await supabase
				.from("interviews")
				.select("conversation_analysis")
				.eq("id", interviewId)
				.single();

			const conversationAnalysis = (currentInterview?.conversation_analysis as any) || {};

			if (interview.transcript) {
				// Has transcript -> set to ready
				consola.info("Fixing interview status to 'ready' (has transcript)");
				const { error: updateError } = await supabase
					.from("interviews")
					.update({
						status: "ready",
						conversation_analysis: {
							...conversationAnalysis,
							status_detail: "Manually marked as complete",
							current_step: "complete",
							completed_steps: [...(conversationAnalysis.completed_steps || []), "transcription", "analysis"],
						},
					})
					.eq("id", interviewId);

				if (updateError) {
					consola.error("Failed to update interview:", updateError);
					return Response.json({ error: "Failed to update interview" }, { status: 500 });
				}
			} else {
				// No transcript -> set to error
				consola.info("Fixing interview status to 'error' (no transcript)");
				const { error: updateError } = await supabase
					.from("interviews")
					.update({
						status: "error",
						conversation_analysis: {
							...conversationAnalysis,
							status_detail: "Manually marked as failed - no transcript available",
							current_step: "failed",
							failed_at: new Date().toISOString(),
						},
					})
					.eq("id", interviewId);

				if (updateError) {
					consola.error("Failed to update interview:", updateError);
					return Response.json({ error: "Failed to update interview" }, { status: 500 });
				}
			}
		}

		// 5. Return final state
		const { data: finalInterview } = await supabase
			.from("interviews")
			.select("id, title, status, media_url, transcript")
			.eq("id", interviewId)
			.single();

		consola.success("Interview fixed:", {
			id: finalInterview?.id,
			status: finalInterview?.status,
		});

		return Response.json({
			success: true,
			interview: finalInterview,
			message: "Interview status fixed",
		});
	} catch (error) {
		consola.error("Failed to fix interview:", error);
		const message = error instanceof Error ? error.message : "Unknown error";
		return Response.json({ error: message }, { status: 500 });
	}
}
