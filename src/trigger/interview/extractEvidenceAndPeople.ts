import { task } from "@trigger.dev/sdk";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";
import {
  type UploadMediaAndTranscribeResult,
  extractEvidenceAndPeopleCore,
  workflowRetryConfig,
} from "~/utils/processInterview.server";

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

export const extractEvidenceAndPeopleTask = task({
  id: "interview.extract-evidence-and-people",
  retry: workflowRetryConfig,
  run: async (payload: UploadMediaAndTranscribeResult) => {
    const client = createSupabaseAdminClient();

    try {
      // Note: analysis_jobs table removed - state now managed in interviews.conversation_analysis

      const evidenceResult = await extractEvidenceAndPeopleCore({
        db: client,
        metadata: payload.metadata,
        interviewRecord: payload.interview,
        transcriptData: payload.transcriptData,
        language: payload.language,
        fullTranscript: payload.fullTranscript,
      });

      // Note: analysis_jobs table removed - state now managed in interviews.conversation_analysis

      await client
        .from("interviews")
        .update({
          status: "ready",
          updated_at: new Date().toISOString(),
        })
        .eq("id", payload.interview.id);

      const { generateSalesLensTask } =
        await import("../sales/generateSalesLens");
      await generateSalesLensTask.trigger({
        interviewId: payload.interview.id,
        computedBy: payload.metadata.userId ?? null,
      });

      return {
        interviewId: payload.interview.id,
        evidenceResult,
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
