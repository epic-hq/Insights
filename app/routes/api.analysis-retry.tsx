import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { createSupabaseAdminClient, getServerClient } from "~/lib/supabase/client.server"
import { createAndProcessAnalysisJob } from "~/utils/processInterviewAnalysis.server"

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 })
	}

	consola.log("Analysis retry API called ")
	const formData = await request.formData()
	const interviewId = formData.get("interview_id")
	const customInstructions = formData.get("custom_instructions")

	try {
		// Get user ID from JWT claims (fast) with DB fallback
		const { getAuthenticatedUser } = await import("~/lib/supabase/client.server")
		const claims = await getAuthenticatedUser(request)
		if (!claims?.sub) {
			return Response.json({ error: "Unauthorized" }, { status: 401 })
		}
		const userId = claims.sub

		const { client: userDb } = getServerClient(request)

		consola.log("Analysis retry API called ", interviewId, customInstructions)
		if (!interviewId) {
			return Response.json({ error: "interview_id is required" }, { status: 400 })
		}

		// RLS-guarded fetch: ensure the user can see/control this interview
		const { data: interview, error: interviewErr } = await userDb
			.from("interviews")
			.select("*")
			.eq("id", interviewId)
			.single()

		if (interviewErr || !interview) {
			return Response.json({ error: "Interview not found" }, { status: 404 })
		}

		// ALWAYS re-transcribe from media when available
		const hasMedia = interview.media_url

		console.log("Analysis retry - ALWAYS re-transcribing from media, hasMedia:", !!hasMedia)

		if (!hasMedia) {
			return Response.json({ error: "No media available. Please re-upload the audio file." }, { status: 400 })
		}

		const admin = createSupabaseAdminClient()

		try {
			// Clear workflow state before retrying - this ensures all steps run fresh
			console.log("Clearing workflow state for fresh re-run...")
			const { data: currentInterview } = await admin
				.from("interviews")
				.select("conversation_analysis")
				.eq("id", interviewId)
				.single()

			const existingAnalysis = (currentInterview?.conversation_analysis as any) || {}

			await admin
				.from("interviews")
				.update({
					conversation_analysis: {
						...existingAnalysis,
						completed_steps: [], // Clear completed steps
						current_step: "upload", // Reset to start
						workflow_state: null, // Clear workflow state
						progress: 0,
					},
				})
				.eq("id", interviewId)

			// ALWAYS re-transcribe from media - ignore any existing transcript data
			// Pass the RAW R2 key - the upload task will generate presigned URL
			console.log("Re-transcribing audio file from media_url...")
			await createAndProcessAnalysisJob({
				interviewId,
				transcriptData: {
					needs_transcription: true, // Flag to trigger AssemblyAI transcription
					file_type: "media",
				},
				customInstructions,
				adminClient: admin,
				mediaUrl: interview.media_url, // Raw R2 key - upload task will presign
				initiatingUserId: userId,
			})
			console.log("Re-transcription triggered successfully")

			return Response.json({ success: true })
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e)
			console.error("User-triggered retry failed:", msg)
			console.error("Full error:", e)
			await admin.from("interviews").update({ status: "error" }).eq("id", interviewId)
			return Response.json({ error: msg }, { status: 500 })
		}
	} catch (error) {
		consola.error("Retry API error:", error)
		return Response.json({ error: error instanceof Error ? error.message : "Internal error" }, { status: 500 })
	}
}
