import { task } from "@trigger.dev/sdk"
import { createSupabaseAdminClient } from "~/lib/supabase/client.server"
import {
        type AnalyzeThemesTaskPayload,
        analyzeThemesAndPersonaCore,
        workflowRetryConfig,
} from "../../../app/utils/processInterview.server"

export const analyzeThemesAndPersonaTask = task({
        id: "interview.analyze-themes-and-persona",
        retry: workflowRetryConfig,
        run: async (payload: AnalyzeThemesTaskPayload) => {
                const client = createSupabaseAdminClient()
                const analysisResult = await analyzeThemesAndPersonaCore({
                        db: client,
                        metadata: payload.metadata,
                        interviewRecord: payload.interview,
                        fullTranscript: payload.fullTranscript,
                        userCustomInstructions: payload.userCustomInstructions,
                        evidenceResult: payload.evidenceResult,
                })

                return {
                        metadata: payload.metadata,
                        interview: analysisResult.interview,
                        storedInsights: analysisResult.storedInsights,
                        insertedEvidenceIds: payload.evidenceResult.insertedEvidenceIds,
                        fullTranscript: payload.fullTranscript,
                }
        },
})
