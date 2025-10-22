import consola from "consola"
import { formatISO } from "date-fns"
import { z } from "zod"
import type { ActionFunctionArgs } from "react-router"
import { createPlannedAnswersForInterview } from "~/lib/database/project-answers.server"
import { userContext } from "~/server/user-context"
import { mapRecallStatusToJobStatus, requireRecallConfig, createRecallBot } from "~/utils/recall.server"

const requestSchema = z.object({
	meetingUrl: z.string().url("A valid meeting URL is required"),
	botName: z.string().min(1).max(120).optional(),
	interviewTitle: z.string().min(1).max(200).optional(),
	customInstructions: z.string().min(1).max(2000).optional(),
})

export async function action({ request, context, params }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 })
	}

	try {
		const config = requireRecallConfig()
		const ctx = context.get(userContext)

		if (!ctx) {
			return Response.json({ error: "Unauthorized" }, { status: 401 })
		}

		const accountId = ctx.account_id
		const supabase = ctx.supabase
		const { projectId } = params

		if (!projectId) {
			return Response.json({ error: "Missing projectId in URL" }, { status: 400 })
		}

		const payload = await request.json().catch(() => ({}))
		const parsed = requestSchema.safeParse(payload)

		if (!parsed.success) {
			const issues = parsed.error.flatten().fieldErrors
			return Response.json({ error: "Invalid request", details: issues }, { status: 400 })
		}

		const body = parsed.data

		const interviewTitle =
			body.interviewTitle?.trim() ||
			`Meeting recording ${formatISO(new Date(), { representation: "date" })}`

		const { data: interview, error: interviewError } = await supabase
			.from("interviews")
			.insert({
				account_id: accountId,
				project_id: projectId,
				title: interviewTitle,
				status: "uploading",
				media_type: "interview",
			})
			.select()
			.single()

		if (interviewError || !interview) {
			consola.error("Failed to create interview for Recall bot", interviewError)
			return Response.json({ error: "Failed to create interview" }, { status: 500 })
		}

		const recallBot = await createRecallBot({
			meetingUrl: body.meetingUrl,
			botName: body.botName,
			recordingConfig: undefined,
			metadata: {
				account_id: accountId,
				project_id: projectId,
				interview_id: interview.id,
			},
		})

		const mappedStatus = mapRecallStatusToJobStatus(recallBot.status ?? null)
		const statusDetail = recallBot.status ?? "scheduled"

		const { data: meetingBot, error: meetingBotError } = await supabase
			.from("meeting_bots")
			.insert({
				interview_id: interview.id,
				bot_id: recallBot.id,
				region: config.region,
				meeting_url: recallBot.meeting_url ?? body.meetingUrl,
				bot_name: recallBot.bot_name ?? body.botName ?? "Insights Meeting Notetaker",
				status: mappedStatus,
				status_detail: statusDetail,
				recall_status: recallBot.status ?? null,
				raw_payload: recallBot as unknown as Record<string, unknown>,
				metadata: (recallBot as Record<string, unknown>)?.metadata ?? null,
				last_status_at: recallBot.join_at ?? new Date().toISOString(),
			})
			.select()
			.single()

		if (meetingBotError || !meetingBot) {
			consola.error("Failed to persist meeting bot record", meetingBotError)
			// Mark interview as errored to avoid dangling record
			await supabase.from("interviews").update({ status: "error" }).eq("id", interview.id)
			return Response.json({ error: "Failed to create meeting bot record" }, { status: 500 })
		}

		const { data: uploadJob, error: uploadJobError } = await supabase
			.from("upload_jobs")
			.insert({
				interview_id: interview.id,
				meeting_bot_id: meetingBot.id,
				source_provider: "recall",
				custom_instructions: body.customInstructions ?? null,
				status: mappedStatus,
				status_detail: statusDetail,
			})
			.select()
			.single()

		if (uploadJobError || !uploadJob) {
			consola.error("Failed to create upload job for Recall bot", uploadJobError)
		}

		await createPlannedAnswersForInterview(supabase, {
			projectId,
			interviewId: interview.id,
		})

		return Response.json(
			{
				success: true,
				interviewId: interview.id,
				meetingBotId: meetingBot.id,
				botId: recallBot.id,
				uploadJobId: uploadJob?.id ?? null,
				status: mappedStatus,
			},
			{ status: 201 },
		)
	} catch (error) {
		if (error instanceof Error && error.name === "RecallConfigError") {
			return Response.json({ error: error.message }, { status: 503 })
		}

		consola.error("Unexpected error creating Recall bot:", error)
		return Response.json({ error: "Failed to create Recall meeting bot" }, { status: 500 })
	}
}
