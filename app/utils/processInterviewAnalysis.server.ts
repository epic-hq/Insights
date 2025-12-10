import type { SupabaseClient } from "@supabase/supabase-js"
import { auth, tasks } from "@trigger.dev/sdk"
import consola from "consola"
import type { LangfuseSpanClient, LangfuseTraceClient } from "langfuse"
import type { Database } from "~/../supabase/types"
import { getLangfuseClient } from "~/lib/langfuse.server"

type AdminClient = SupabaseClient<Database>

const INTERVIEW_PIPELINE_TASKS = [
	// V1 tasks
	"interview.upload-media-and-transcribe",
	"interview.extract-evidence-and-people",
	"interview.analyze-themes-and-persona",
	"interview.attribute-answers",
	// V2 modular tasks
	"interview.v2.orchestrator",
	"interview.v2.upload-and-transcribe",
	"interview.v2.extract-evidence",
	"interview.v2.generate-insights",
	"interview.v2.assign-personas",
	"interview.v2.attribute-answers",
	"interview.v2.finalize-interview",
] as const

export async function createRunAccessToken(runId: string): Promise<string | null> {
	try {
		return await auth.createPublicToken({
			scopes: {
				read: {
					runs: [runId],
					tasks: [...INTERVIEW_PIPELINE_TASKS],
				},
			},
			expirationTime: "2h",
		})
	} catch (error) {
		consola.warn("Failed to create Trigger.dev public token", error)
		return null
	}
}

interface ProcessAnalysisParams {
	interviewId: string
	transcriptData: Record<string, unknown>
	customInstructions?: string
	adminClient: AdminClient
	mediaUrl?: string
	initiatingUserId?: string | null
	langfuseParent?: LangfuseTraceClient | LangfuseSpanClient
}

type ObservationEndPayload = Parameters<LangfuseTraceClient["end"]>[0]

interface TriggerRunInfo {
	runId: string
	publicToken: string | null
	analysisJobId: string // Now the interview ID
}

