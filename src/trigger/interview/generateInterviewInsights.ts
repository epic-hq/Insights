import { task } from "@trigger.dev/sdk";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";
import {
  generateInterviewInsightsFromEvidenceCore,
  type GenerateInterviewInsightsTaskPayload,
  workflowRetryConfig,
} from "~/utils/processInterview.server";

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

export const generateInterviewInsightsTask = task({
  id: "interview.generate-key-takeaways",
  retry: workflowRetryConfig,
  run: async (payload: GenerateInterviewInsightsTaskPayload) => {
    const client = createSupabaseAdminClient();

    try {
      // Note: analysis_jobs table removed - state now managed in interviews.conversation_analysis

      const interviewInsights = await generateInterviewInsightsFromEvidenceCore(
        {
          evidenceUnits: payload.evidenceResult.evidenceUnits,
          userCustomInstructions: payload.userCustomInstructions,
        },
      );

      return { interviewInsights };
    } catch (error) {
      // Note: analysis_jobs table removed - state now managed in interviews.conversation_analysis

      throw error;
    }
  },
});
