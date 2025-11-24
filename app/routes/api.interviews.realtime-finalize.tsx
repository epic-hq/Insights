import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { userContext } from "~/server/user-context"
import { safeSanitizeTranscriptPayload } from "~/utils/transcript/sanitizeTranscriptData.server"

export async function action({ request, context, params }: ActionFunctionArgs) {
	try {
		const ctx = context.get(userContext)
		const supabase = ctx?.supabase
		if (!supabase) {
			return new Response(JSON.stringify({ error: "Authentication required" }), {
				status: 401,
				headers: { "Content-Type": "application/json" },
			})
		}

		const { projectId } = params
		if (!projectId) {
			return new Response(JSON.stringify({ error: "Missing projectId in URL" }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			})
		}

		const { interviewId, transcript, transcriptFormatted, mediaUrl, audioDuration, attachType, entityId } =
			await request.json()
		if (!interviewId || typeof interviewId !== "string") {
			return new Response(JSON.stringify({ error: "interviewId is required" }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			})
		}

		// Use incoming transcriptFormatted if provided, otherwise create basic format
		const incomingSanitized = transcriptFormatted ? safeSanitizeTranscriptPayload(transcriptFormatted) : null
		const formattedTranscriptData =
			incomingSanitized ||
			safeSanitizeTranscriptPayload({
				full_transcript: transcript || "",
				confidence: 0.8, // Default confidence for realtime
				audio_duration: audioDuration || null,
				processing_duration: 0,
				file_type: "realtime",
				original_filename: `realtime-${interviewId}`,
				speaker_transcripts: [],
				topic_detection: {},
			})

		const update: Record<string, unknown> = {
			status: "transcribed",
			updated_at: new Date().toISOString(),
			source_type: "realtime_recording",
		}
		if (typeof transcript === "string") update.transcript = transcript
		if (incomingSanitized) {
			update.transcript_formatted = incomingSanitized
		} else if (transcript) {
			update.transcript_formatted = formattedTranscriptData
		}
		if (typeof mediaUrl === "string" && mediaUrl) update.media_url = mediaUrl
		if (typeof audioDuration === "number" && audioDuration > 0) update.duration_sec = audioDuration

		// Link to person/org if provided
		if (attachType === "existing" && typeof entityId === "string" && entityId) {
			update.person_id = entityId
		} else if (attachType === "new" && typeof entityId === "string" && entityId) {
			update.person_id = entityId
		}

		const { error } = await supabase.from("interviews").update(update).eq("id", interviewId).eq("project_id", projectId)

		if (error) {
			consola.error("Failed to finalize interview:", error)
			return new Response(JSON.stringify({ error: error.message }), {
				status: 500,
				headers: { "Content-Type": "application/json" },
			})
		}

		// Create analysis job and trigger processing via trigger.dev (same as upload flow)
		if (transcript?.trim()) {
			try {
				const { createSupabaseAdminClient } = await import("~/lib/supabase/client.server")
				const { createAndProcessAnalysisJob } = await import("~/utils/processInterviewAnalysis.server")

				const adminClient = createSupabaseAdminClient()

				const runInfo = await createAndProcessAnalysisJob({
					interviewId,
					transcriptData: (incomingSanitized ?? formattedTranscriptData) as unknown as Record<string, unknown>,
					customInstructions: "",
					adminClient,
					mediaUrl,
					initiatingUserId: ctx?.claims?.sub ?? null,
				})

				consola.log("Successfully started analysis for realtime interview:", interviewId, "runId:", runInfo.runId)
			} catch (analysisError) {
				consola.error("Analysis processing failed for realtime interview:", analysisError)
				// Continue - don't fail the finalize for analysis errors
				consola.log("Realtime finalize completed despite analysis error")
			}
		}

		return new Response(JSON.stringify({ ok: true }), {
			headers: { "Content-Type": "application/json" },
		})
	} catch (e) {
		consola.error("Unexpected error in realtime-finalize:", e)
		return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unexpected error" }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		})
	}
}
