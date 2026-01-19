/**
 * Apply Q&A Lens to an interview
 *
 * Extracts question-answer pairs from interview evidence,
 * creating a structured Q&A summary document.
 */

import { metadata, task } from "@trigger.dev/sdk";
import consola from "consola";

import {
  runBamlWithBilling,
  systemBillingContext,
} from "~/lib/billing/instrumented-baml.server";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { workflowRetryConfig } from "~/utils/processInterview.server";

const TEMPLATE_KEY = "qa-summary";

// Progress stages
const STAGES = {
  loading: { percent: 10, label: "Loading interview data..." },
  extracting: { percent: 50, label: "Extracting Q&A pairs..." },
  saving: { percent: 90, label: "Saving results..." },
  complete: { percent: 100, label: "Q&A extraction complete!" },
} as const;

function setProgress(stage: keyof typeof STAGES) {
  const { percent, label } = STAGES[stage];
  metadata.set("progressPercent", percent);
  metadata.set("stageLabel", label);
  metadata.set("stage", stage);
}

export type ApplyQALensPayload = {
  interviewId: string;
  accountId: string;
  projectId?: string | null;
  computedBy?: string | null;
  focusAreas?: string | null;
};

export const applyQALensTask = task({
  id: "lens.apply-qa-lens",
  retry: workflowRetryConfig,
  run: async (payload: ApplyQALensPayload) => {
    const { interviewId, accountId, projectId, computedBy, focusAreas } =
      payload;
    const client = createSupabaseAdminClient();

    consola.info(
      `[applyQALens] Extracting Q&A pairs from interview ${interviewId}`,
    );
    setProgress("loading");

    // 1. Load interview
    type InterviewRow = {
      id: string;
      title: string | null;
      interview_date: string | null;
      duration_sec: number | null;
      project_id: string | null;
    };

    const { data: interview, error: interviewError } = (await (client as any)
      .from("interviews")
      .select("id, title, interview_date, duration_sec, project_id")
      .eq("id", interviewId)
      .single()) as { data: InterviewRow | null; error: any };

    if (interviewError || !interview) {
      throw new Error(`Interview not found: ${interviewId}`);
    }

    // 2. Load evidence with question flag
    type EvidenceRow = {
      id: string;
      gist: string | null;
      verbatim: string | null;
      chunk: string | null;
      anchors: any | null;
      is_question: boolean | null;
      created_at: string;
    };

    const { data: evidence, error: evidenceError } = (await (client as any)
      .from("evidence")
      .select("id, gist, verbatim, chunk, anchors, is_question, created_at")
      .eq("interview_id", interviewId)
      .order("created_at", { ascending: true })) as {
      data: EvidenceRow[] | null;
      error: any;
    };

    if (evidenceError) {
      throw new Error(`Failed to load evidence: ${evidenceError.message}`);
    }

    if (!evidence || evidence.length === 0) {
      consola.warn(`[applyQALens] No evidence for interview ${interviewId}`);
      return { templateKey: TEMPLATE_KEY, success: true, qaPairCount: 0 };
    }

    // Count questions for logging
    const questionCount = evidence.filter((e) => e.is_question).length;
    consola.info(
      `[applyQALens] Found ${evidence.length} evidence items (${questionCount} questions)`,
    );

    // 3. Build context
    const interviewContext =
      [
        interview.title ? `Title: ${interview.title}` : null,
        interview.interview_date ? `Date: ${interview.interview_date}` : null,
        interview.duration_sec
          ? `Duration: ${Math.round(interview.duration_sec / 60)} minutes`
          : null,
      ]
        .filter(Boolean)
        .join("\n") || "Interview";

    // 4. Call BAML function
    setProgress("extracting");
    const evidenceJson = JSON.stringify(evidence);

    let extraction: any = null;
    try {
      const billingCtx = systemBillingContext(
        accountId,
        "lens_qa",
        projectId || undefined,
      );
      const { result } = await runBamlWithBilling(
        billingCtx,
        {
          functionName: "ExtractQAPairs",
          traceName: "lens.qa-summary",
          input: {
            evidenceCount: evidence.length,
            questionCount,
            interviewContext,
            hasFocusAreas: !!focusAreas,
          },
          metadata: {
            interviewId,
            accountId,
            projectId,
          },
          resourceType: "lens_analysis",
          resourceId: `${interviewId}:qa-summary`,
          bamlCall: (b) =>
            b.ExtractQAPairs(
              evidenceJson,
              interviewContext,
              focusAreas || null,
            ),
        },
        `lens:${interviewId}:qa-summary`,
      );
      extraction = result;
    } catch (error) {
      consola.error(`[applyQALens] BAML extraction failed:`, error);
      // Store failed status
      await (client as any).from("conversation_lens_analyses").upsert(
        {
          interview_id: interviewId,
          template_key: TEMPLATE_KEY,
          account_id: accountId,
          project_id: projectId || interview.project_id,
          analysis_data: {},
          confidence_score: 0,
          auto_detected: false,
          status: "failed",
          error_message: error instanceof Error ? error.message : String(error),
          processed_at: new Date().toISOString(),
          processed_by: computedBy,
        },
        { onConflict: "interview_id,template_key" },
      );
      throw error;
    }

    // 5. Store result
    setProgress("saving");
    const analysisData = {
      executive_summary: extraction.executive_summary,
      qa_pairs: extraction.qa_pairs || [],
      unanswered_questions: extraction.unanswered_questions || [],
      key_takeaways: extraction.key_takeaways || [],
      topics_covered: extraction.topics_covered || [],
    };

    const { error: upsertError } = await (client as any)
      .from("conversation_lens_analyses")
      .upsert(
        {
          interview_id: interviewId,
          template_key: TEMPLATE_KEY,
          account_id: accountId,
          project_id: projectId || interview.project_id,
          analysis_data: analysisData,
          confidence_score: extraction.overall_confidence || 0.5,
          auto_detected: false,
          status: "completed",
          processed_at: new Date().toISOString(),
          processed_by: computedBy,
        },
        { onConflict: "interview_id,template_key" },
      );

    if (upsertError) {
      throw new Error(`Failed to store Q&A analysis: ${upsertError.message}`);
    }

    setProgress("complete");
    const qaPairCount = extraction.qa_pairs?.length || 0;
    consola.success(
      `[applyQALens] ✓ Extracted ${qaPairCount} Q&A pairs from ${interviewId} (confidence: ${(extraction.overall_confidence || 0.5).toFixed(2)})`,
    );

    return {
      templateKey: TEMPLATE_KEY,
      success: true,
      qaPairCount,
      keyTakeawaysCount: extraction.key_takeaways?.length || 0,
      unansweredCount: extraction.unanswered_questions?.length || 0,
      confidenceScore: extraction.overall_confidence || 0.5,
    };
  },
});
