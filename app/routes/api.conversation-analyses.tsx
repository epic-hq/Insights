import { randomUUID } from "node:crypto"

import { tasks } from "@trigger.dev/sdk"
import consola from "consola"
import { type ActionFunctionArgs } from "react-router"
import type { analyzeConversationRecordingTask } from "~/../src/trigger/conversation/analyzeRecording"
import { insertConversationAnalysis } from "~/lib/conversation-analyses/db.server"
import { userContext } from "~/server/user-context"
import { conversationContextSchema } from "~/utils/conversationAnalysis.server"
import { storeConversationAudio } from "~/utils/storeConversationAudio.server"

export async function action({ request, context }: ActionFunctionArgs) {
        if (request.method !== "POST") {
                return Response.json({ error: "Method not allowed" }, { status: 405 })
        }

	const ctx = context.get(userContext)
        if (!ctx?.account_id || !ctx?.supabase) {
                return Response.json({ error: "Unauthorized" }, { status: 401 })
        }

	const formData = await request.formData()
	const file = formData.get("file") as File | null
        if (!file) {
                return Response.json({ error: "Missing audio file" }, { status: 400 })
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
                return Response.json({ error: storageResult.error ?? "Failed to store audio" }, { status: 500 })
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

        return Response.json({
                analysisId: record.id,
                triggerRunId: triggerHandle.id,
        })
}
