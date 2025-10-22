import consola from "consola"
import { z } from "zod"
import type { ActionFunctionArgs } from "react-router"
import { createSupabaseAdminClient } from "~/lib/supabase/client.server"
import { queueRecallIngestion } from "~/utils/recall.pipeline.server"
import { mapRecallStatusToJobStatus, verifyRecallWebhook } from "~/utils/recall.server"

const webhookSchema = z
	.object({
		type: z.string().optional(),
		id: z.string().optional(),
		status: z.string().optional(),
		data: z
			.object({
				id: z.string().optional(),
				status: z.string().optional(),
				status_reason: z.string().optional(),
				status_message: z.string().optional(),
			})
			.passthrough()
			.optional(),
	})
	.passthrough()

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 })
	}

	const rawBody = await request.text()
	const verification = verifyRecallWebhook(request.headers, rawBody)

	if (!verification.ok) {
		return Response.json({ error: verification.reason ?? "Webhook signature invalid" }, { status: 401 })
	}

	let parsedBody: z.infer<typeof webhookSchema>
	try {
		const json = JSON.parse(rawBody)
		const result = webhookSchema.safeParse(json)
		if (!result.success) {
			consola.warn("Recall webhook failed schema validation", result.error)
			return Response.json({ error: "Invalid payload" }, { status: 400 })
		}
		parsedBody = result.data
	} catch (error) {
		consola.error("Failed to parse Recall webhook payload", error)
		return Response.json({ error: "Invalid JSON payload" }, { status: 400 })
	}

	const botId = parsedBody.data?.id ?? parsedBody.id
	if (!botId) {
		return Response.json({ error: "Missing bot id in payload" }, { status: 400 })
	}

	const rawStatus = parsedBody.data?.status ?? parsedBody.status ?? null
	const statusDetail = parsedBody.data?.status_message ?? parsedBody.data?.status_reason ?? rawStatus ?? null
	const mappedStatus = mapRecallStatusToJobStatus(rawStatus)
	const supabase = createSupabaseAdminClient()

	const { data: meetingBot, error: fetchError } = await supabase
		.from("meeting_bots")
		.select("*")
		.eq("bot_id", botId)
		.single()

	if (fetchError || !meetingBot) {
		consola.warn("Recall webhook received for unknown bot", { botId, error: fetchError })
		return Response.json({ success: true, ignored: true }, { status: 202 })
	}

	const nowIso = new Date().toISOString()

	await supabase
		.from("meeting_bots")
		.update({
			status: mappedStatus,
			recall_status: rawStatus ?? null,
			status_detail: statusDetail,
			last_status_at: nowIso,
			raw_payload: parsedBody as any,
		})
		.eq("id", meetingBot.id)

	const { data: uploadJob } = await supabase
		.from("upload_jobs")
		.select("id")
		.eq("meeting_bot_id", meetingBot.id)
		.maybeSingle()

	if (uploadJob?.id) {
		await supabase
			.from("upload_jobs")
			.update({
				status: mappedStatus,
				status_detail: statusDetail,
			})
			.eq("id", uploadJob.id)
	}

	if (mappedStatus === "error") {
		await supabase.from("interviews").update({ status: "error" }).eq("id", meetingBot.interview_id)
	} else if (mappedStatus === "done") {
		await supabase.from("interviews").update({ status: "transcribing" }).eq("id", meetingBot.interview_id)
		await queueRecallIngestion({
			meetingBotId: meetingBot.id,
			botId,
			uploadJobId: uploadJob?.id ?? null,
		})
	}

	return Response.json({ success: true }, { status: 202 })
}
