import { tasks } from "@trigger.dev/sdk"
import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { ensureInterviewInterviewerLink } from "~/features/people/services/internalPeople.server"
import { createSupabaseAdminClient, getServerClient } from "~/lib/supabase/client.server"
import { userContext } from "~/server/user-context"
import { safeSanitizeTranscriptPayload } from "~/utils/transcript/sanitizeTranscriptData.server"

export async function action({ request, context }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 })
	}

	const { client: supabase } = getServerClient(request)
	const admin = createSupabaseAdminClient()
	const body = await request.json().catch(() => ({}) as any)

	const interviewId = body.interviewId as string | null
	const transcript = (body.transcript as string | null) ?? ""
	const transcriptFormatted = body.transcriptFormatted as Record<string, unknown> | null
	const mediaUrl = (body.mediaUrl as string | null) ?? ""
	const audioDuration = body.audioDuration as number | null
	const attachType = (body.attachType as string | null) ?? "existing"
	const personIds = (body.personIds as string[] | null) ?? []

	if (!interviewId) {
		return Response.json({ error: "interviewId required" }, { status: 400 })
	}

	// Fetch interview to get account/project
	const { data: interview, error: interviewErr } = await admin
		.from("interviews")
		.select("id, account_id, project_id, created_by, participant_pseudonym, segment, title, original_filename")
		.eq("id", interviewId)
		.single()

	if (interviewErr || !interview) {
		return Response.json({ error: "Interview not found" }, { status: 404 })
	}

	// Link current user as interviewer if available
	const ctx = context.get?.(userContext)
	const userId = ctx?.claims?.sub ?? null
	if (userId) {
		await ensureInterviewInterviewerLink({
			supabase,
			accountId: interview.account_id,
			projectId: interview.project_id,
			interviewId,
			userId,
			userSettings: ctx?.user_settings || null,
			userMetadata: ctx?.user_metadata || null,
		})
	}

	// Link provided personIds to interview_people
	if (personIds.length) {
		const rows = personIds.map((pid) => ({
			interview_id: interviewId,
			person_id: pid,
			project_id: interview.project_id,
		}))
		await admin.from("interview_people").upsert(rows, { onConflict: "interview_id,person_id" })
	}

	// Sanitize transcript data
	const sanitized = safeSanitizeTranscriptPayload(
		transcriptFormatted || {
			full_transcript: transcript,
			audio_duration: audioDuration ?? null,
			file_type: "realtime",
			speaker_transcripts: Array.isArray((transcriptFormatted as any)?.speaker_transcripts)
				? (transcriptFormatted as any).speaker_transcripts
				: [
						{
							speaker: "A",
							text: transcript,
							start: 0,
							end: audioDuration ?? null,
						},
					],
		}
	)

	// Update interview with transcript + media
	await admin
		.from("interviews")
		.update({
			transcript: transcript || sanitized.full_transcript || "",
			transcript_formatted: sanitized as any,
			media_url: mediaUrl,
			duration_sec: audioDuration ?? null,
			status: "transcribed",
		})
		.eq("id", interviewId)

	// Trigger v2 orchestrator starting from evidence
	const handle = await tasks.trigger("interview.v2.orchestrator", {
		analysisJobId: interviewId,
		metadata: {
			accountId: interview.account_id,
			projectId: interview.project_id || undefined,
			userId: userId || interview.created_by || undefined,
			fileName: interview.original_filename || undefined,
			interviewTitle: interview.title || undefined,
			participantName: interview.participant_pseudonym || undefined,
			segment: interview.segment || undefined,
		},
		transcriptData: sanitized as any,
		mediaUrl,
		existingInterviewId: interviewId,
		userCustomInstructions: "",
		resumeFrom: "evidence",
		skipSteps: ["upload"],
	})

	consola.info("[realtime-finalize] Triggered v2 orchestrator", { interviewId, runId: handle.id })

	return Response.json({ success: true, interviewId, runId: handle.id })
}
