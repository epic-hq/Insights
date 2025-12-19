import { tasks } from "@trigger.dev/sdk"
import consola from "consola"
import { createSupabaseAdminClient } from "~/lib/supabase/client.server"
import type { processInterviewOrchestratorV2 } from "~/trigger/interview/v2/orchestrator"
import type { Database } from "~/types"

type SupabaseAdmin = ReturnType<typeof createSupabaseAdminClient>

type CreateAndProcessParams = {
	interviewId: string
	transcriptData?: Record<string, unknown>
	customInstructions?: string
	adminClient?: SupabaseAdmin
	mediaUrl?: string | null
	initiatingUserId?: string | null
}

/**
 * Thin compatibility wrapper for legacy callers.
 * Creates metadata from the interview row and triggers the v2 orchestrator.
 */
export async function createAndProcessAnalysisJob(params: CreateAndProcessParams) {
	const { interviewId, transcriptData, customInstructions, adminClient, mediaUrl, initiatingUserId } = params
	const db = adminClient ?? createSupabaseAdminClient()

	const { data: interview, error } = await db
		.from("interviews")
		.select("id, account_id, project_id, title, original_filename, media_url")
		.eq("id", interviewId)
		.single()

	if (error || !interview) {
		throw new Error(`Interview ${interviewId} not found: ${error?.message}`)
	}

	const metadata = {
		accountId: interview.account_id,
		projectId: interview.project_id ?? undefined,
		interviewTitle: interview.title ?? interview.original_filename ?? "Interview",
		fileName: interview.original_filename ?? interview.title ?? "interview",
		userId: initiatingUserId ?? undefined,
	}

	const handle = await tasks.trigger<typeof processInterviewOrchestratorV2>("interview.v2.orchestrator", {
		metadata,
		mediaUrl: mediaUrl ?? interview.media_url ?? "",
		transcriptData,
		existingInterviewId: interviewId,
		analysisJobId: interviewId,
		userCustomInstructions: customInstructions,
	})

	consola.info("[createAndProcessAnalysisJob] Triggered v2 orchestrator", {
		interviewId,
		runId: handle.id,
	})

	return {
		runId: handle.id,
		publicToken: null,
	}
}
