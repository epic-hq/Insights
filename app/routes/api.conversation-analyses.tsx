import { randomUUID } from "node:crypto"

import { tasks } from "@trigger.dev/sdk"
import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import type { analyzeConversationRecordingTask } from "~/../src/trigger/conversation/analyzeRecording"
import { insertConversationAnalysis } from "~/lib/conversation-analyses/db.server"
import { userContext } from "~/server/user-context"
import { conversationContextSchema } from "~/utils/conversationAnalysis.server"
import { storeConversationAudio } from "~/utils/storeConversationAudio.server"

export async function action({ request, context }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return new Response(JSON.stringify({ error: "Method not allowed" }), {
			status: 405,
			headers: { "Content-Type": "application/json" },
		})
	}

	const ctx = context.get(userContext)
	if (!ctx?.account_id || !ctx?.supabase) {
		return new Response(JSON.stringify({ error: "Unauthorized" }), {
			status: 401,
			headers: { "Content-Type": "application/json" },
		})
	}

	const formData = await request.formData()
	const file = formData.get("file") as File | null
	if (!file) {
		return new Response(JSON.stringify({ error: "Missing audio file" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		})
	}

	const attendeesRaw = (formData.get("attendees") as string | null) ?? ""
	const contextPayload = conversationContextSchema.parse({
		meetingTitle: (formData.get("meetingTitle") as string | null) ?? undefined,
		notes: (formData.get("notes") as string | null) ?? undefined,
		attendees: attendeesRaw
			? attendeesRaw
					.split(/[,\n]/)
					.map((value) => value.trim())
					.filter(Boolean)
			: undefined,
	})

	const analysisId = randomUUID()
	const storageResult = await storeConversationAudio({
		analysisId,
		source: file,
		originalFilename: file.name,
		contentType: file.type,
	})

	if (!storageResult.mediaUrl) {
		consola.error("Failed to store conversation audio", storageResult.error)
		return new Response(JSON.stringify({ error: storageResult.error ?? "Failed to store audio" }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		})
	}

	const record = await insertConversationAnalysis({
		db: ctx.supabase,
		id: analysisId,
		accountId: ctx.account_id,
		createdBy: ctx.claims?.sub ?? null,
		recordingUrl: storageResult.mediaUrl,
	})

	const triggerHandle = await tasks.trigger<typeof analyzeConversationRecordingTask>("conversation.analyze-recording", {
		analysisId: record.id,
		context: contextPayload,
	})

	return new Response(
		JSON.stringify({
			analysisId: record.id,
			triggerRunId: triggerHandle.id,
		}),
		{
			status: 200,
			headers: { "Content-Type": "application/json" },
		}
	)
}
