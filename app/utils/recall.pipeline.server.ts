import { tasks } from "@trigger.dev/sdk"
import consola from "consola"
import type { ingestRecallBotTask } from "~/../src/trigger/recall/ingestRecallBot"

export interface RecallIngestionPayload {
	meetingBotId: string
	botId: string
	uploadJobId?: string | null
}

export interface RecallIngestionHandle {
	runId: string
}

export async function queueRecallIngestion(payload: RecallIngestionPayload): Promise<RecallIngestionHandle | null> {
	try {
		const handle = await tasks.trigger<typeof ingestRecallBotTask>("recall.ingest-bot", payload)
		consola.log("Queued Recall ingestion task", { runId: handle.id, meetingBotId: payload.meetingBotId })
		return { runId: handle.id }
	} catch (error) {
		consola.error("Failed to enqueue Recall ingestion task", error)
		return null
	}
}