export async function createAndProcessAnalysisJob({
	interviewId,
	transcriptData,
	customInstructions = "",
	adminClient,
	mediaUrl = "",
	initiatingUserId = null,
	langfuseParent,
}: ProcessAnalysisParams): Promise<TriggerRunInfo> {
	const langfuse = getLangfuseClient()
	const observation =
		langfuseParent?.span?.({
			name: "analysis.create-and-process",
			metadata: { interviewId },
			input: {
				hasMediaUrl: Boolean(mediaUrl),
			},
		}) ||
		(langfuse as any).trace?.({
			name: "analysis.create-and-process",
			metadata: { interviewId },
			input: {
				hasMediaUrl: Boolean(mediaUrl),
			},
		})
	let observationEndPayload: ObservationEndPayload | undefined
	let runInfo: TriggerRunInfo | null = null

	// Update conversation_analysis metadata (analysis_jobs table was consolidated)
	try {
		const updateMetadataSpan = observation?.span?.({
			name: "supabase.interview.update-conversation-analysis",
			metadata: { interviewId },
		})

		// Get current conversation_analysis to preserve existing data
		const { data: currentInterview } = await adminClient
			.from("interviews")
			.select("conversation_analysis")
			.eq("id", interviewId)
			.single()

		const existingAnalysis = (currentInterview?.conversation_analysis as any) || {}

		const { error: updateError } = await adminClient
			.from("interviews")
			.update({
				conversation_analysis: {
					...existingAnalysis,
					transcript_data: transcriptData,
					custom_instructions: customInstructions,
					status_detail: "Processing with AI",
					current_step: "analysis",
					completed_steps: [...(existingAnalysis.completed_steps || [])],
				},
			})
			.eq("id", interviewId)

		if (updateError) {
			updateMetadataSpan?.end?.({
				level: "ERROR",
				statusMessage: updateError?.message ?? "Failed to update conversation_analysis",
			})
			throw new Error(`Failed to update conversation_analysis: ${updateError?.message}`)
		}

		updateMetadataSpan?.end?.({
			output: {
				interviewId,
			},
		})
		consola.log("Interview conversation_analysis updated:", interviewId)

		const interviewStatusSpan = observation?.span?.({
			name: "supabase.interview.mark-processing",
			metadata: { interviewId },
		})
		// Update interview status to processing before starting analysis
		await adminClient.from("interviews").update({ status: "processing" }).eq("id", interviewId)
		interviewStatusSpan?.end?.()

		// Get interview details to construct metadata
		const fetchInterviewSpan = observation?.span?.({
			name: "supabase.interview.fetch",
			metadata: { interviewId },
		})
		const { data: interview, error: interviewFetchError } = await adminClient
			.from("interviews")
			.select("*")
			.eq("id", interviewId)
			.single()

		if (interviewFetchError || !interview) {
			fetchInterviewSpan?.end?.({
				level: "ERROR",
				statusMessage: interviewFetchError?.message ?? "Failed to fetch interview",
			})
			throw new Error(`Failed to fetch interview details: ${interviewFetchError?.message}`)
		}
		fetchInterviewSpan?.end?.()

		// Construct metadata from interview record
		const metadata = {
			accountId: interview.account_id,
			userId: initiatingUserId ?? interview.updated_by ?? interview.created_by ?? undefined,
			projectId: interview.project_id || undefined,
			interviewTitle: interview.title || undefined,
			interviewDate: interview.interview_date || undefined,
			participantName: interview.participant_pseudonym || undefined,
			duration_sec: interview.duration_sec || undefined,
			fileName: (transcriptData as any).original_filename || undefined,
		}

		consola.log("Queued interview processing via Trigger.dev for interview:", interviewId)

		// Update conversation_analysis with queued status
		await adminClient
			.from("interviews")
			.update({
				conversation_analysis: {
					...existingAnalysis,
					transcript_data: transcriptData,
					custom_instructions: customInstructions,
					status_detail: "Queued for Trigger.dev pipeline",
					current_step: "analysis",
					progress: 15,
				},
			})
			.eq("id", interviewId)

		const triggerSpan = observation?.span?.({
			name: "trigger.upload-media-and-transcribe",
			metadata: { interviewId },
		})

		const triggerEnv = process.env.TRIGGER_SECRET_KEY?.startsWith("tr_dev_") ? "dev" : "prod"
		consola.info(`Triggering interview pipeline in ${triggerEnv} environment`, { interviewId })

		// Always use v2 modular workflow (v1 monolithic workflow is deprecated)
		consola.log("Triggering v2 orchestrator...")

		// Use interview ID as idempotency key to prevent duplicate orchestrator runs
		const idempotencyKey = `interview-orchestrator-${interviewId}`

		const handle = await tasks.trigger(
			"interview.v2.orchestrator",
			{
				analysisJobId: interviewId, // Use interview ID as job identifier
				metadata,
				transcriptData,
				mediaUrl: mediaUrl || interview.media_url || "",
				existingInterviewId: interviewId,
				userCustomInstructions: customInstructions,
			},
			{
				idempotencyKey,
				idempotencyKeyTTL: "24h", // Prevent duplicate runs for 24 hours
			}
		)

		consola.log(`Trigger.dev v2 orchestrator triggered successfully with handle: ${handle.id}`)

		// Store trigger_run_id in conversation_analysis
		await adminClient
			.from("interviews")
			.update({
				conversation_analysis: {
					...existingAnalysis,
					transcript_data: transcriptData,
					custom_instructions: customInstructions,
					trigger_run_id: handle.id,
					status_detail: "Processing with Trigger.dev",
					current_step: "analysis",
				},
			})
			.eq("id", interviewId)

		const publicToken = await createRunAccessToken(handle.id)

		runInfo = {
			runId: handle.id,
			publicToken,
			analysisJobId: interviewId, // Return interview ID as job ID
		}

		triggerSpan?.end?.({
			output: { runId: handle.id },
		})

		observationEndPayload = {
			output: {
				analysisJobId: interviewId,
				interviewId,
				runId: handle.id,
			},
		}
		return runInfo ?? { runId: handle.id, publicToken: null, analysisJobId: interviewId }
	} catch (analysisError) {
		consola.error("Analysis processing failed:", analysisError)

		// Update conversation_analysis with error
		const { data: errorInterview } = await adminClient
			.from("interviews")
			.select("conversation_analysis")
			.eq("id", interviewId)
			.single()

		const errorAnalysis = (errorInterview?.conversation_analysis as any) || {}

		await adminClient
			.from("interviews")
			.update({
				status: "error",
				conversation_analysis: {
					...errorAnalysis,
					status_detail: "Analysis failed",
					last_error: analysisError instanceof Error ? analysisError.message : "Unknown error",
				},
			})
			.eq("id", interviewId)

		// Re-throw to let caller handle
		const message = analysisError instanceof Error ? analysisError.message : "Unknown error"
		observationEndPayload = { level: "ERROR", statusMessage: message }
		throw analysisError
	} finally {
		observation?.end?.(observationEndPayload)
	}
}
