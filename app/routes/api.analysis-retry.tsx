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

		// Check what type of retry we need
		// Validate that transcript_formatted has actual data, not just empty/corrupted structure
		const formatted = interview.transcript_formatted as Record<string, unknown> | null
		const hasUsableTranscript =
			formatted &&
			Array.isArray(formatted.speaker_transcripts) &&
			formatted.speaker_transcripts.length > 0
		const hasMedia = interview.media_url

		console.log("Retry analysis - hasUsableTranscript:", !!hasUsableTranscript, "hasMedia:", !!hasMedia)

		const formattedTranscriptData = hasUsableTranscript
			? safeSanitizeTranscriptPayload(interview.transcript_formatted)
			: null

		// Generate fresh presigned URL from R2 key if needed
		let mediaUrlForTask = interview.media_url || ""
		if (mediaUrlForTask && !mediaUrlForTask.startsWith("http://") && !mediaUrlForTask.startsWith("https://")) {
			// It's an R2 key, generate presigned URL
			const { createR2PresignedUrl } = await import("~/utils/r2.server")
			const presigned = createR2PresignedUrl({
				key: mediaUrlForTask,
				expiresInSeconds: 24 * 60 * 60, // 24 hours
			})
			if (presigned) {
				mediaUrlForTask = presigned.url
				consola.log(`Generated presigned URL for retry of interview ${interviewId}`)
			} else {
				consola.error(`Failed to generate presigned URL for R2 key: ${mediaUrlForTask}`)
			}
		}

		const admin = createSupabaseAdminClient()

		try {
			if (!hasUsableTranscript && hasMedia) {
				// No usable transcript but has media - need to re-transcribe
				console.log("Re-transcribing audio file...")
				await createAndProcessAnalysisJob({
					interviewId,
					transcriptData: {}, // Empty transcript data - will be populated during transcription
					customInstructions,
					adminClient: admin,
					mediaUrl: mediaUrlForTask,
					initiatingUserId: userId,
				})
				console.log("Re-transcription triggered successfully")
			} else if (hasUsableTranscript) {
				// Has usable transcript - just re-analyze
				console.log("Re-analyzing existing transcript...")
				await createAndProcessAnalysisJob({
					interviewId,
					transcriptData: formattedTranscriptData as unknown as Record<string, unknown>,
					customInstructions,
					adminClient: admin,
					mediaUrl: mediaUrlForTask,
					initiatingUserId: userId,
				})
				console.log("Re-analysis triggered successfully")
			} else {
				return Response.json(
					{ error: "No transcript or media available. Please re-upload the audio file." },
					{ status: 400 }
				)
			}

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
