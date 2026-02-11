import { task } from "@trigger.dev/sdk";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { normalizeEvidenceUnits } from "~/lib/validation/baml-validation";
import {
  type AnalyzeThemesTaskPayload,
  analyzeThemesAndPersonaCore,
  workflowRetryConfig,
} from "~/utils/processInterview.server";

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

export const analyzeThemesAndPersonaTask = task({
  id: "interview.analyze-themes-and-persona",
  retry: workflowRetryConfig,
  run: async (payload: AnalyzeThemesTaskPayload) => {
    if (process.env.ENABLE_PERSONA_ANALYSIS !== "true") {
      return {
        interviewId: payload.interview.id,
        storedInsights: [],
      };
    }

    // Validate payload structure
    if (!payload.evidenceResult) {
      throw new Error("Missing evidenceResult in payload");
    }
    const normalizedEvidenceUnits = normalizeEvidenceUnits(
      payload.evidenceResult.evidenceUnits,
      {
        defaultAnchorTarget:
          payload.interview.media_url ?? payload.interview.id,
      },
    );
    const evidenceResult = {
      ...payload.evidenceResult,
      evidenceUnits: normalizedEvidenceUnits,
    };

    const client = createSupabaseAdminClient();

    try {
      const { generateInterviewInsightsTask } =
        await import("./generateInterviewInsights");
      const insightsResult = await generateInterviewInsightsTask.triggerAndWait(
        {
          metadata: payload.metadata,
          interview: payload.interview,
          fullTranscript: payload.fullTranscript,
          userCustomInstructions: payload.userCustomInstructions,
          evidenceResult,
          analysisJobId: payload.analysisJobId,
        },
      );

      if (!insightsResult.ok) {
        throw new Error(
          insightsResult.error?.message ??
            "Failed to synthesize interview insights.",
        );
      }

      // Note: analysis_jobs table removed - state now managed in interviews.conversation_analysis

      const analysisResult = await analyzeThemesAndPersonaCore({
        db: client,
        metadata: payload.metadata,
        interviewRecord: payload.interview,
        fullTranscript: payload.fullTranscript,
        userCustomInstructions: payload.userCustomInstructions,
        evidenceResult,
        interviewInsights: insightsResult.output.interviewInsights,
      });

      // Note: analysis_jobs table removed - state now managed in interviews.conversation_analysis

      const { attributeAnswersTask } = await import("./attributeAnswers");
      const nextResult = await attributeAnswersTask.triggerAndWait({
        metadata: payload.metadata,
        interview: analysisResult.interview,
        fullTranscript: payload.fullTranscript,
        insertedEvidenceIds: evidenceResult.insertedEvidenceIds,
        storedInsights: analysisResult.storedInsights,
        analysisJobId: payload.analysisJobId,
      });

      if (!nextResult.ok) {
        throw new Error(
          nextResult.error
            ? String(nextResult.error)
            : "Failed to attribute answers for interview.",
        );
      }

      return nextResult.output;
    } catch (error) {
      // Note: analysis_jobs table removed - state now managed in interviews.conversation_analysis

      await client
        .from("interviews" as const)
        .update({ status: "error" })
        .eq("id", payload.interview.id);

      throw error;
    }
  },
});
