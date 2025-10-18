import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { createSupabaseAdminClient, getServerClient } from "~/lib/supabase/client.server"
import { createAndProcessAnalysisJob } from "~/utils/processInterviewAnalysis.server"
import { safeSanitizeTranscriptPayload } from "~/utils/transcript/sanitizeTranscriptData.server"

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

		if (!interview.transcript_formatted) {
			return Response.json(
				{ error: "No transcript available to analyze. Please re-upload or re-transcribe." },
				{ status: 400 }
			)
		}

		const formattedTranscriptData = safeSanitizeTranscriptPayload(interview.transcript_formatted)

		const admin = createSupabaseAdminClient()

		try {
			await createAndProcessAnalysisJob({
				interviewId,
				transcriptData: formattedTranscriptData as unknown as Record<string, unknown>,
				customInstructions,
				adminClient: admin,
				mediaUrl: interview.media_url || "",
				initiatingUserId: userId,
			})

			return Response.json({ success: true })
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e)
			consola.error("User-triggered analysis retry failed:", msg)
			await admin.from("interviews").update({ status: "error" }).eq("id", interviewId)
			return Response.json({ error: msg }, { status: 500 })
		}
	} catch (error) {
		consola.error("Retry API error:", error)
		return Response.json({ error: error instanceof Error ? error.message : "Internal error" }, { status: 500 })
	}
}
