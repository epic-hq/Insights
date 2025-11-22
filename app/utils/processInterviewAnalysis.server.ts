import type { SupabaseClient } from "@supabase/supabase-js"
import { auth, tasks } from "@trigger.dev/sdk"
import consola from "consola"
import type { LangfuseSpanClient, LangfuseTraceClient } from "langfuse"
import type { uploadMediaAndTranscribeTask } from "~/../src/trigger/interview/uploadMediaAndTranscribe"
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
	let analysisJobRecord: { id: string } | null = null
	let runInfo: TriggerRunInfo | null = null

	// Create analysis job
	try {
		const createJobSpan = observation?.span?.({
			name: "supabase.analysis-job.create",
			metadata: { interviewId },
		})
		const { data: analysisJob, error: analysisJobError } = await adminClient
			.from("analysis_jobs")
			.insert({
				interview_id: interviewId,
				transcript_data: transcriptData,
				custom_instructions: customInstructions,
				status: "in_progress",
				status_detail: "Processing with AI",
			})
			.select()
			.single()

		if (analysisJobError || !analysisJob) {
			createJobSpan?.end?.({
				level: "ERROR",
				statusMessage: analysisJobError?.message ?? "Failed to create analysis job",
			})
			throw new Error(`Failed to create analysis job: ${analysisJobError?.message}`)
		}

		createJobSpan?.end?.({
			output: {
				analysisJobId: analysisJob.id,
			},
		})
		analysisJobRecord = { id: analysisJob.id }
		consola.log("Analysis job created:", analysisJob.id)

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

		await adminClient
			.from("analysis_jobs")
			.update({
				status_detail: "Queued for Trigger.dev pipeline",
				progress: 15,
			})
			.eq("id", analysisJob.id)

		const triggerSpan = observation?.span?.({
			name: "trigger.upload-media-and-transcribe",
			metadata: { interviewId, analysisJobId: analysisJob.id },
		})

		const triggerEnv = process.env.TRIGGER_SECRET_KEY?.startsWith("tr_dev_") ? "dev" : "prod"
		consola.info(`Triggering interview pipeline in ${triggerEnv} environment`, { runId: analysisJob.id })

		// Check if we should use the v2 modular workflow
		const useV2Workflow = process.env.ENABLE_MODULAR_WORKFLOW === "true"

		consola.log(
			`About to trigger ${useV2Workflow ? "v2 orchestrator" : "v1 uploadMediaAndTranscribeTask"}...`
		)

		const handle = useV2Workflow
			? await tasks.trigger("interview.v2.orchestrator", {
					analysisJobId: analysisJob.id,
					metadata,
					transcriptData,
					mediaUrl: mediaUrl || interview.media_url || "",
					existingInterviewId: interviewId,
					userCustomInstructions: customInstructions,
			  })
			: await tasks.trigger<typeof uploadMediaAndTranscribeTask>(
					"interview.upload-media-and-transcribe",
					{
						analysisJobId: analysisJob.id,
						metadata,
						transcriptData,
						mediaUrl: mediaUrl || interview.media_url || "",
						existingInterviewId: interviewId,
						userCustomInstructions: customInstructions,
					}
			  )

		consola.log(
			`Trigger.dev task triggered successfully with handle: ${handle.id} (using ${useV2Workflow ? "v2" : "v1"} workflow)`
		)

		await adminClient.from("analysis_jobs").update({ trigger_run_id: handle.id }).eq("id", analysisJob.id)

		const publicToken = await createRunAccessToken(handle.id)

		runInfo = {
			runId: handle.id,
			publicToken,
		}

		triggerSpan?.end?.({
			output: { runId: handle.id },
		})

		observationEndPayload = {
			output: {
				analysisJobId: analysisJob.id,
				interviewId,
				runId: handle.id,
			},
		}
		return runInfo ?? { runId: handle.id, publicToken: null }
	} catch (analysisError) {
		consola.error("Analysis processing failed:", analysisError)

		// Mark analysis job as error
		if (analysisJobRecord) {
			await adminClient
				.from("analysis_jobs")
				.update({
					status: "error",
					status_detail: "Analysis failed",
					last_error: analysisError instanceof Error ? analysisError.message : "Unknown error",
				})
				.eq("id", analysisJobRecord.id)
		}

		// Update interview status to error
		await adminClient.from("interviews").update({ status: "error" }).eq("id", interviewId)

		// Re-throw to let caller handle
		const message = analysisError instanceof Error ? analysisError.message : "Unknown error"
		observationEndPayload = { level: "ERROR", statusMessage: message }
		throw analysisError
	} finally {
		observation?.end?.(observationEndPayload)
	}
}
