import { task } from "@trigger.dev/sdk"
import { createSupabaseAdminClient } from "~/lib/supabase/client.server"
import {
        generateInterviewInsightsFromEvidenceCore,
        type GenerateInterviewInsightsTaskPayload,
        workflowRetryConfig,
} from "~/utils/processInterview.server"

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error))

export const generateInterviewInsightsTask = task({
        id: "interview.generate-key-takeaways",
        retry: workflowRetryConfig,
        run: async (payload: GenerateInterviewInsightsTaskPayload) => {
                const client = createSupabaseAdminClient()

                try {
                        if (payload.analysisJobId) {
                                await client
                                        .from("analysis_jobs")
                                        .update({
                                                status_detail: "Synthesizing interview insights",
                                                progress: 65,
                                        })
                                        .eq("id", payload.analysisJobId as string)
                        }

                        const interviewInsights = await generateInterviewInsightsFromEvidenceCore({
                                evidenceUnits: payload.evidenceResult.evidenceUnits,
                                userCustomInstructions: payload.userCustomInstructions,
                        })

                        return { interviewInsights }
                } catch (error) {
                        if (payload.analysisJobId) {
                                await client
                                        .from("analysis_jobs")
                                        .update({
                                                status: "error",
                                                status_detail: "Insight generation failed",
                                                last_error: errorMessage(error),
                                        })
                                        .eq("id", payload.analysisJobId as string)
                        }

                        throw error
                }
        },
})
