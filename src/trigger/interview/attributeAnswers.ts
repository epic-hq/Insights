import { task } from "@trigger.dev/sdk"
import { createSupabaseAdminClient } from "~/lib/supabase/client.server"
import {
        type AttributeAnswersTaskPayload,
        attributeAnswersAndFinalizeCore,
        workflowRetryConfig,
} from "../../../app/utils/processInterview.server"

export const attributeAnswersTask = task({
        id: "interview.attribute-answers",
        retry: workflowRetryConfig,
        run: async (payload: AttributeAnswersTaskPayload) => {
                const client = createSupabaseAdminClient()
                await attributeAnswersAndFinalizeCore({
                        db: client,
                        metadata: payload.metadata,
                        interviewRecord: payload.interview,
                        insertedEvidenceIds: payload.insertedEvidenceIds,
                        storedInsights: payload.storedInsights,
                        fullTranscript: payload.fullTranscript,
                })
                return { interviewId: payload.interview.id, storedInsights: payload.storedInsights }
        },
})
