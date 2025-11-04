import { task } from "@trigger.dev/sdk"
import { createSupabaseAdminClient } from "~/lib/supabase/client.server"
import { evidenceUnitsSchema } from "~/lib/validation/baml-validation"
import {
	type AnalyzeThemesTaskPayload,
	analyzeThemesAndPersonaCore,
	workflowRetryConfig,
} from "~/utils/processInterview.server"

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error))

export const analyzeThemesAndPersonaTask = task({
	id: "interview.analyze-themes-and-persona",
	retry: workflowRetryConfig,
	run: async (payload: AnalyzeThemesTaskPayload) => {
		if (process.env.ENABLE_PERSONA_ANALYSIS !== "true") {
			return {
				interviewId: payload.interview.id,
				storedInsights: [],
			}
		}

		// Validate payload structure
		if (!payload.evidenceResult) {
			throw new Error("Missing evidenceResult in payload")
		}
		const validatedEvidenceUnits = evidenceUnitsSchema.parse(
			payload.evidenceResult.evidenceUnits
		)
		const evidenceResult = {
			...payload.evidenceResult,
			evidenceUnits: validatedEvidenceUnits,
		}

		const client = createSupabaseAdminClient()

		try {
			const { generateInterviewInsightsTask } = await import("./generateInterviewInsights")
			const insightsResult = await generateInterviewInsightsTask.triggerAndWait({
				metadata: payload.metadata,
				interview: payload.interview,
				fullTranscript: payload.fullTranscript,
				userCustomInstructions: payload.userCustomInstructions,
				evidenceResult,
				analysisJobId: payload.analysisJobId,
			})

			if (!insightsResult.ok) {
				throw new Error(
					insightsResult.error?.message ?? "Failed to synthesize interview insights."
				)
			}

			if (payload.analysisJobId) {
				await client
					.from("analysis_jobs" as const)
					.update({
						status_detail: "Analyzing themes and personas",
						progress: 75,
					})
					.eq("id", payload.analysisJobId as string)
			}

			const analysisResult = await analyzeThemesAndPersonaCore({
				db: client,
				metadata: payload.metadata,
				interviewRecord: payload.interview,
				fullTranscript: payload.fullTranscript,
				userCustomInstructions: payload.userCustomInstructions,
				evidenceResult,
				interviewInsights: insightsResult.output.interviewInsights,
			})

			if (payload.analysisJobId) {
				await client
					.from("analysis_jobs" as const)
					.update({
						status_detail: "Attributing answers",
						progress: 85,
					})
					.eq("id", payload.analysisJobId as string)
			}

			const { attributeAnswersTask } = await import("./attributeAnswers")
			const nextResult = await attributeAnswersTask.triggerAndWait({
				metadata: payload.metadata,
				interview: analysisResult.interview,
				fullTranscript: payload.fullTranscript,
				insertedEvidenceIds: evidenceResult.insertedEvidenceIds,
				storedInsights: analysisResult.storedInsights,
				analysisJobId: payload.analysisJobId,
			})

			if (!nextResult.ok) {
				throw new Error(nextResult.error?.message ?? "Failed to attribute answers for interview.")
			}

			return nextResult.output
		} catch (error) {
			if (payload.analysisJobId) {
				await client
					.from("analysis_jobs" as const)
					.update({
						status: "error",
						status_detail: "Theme analysis failed",
						last_error: errorMessage(error),
					})
					.eq("id", payload.analysisJobId as string)
			}

			await client.from("interviews" as const).update({ status: "error" }).eq("id", payload.interview.id)

			throw error
		}
	},
})
