import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { createSupabaseAdminClient } from "~/lib/supabase/client.server"

/**
 * Fix stuck interviews that have transcript but wrong status
 * POST /api/fix-stuck-interview
 * Body: { interviewId: string }
 */
export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 })
	}

	try {
		const { interviewId } = await request.json()

		if (!interviewId) {
			return Response.json({ error: "interviewId required" }, { status: 400 })
		}

		const supabase = createSupabaseAdminClient()

		// 1. Check current state
		const { data: interview, error: interviewError } = await supabase
			.from("interviews")
			.select("id, title, status, media_url, transcript")
			.eq("id", interviewId)
			.single()

		if (interviewError || !interview) {
			consola.error("Interview not found:", interviewError)
			return Response.json({ error: "Interview not found" }, { status: 404 })
		}

		consola.info("Checking interview state:", {
			id: interview.id,
			status: interview.status,
			hasMedia: !!interview.media_url,
			hasTranscript: !!interview.transcript,
		})

		// 2. If interview has transcript but wrong status, fix it
		if (interview.transcript && interview.status !== "ready") {
			consola.info("Fixing interview status to 'ready'")

			// Get current conversation_analysis metadata
			const { data: currentInterview } = await supabase
				.from("interviews")
				.select("conversation_analysis")
				.eq("id", interviewId)
				.single()

			const conversationAnalysis = (currentInterview?.conversation_analysis as any) || {}

			// Update status and mark workflow as complete in conversation_analysis
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
				.eq("id", interviewId)

			if (updateError) {
				consola.error("Failed to update interview:", updateError)
				return Response.json({ error: "Failed to update interview" }, { status: 500 })
			}
		}

		// 5. Return final state
		const { data: finalInterview } = await supabase
			.from("interviews")
			.select("id, title, status, media_url, transcript")
			.eq("id", interviewId)
			.single()

		consola.success("Interview fixed:", {
			id: finalInterview?.id,
			status: finalInterview?.status,
		})

		return Response.json({
			success: true,
			interview: finalInterview,
			message: "Interview status fixed",
		})
	} catch (error) {
		consola.error("Failed to fix interview:", error)
		const message = error instanceof Error ? error.message : "Unknown error"
		return Response.json({ error: message }, { status: 500 })
	}
}
