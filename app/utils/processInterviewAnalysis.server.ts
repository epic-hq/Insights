import type { SupabaseClient } from "@supabase/supabase-js"
import consola from "consola"
import type { Database } from "~/../supabase/types"

type AdminClient = SupabaseClient<Database>

interface ProcessAnalysisParams {
	interviewId: string
	transcriptData: Record<string, unknown>
	customInstructions?: string
	adminClient: AdminClient
	mediaUrl?: string
}

export async function createAndProcessAnalysisJob({
	interviewId,
	transcriptData,
	customInstructions = "",
	adminClient,
	mediaUrl = "",
}: ProcessAnalysisParams): Promise<void> {
	// Create analysis job
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
		throw new Error(`Failed to create analysis job: ${analysisJobError?.message}`)
	}

	consola.log("Created analysis job:", analysisJob.id)

	// Update interview status to processing before starting analysis
	await adminClient.from("interviews").update({ status: "processing" }).eq("id", interviewId)

	// Process analysis immediately
	try {
		// Get interview details to construct metadata
		const { data: interview, error: interviewFetchError } = await adminClient
			.from("interviews")
			.select("*")
			.eq("id", interviewId)
			.single()

		if (interviewFetchError || !interview) {
			throw new Error(`Failed to fetch interview details: ${interviewFetchError?.message}`)
		}

		// Import the admin processing function
		const { processInterviewTranscriptWithAdminClient } = await import("~/utils/processInterview.server")

		// Construct metadata from interview record
		const metadata = {
			accountId: interview.account_id,
			userId: interview.account_id,
			projectId: interview.project_id || undefined,
			interviewTitle: interview.title || undefined,
			interviewDate: interview.interview_date || undefined,
			participantName: interview.participant_pseudonym || undefined,
			duration_sec: interview.duration_sec || undefined,
			fileName: (transcriptData as any).original_filename || undefined,
		}

		consola.log("Starting complete interview processing for interview:", interviewId)

		// Call the admin processing function
		await processInterviewTranscriptWithAdminClient({
			metadata,
			mediaUrl: mediaUrl || interview.media_url || "",
			transcriptData,
			userCustomInstructions: customInstructions,
			adminClient,
			existingInterviewId: interviewId,
		})

		consola.log("Complete interview processing completed for interview:", interviewId)

		// Mark analysis job as complete
		await adminClient
			.from("analysis_jobs")
			.update({
				status: "done",
				status_detail: "Analysis completed",
				progress: 100,
			})
			.eq("id", analysisJob.id)

		// Update interview status to ready
		await adminClient.from("interviews").update({ status: "ready" }).eq("id", interviewId)

		consola.log("Successfully processed analysis for interview:", interviewId)
	} catch (analysisError) {
		consola.error("Analysis processing failed:", analysisError)

		// Mark analysis job as error
		await adminClient
			.from("analysis_jobs")
			.update({
				status: "error",
				status_detail: "Analysis failed",
				last_error: analysisError instanceof Error ? analysisError.message : "Unknown error",
			})
			.eq("id", analysisJob.id)

		// Update interview status to error
		await adminClient.from("interviews").update({ status: "error" }).eq("id", interviewId)

		// Re-throw to let caller handle
		throw analysisError
	}
}
