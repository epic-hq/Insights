import { task } from "@trigger.dev/sdk";
import consola from "consola";

import { createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { upsertSalesLensFromExtraction } from "~/lib/sales-lens/storage.server";
import { buildSalesLensFromEvidence } from "~/lib/sales-lens/baml-extraction.server";
import { buildInitialSalesLensExtraction } from "~/utils/salesLens.server";
import { workflowRetryConfig } from "~/utils/processInterview.server";
import {
  runBamlWithBilling,
  systemBillingContext,
} from "~/lib/billing/instrumented-baml.server";

type Payload = {
  interviewId: string;
  computedBy?: string | null;
};

/**
 * Helper function to generate and store conversation takeaways
 */
async function generateConversationTakeaways(
  client: ReturnType<typeof createSupabaseAdminClient>,
  interviewId: string,
  extraction: any,
) {
  try {
    consola.info(
      `[generateConversationTakeaways] Starting for interview ${interviewId}`,
    );

    // Fetch interview metadata
    const { data: interview, error: interviewError } = await client
      .from("interviews")
      .select("duration_sec")
      .eq("id", interviewId)
      .single();

    if (interviewError || !interview) {
      consola.error(
        `[generateConversationTakeaways] Error fetching interview ${interviewId}:`,
        interviewError,
      );
      return;
    }

    // Fetch evidence items for this interview with linked person data
    // Use LEFT join so we get evidence even without linked people
    const { data: evidenceItems, error: evidenceError } = await client
      .from("evidence")
      .select(
        `
                                id,
                                verbatim,
                                gist,
                                topic,
                                method,
                                anchors,
                                evidence_people(
                                        person_id,
                                        people(name)
                                )
                        `,
      )
      .eq("interview_id", interviewId)
      .is("deleted_at", null)
      .eq("is_archived", false)
      .order("created_at", { ascending: true });

    if (evidenceError) {
      consola.error(
        `[generateConversationTakeaways] Error fetching evidence:`,
        evidenceError,
      );
      return;
    }

    if (!evidenceItems || evidenceItems.length === 0) {
      consola.warn(
        `[generateConversationTakeaways] No evidence found for ${interviewId}`,
      );
      return;
    }

    const durationMinutes = interview.duration_sec
      ? Math.round(interview.duration_sec / 60)
      : null;

    // Build summaries from extraction
    const bantFramework = extraction.frameworks?.find(
      (f: any) => f.name === "BANT_GPCT",
    );
    const meddicFramework = extraction.frameworks?.find(
      (f: any) => f.name === "MEDDIC",
    );

    // BANT has 4 key areas: Budget, Authority, Need, Timeline
    const bantCoreSlots = ["budget", "authority", "need", "timeline"];
    const bantCaptured =
      bantFramework?.slots?.filter(
        (s: any) =>
          bantCoreSlots.includes(s.slot) && (s.textValue || s.summary),
      ) || [];

    const bantSummary = bantFramework?.slots
      ? `${bantCaptured.length}/4 areas identified: ${bantFramework.slots
          .map(
            (s: any) =>
              `${s.label}: ${s.textValue || s.summary || "Not captured"}`,
          )
          .join("; ")}`
      : null;

    const meddicSummary =
      meddicFramework?.slots
        ?.map(
          (s: any) =>
            `${s.label}: ${s.textValue || s.summary || "Not captured"}`,
        )
        .join("; ") || null;

    const stakeholdersSummary =
      extraction.entities?.stakeholders
        ?.map((s: any) => `${s.displayName} (${s.role || "Unknown role"})`)
        .join(", ") || null;

    // Transform evidence to BAML format
    const evidenceForBaml = evidenceItems.map((e: any) => {
      // Extract speaker name from evidence_people join
      const speakerName = e.evidence_people?.[0]?.people?.name || null;

      // Extract timestamp from anchors JSONB (first anchor's start_ms converted to seconds)
      const timestampMs = e.anchors?.[0]?.start_ms;
      const timestampSec = timestampMs ? timestampMs / 1000 : null;

      return {
        id: e.id,
        verbatim: e.verbatim || "",
        gist: e.gist || null,
        speaker: speakerName,
        evidence_type: e.topic || e.method || null,
        timestamp_start: timestampSec,
      };
    });

    // Log input summary for debugging
    consola.info(`[generateConversationTakeaways] Input summary:`, {
      interviewId,
      evidenceCount: evidenceItems.length,
      durationMinutes,
      hasBantSummary: !!bantSummary,
      hasMeddicSummary: !!meddicSummary,
      stakeholdersCount: extraction.entities?.stakeholders?.length || 0,
      topics: [...new Set(evidenceItems.map((e) => e.topic).filter(Boolean))],
      methods: [...new Set(evidenceItems.map((e) => e.method).filter(Boolean))],
    });

    // Call BAML function with evidence array and billing
    consola.info(
      `[generateConversationTakeaways] Calling BAML ExtractConversationTakeaways with ${evidenceItems.length} evidence items...`,
    );
    const billingCtx = systemBillingContext(
      extraction.accountId,
      "sales_takeaways",
      extraction.projectId || undefined,
    );
    const { result: takeaways } = await runBamlWithBilling(
      billingCtx,
      {
        functionName: "ExtractConversationTakeaways",
        traceName: "sales.conversation-takeaways",
        input: {
          evidenceCount: evidenceForBaml.length,
          hasBantSummary: !!bantSummary,
          hasMeddicSummary: !!meddicSummary,
          durationMinutes,
        },
        metadata: {
          interviewId,
          accountId: extraction.accountId,
          projectId: extraction.projectId,
        },
        resourceType: "interview",
        resourceId: interviewId,
        bamlCall: (client) =>
          client.ExtractConversationTakeaways(
            evidenceForBaml,
            bantSummary,
            meddicSummary,
            stakeholdersSummary,
            durationMinutes,
            null,
          ),
      },
      `interview:${interviewId}:conversation-takeaways`,
    );

    consola.info(`[generateConversationTakeaways] BAML extraction completed`);

    // Combine into a single string for storage
    const keyTakeaways = [
      takeaways.value_synopsis,
      takeaways.critical_next_step,
      takeaways.future_improvement,
    ].join(" ");

    consola.info(
      `[generateConversationTakeaways] Generated takeaways (${keyTakeaways.length} chars):`,
      {
        value_synopsis: takeaways.value_synopsis?.substring(0, 100),
        critical_next_step: takeaways.critical_next_step?.substring(0, 100),
        future_improvement: takeaways.future_improvement?.substring(0, 100),
        supporting_evidence_count:
          takeaways.supporting_evidence_ids?.length || 0,
        supporting_evidence_ids: takeaways.supporting_evidence_ids?.map((id) =>
          id.substring(0, 8),
        ),
      },
    );

    // Store in interviews table
    const { error: updateError } = await client
      .from("interviews")
      .update({ key_takeaways: keyTakeaways })
      .eq("id", interviewId);

    if (updateError) {
      consola.error(
        `[generateConversationTakeaways] Failed to update interview ${interviewId}:`,
        updateError,
      );
    } else {
      consola.info(
        `[generateConversationTakeaways] Successfully stored takeaways for ${interviewId}`,
      );
    }
  } catch (error) {
    consola.error(
      `[generateConversationTakeaways] Error generating takeaways for ${interviewId}:`,
    );
    consola.error(`[generateConversationTakeaways] Error details:`, {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      error,
    });
    // Don't throw - let the main task succeed even if takeaways fail
  }
}

/**
 * Trigger.dev task that materializes a sales lens summary for an interview.
 * Safe to invoke from other tasks or the Remix action when an AE requests a refresh.
 */
export const generateSalesLensTask = task({
  id: "sales.generate-sales-lens",
  retry: workflowRetryConfig,
  run: async (payload: Payload) => {
    const client = createSupabaseAdminClient();

    let extraction: any;
    let method: "baml" | "heuristic" = "baml";
    let fallback = false;

    try {
      // Try new BAML-based extraction first
      consola.info(
        `[generateSalesLensTask] Using BAML-based extraction for ${payload.interviewId}`,
      );
      extraction = await buildSalesLensFromEvidence(
        client,
        payload.interviewId,
      );

      // Log detailed extraction results for troubleshooting
      consola.info(`[generateSalesLensTask] BAML Extraction Summary:`, {
        interviewId: payload.interviewId,
        frameworkCount: extraction.frameworks?.length || 0,
        frameworks:
          extraction.frameworks?.map((f: any) => ({
            name: f.name,
            slotCount: f.slots?.length || 0,
            hygiene: f.hygiene?.length || 0,
          })) || [],
        stakeholderCount: extraction.entities?.stakeholders?.length || 0,
        stakeholders:
          extraction.entities?.stakeholders?.map((s: any) => ({
            displayName: s.displayName,
            role: s.role,
            personId: s.personId,
            labels: s.labels,
          })) || [],
        nextStepsCount: extraction.entities?.nextSteps?.length || 0,
      });

      // Store lens data FIRST - this is critical and should not be affected by takeaways failure
      consola.info(
        `[generateSalesLensTask] Storing sales lens data for ${payload.interviewId}`,
      );
      await upsertSalesLensFromExtraction({
        db: client,
        payload: extraction,
        sourceKind: "interview",
        computedBy: payload.computedBy ?? null,
      });
      consola.info(
        `[generateSalesLensTask] Successfully stored sales lens data for ${payload.interviewId}`,
      );
    } catch (error) {
      // Fallback to heuristic extraction if BAML fails
      consola.warn(
        `[generateSalesLensTask] BAML extraction failed, falling back to heuristics`,
        error,
      );

      extraction = await buildInitialSalesLensExtraction(
        client,
        payload.interviewId,
      );
      method = "heuristic";
      fallback = true;

      // Log heuristic extraction results
      consola.info(`[generateSalesLensTask] Heuristic Extraction Summary:`, {
        interviewId: payload.interviewId,
        frameworkCount: extraction.frameworks?.length || 0,
        stakeholderCount: extraction.entities?.stakeholders?.length || 0,
      });

      // Store lens data FIRST - this is critical and should not be affected by takeaways failure
      consola.info(
        `[generateSalesLensTask] Storing sales lens data (heuristic) for ${payload.interviewId}`,
      );
      await upsertSalesLensFromExtraction({
        db: client,
        payload: extraction,
        sourceKind: "interview",
        computedBy: payload.computedBy ?? null,
      });
      consola.info(
        `[generateSalesLensTask] Successfully stored sales lens data (heuristic) for ${payload.interviewId}`,
      );
    }

    // Generate conversation takeaways AFTER all lens data is safely stored
    // This runs last so it can summarize everything, and failures here won't affect lens data
    consola.info(
      `[generateSalesLensTask] Generating conversation takeaways for ${payload.interviewId}`,
    );
    await generateConversationTakeaways(
      client,
      payload.interviewId,
      extraction,
    );

    // Set interview status back to "ready" to hide progress indicator
    await client
      .from("interviews")
      .update({ status: "ready" })
      .eq("id", payload.interviewId);
    consola.info(`[generateSalesLensTask] Set interview status to ready`);

    // Fetch the generated takeaways from the database
    const { data: interviewData } = await client
      .from("interviews")
      .select("key_takeaways")
      .eq("id", payload.interviewId)
      .single();

    // Build comprehensive result summary
    const result = {
      interviewId: payload.interviewId,
      method,
      frameworks: extraction.frameworks?.length || 0,
      frameworkNames: extraction.frameworks?.map((f: any) => f.name) || [],
      stakeholders: extraction.entities?.stakeholders?.length || 0,
      stakeholderDetails:
        extraction.entities?.stakeholders?.map((s: any) => ({
          name: s.displayName,
          role: s.role,
          personId: s.personId,
          influence: s.influence,
          labels: s.labels,
        })) || [],
      nextSteps: extraction.entities?.nextSteps?.length || 0,
      keyTakeaways: interviewData?.key_takeaways || null,
      hasKeyTakeaways: !!interviewData?.key_takeaways,
      ...(fallback
        ? {
            fallback: true,
            warning: "BAML extraction failed, used heuristic fallback",
          }
        : {}),
    };

    consola.info(
      `[generateSalesLensTask] ✓ Task completed successfully:`,
      result,
    );
    return result;
  },
});
