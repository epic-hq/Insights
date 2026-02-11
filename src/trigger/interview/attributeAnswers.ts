import { task } from "@trigger.dev/sdk";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";
import {
  type AttributeAnswersTaskPayload,
  attributeAnswersAndFinalizeCore,
  workflowRetryConfig,
} from "~/utils/processInterview.server";

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

export const attributeAnswersTask = task({
  id: "interview.attribute-answers",
  retry: workflowRetryConfig,
  run: async (payload: AttributeAnswersTaskPayload) => {
    if (process.env.ENABLE_PERSONA_ANALYSIS !== "true") {
      return {
        interviewId: payload.interview.id,
        storedInsights: payload.storedInsights ?? [],
      };
    }

    const client = createSupabaseAdminClient();

    try {
      await attributeAnswersAndFinalizeCore({
        db: client,
        metadata: payload.metadata,
        interviewRecord: payload.interview,
        insertedEvidenceIds: payload.insertedEvidenceIds,
        storedInsights: payload.storedInsights,
        fullTranscript: payload.fullTranscript,
      });

      // Note: analysis_jobs table removed - state now managed in interviews.conversation_analysis

      return {
        interviewId: payload.interview.id,
        storedInsights: payload.storedInsights,
      };
    } catch (error) {
      // Note: analysis_jobs table removed - state now managed in interviews.conversation_analysis

      await client
        .from("interviews")
        .update({ status: "error" })
        .eq("id", payload.interview.id);

      throw error;
    }
  },
});
