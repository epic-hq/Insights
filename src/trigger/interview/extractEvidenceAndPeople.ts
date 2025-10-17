import { task } from "@trigger.dev/sdk"
import { createSupabaseAdminClient } from "~/lib/supabase/client.server"
import {
        type UploadMediaAndTranscribeResult,
        extractEvidenceAndPeopleCore,
        workflowRetryConfig,
} from "../../../app/utils/processInterview.server"

export const extractEvidenceAndPeopleTask = task({
        id: "interview.extract-evidence-and-people",
        retry: workflowRetryConfig,
        run: async (payload: UploadMediaAndTranscribeResult) => {
                const client = createSupabaseAdminClient()
                const evidenceResult = await extractEvidenceAndPeopleCore({
                        db: client,
                        metadata: payload.metadata,
                        interviewRecord: payload.interview,
                        transcriptData: payload.transcriptData,
                        language: payload.language,
                        fullTranscript: payload.fullTranscript,
                })

                return {
                        metadata: payload.metadata,
                        interview: payload.interview,
                        fullTranscript: payload.fullTranscript,
                        transcriptData: payload.transcriptData,
                        language: payload.language,
                        evidenceResult,
                }
        },
})
