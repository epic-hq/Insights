/**
 * V2 Generate Insights Task
 *
 * Atomic task that:
 * 1. Generates insights from evidence using BAML (ExtractedInsight class)
 * 2. Stores insights as themes in themes table
 * 3. Evidence linking happens separately via theme_evidence junction table
 *
 * DATA MODEL CLARIFICATION:
 * - Themes/Insights are project-level groupings with: name, statement, inclusion_criteria
 * - Themes don't have interview_id - they're linked via theme_evidence -> evidence -> interview
 * - BAML ExtractedInsight fields (category, journey_stage, jtbd, etc.) are NOT stored
 * - Only core theme fields are persisted to keep schema simple
 * - insights_current is a VIEW over themes for backwards compatibility
 *
 * Fully idempotent - can be safely retried.
 */
import consola from "consola";
import { task } from "@trigger.dev/sdk";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";
import {
  generateInterviewInsightsFromEvidenceCore,
  workflowRetryConfig,
} from "~/utils/processInterview.server";
import {
  errorMessage,
  saveWorkflowState,
  updateAnalysisJobError,
  updateAnalysisJobProgress,
} from "./state";
import type { GenerateInsightsPayload, GenerateInsightsResult } from "./types";

export const generateInsightsTaskV2 = task({
  id: "interview.v2.generate-insights",
  retry: workflowRetryConfig,
  run: async (
    payload: GenerateInsightsPayload,
    { ctx },
  ): Promise<GenerateInsightsResult> => {
    const {
      interviewId,
      evidenceUnits,
      evidenceIds,
      userCustomInstructions,
      analysisJobId,
      metadata,
    } = payload;
    const client = createSupabaseAdminClient();

    try {
      await updateAnalysisJobProgress(client, analysisJobId, {
        currentStep: "insights",
        progress: 65,
        statusDetail: "Generating insights from evidence",
      });

      await client
        .from("interviews")
        .update({
          processing_metadata: {
            current_step: "insights",
            progress: 65,
            status_detail: "Generating insights from evidence",
            trigger_run_id: ctx.run.id,
          },
        })
        .eq("id", interviewId);

      // Validate evidenceUnits
      if (!evidenceUnits || !Array.isArray(evidenceUnits)) {
        consola.error(
          `[generateInsights] Invalid evidenceUnits:`,
          `type=${typeof evidenceUnits}`,
          `isArray=${Array.isArray(evidenceUnits)}`,
          `value=${JSON.stringify(evidenceUnits)?.substring(0, 200)}`,
        );
        throw new Error(
          `Invalid evidenceUnits: expected array, got ${typeof evidenceUnits}. ` +
            `Ensure evidenceUnits is properly loaded from workflow state.`,
        );
      }

      consola.info(
        `[generateInsights] Processing ${evidenceUnits.length} evidence units`,
      );

      // Load interview to get account_id and project_id
      const { data: interview, error: interviewError } = await client
        .from("interviews")
        .select("account_id, project_id")
        .eq("id", interviewId)
        .single();

      if (interviewError || !interview?.project_id) {
        throw new Error(
          `Interview ${interviewId} not found or missing project: ${interviewError?.message}`,
        );
      }

      // Step 1: Call BAML to generate insights from evidence
      const insights = await generateInterviewInsightsFromEvidenceCore({
        evidenceUnits,
        userCustomInstructions,
      });

      // Step 2: Store insights as project-level themes using upsert logic
      // Note: Themes are project-level, not interview-specific
      // Link to interview comes via: theme -> theme_evidence -> evidence -> interview
      // We check for existing themes by name to prevent duplicates across interviews
      const createdThemes: { id: string }[] = [];

      for (const insight of insights.insights) {
        // Check if theme with this name already exists in the project
        const { data: existingTheme } = await client
          .from("themes")
          .select("id")
          .eq("account_id", interview.account_id)
          .eq("project_id", interview.project_id)
          .eq("name", insight.name)
          .maybeSingle();

        if (existingTheme) {
          // Theme exists - update its statement if we have new details
          if (insight.details || insight.evidence) {
            await client
              .from("themes")
              .update({
                statement: insight.details ?? undefined,
                inclusion_criteria: insight.evidence ?? undefined,
                updated_by: metadata?.userId || null,
              })
              .eq("id", existingTheme.id);
          }
          createdThemes.push({ id: existingTheme.id });
          consola.info(
            `[generateInsights] Reusing existing theme "${insight.name}" (${existingTheme.id})`,
          );
        } else {
          // Theme doesn't exist - create new
          const { data: newTheme, error: insertError } = await client
            .from("themes")
            .insert({
              account_id: interview.account_id,
              project_id: interview.project_id,
              name: insight.name,
              statement: insight.details ?? null,
              inclusion_criteria: insight.evidence ?? null,
              created_by: metadata?.userId || null,
              updated_by: metadata?.userId || null,
            })
            .select("id")
            .single();

          if (insertError || !newTheme) {
            consola.warn(
              `[generateInsights] Failed to create theme "${insight.name}": ${insertError?.message}`,
            );
            continue;
          }
          createdThemes.push({ id: newTheme.id });
          consola.info(
            `[generateInsights] Created new theme "${insight.name}" (${newTheme.id})`,
          );
        }
      }

      consola.success(
        `[generateInsights] Processed ${createdThemes.length} themes/insights for interview ${interviewId}`,
      );

      // Step 3: Create theme_evidence links for this interview's evidence
      // Since themes are derived FROM this interview's evidence, we link them together.
      // This is per-interview linking (not N×M across the whole project).
      let linkCount = 0;
      if (evidenceIds && evidenceIds.length > 0 && createdThemes.length > 0) {
        consola.info(
          `[generateInsights] Creating theme_evidence links: ${createdThemes.length} themes × ${evidenceIds.length} evidence`,
        );

        // Build all link rows
        const themeEvidenceRows = [];
        for (const theme of createdThemes) {
          for (const evidenceId of evidenceIds) {
            themeEvidenceRows.push({
              account_id: interview.account_id,
              project_id: interview.project_id,
              theme_id: theme.id,
              evidence_id: evidenceId,
              rationale: "Extracted from same interview",
              confidence: 0.8, // High confidence since they're from the same source
            });
          }
        }

        // Insert in batches to avoid hitting limits
        const BATCH_SIZE = 100;
        for (let i = 0; i < themeEvidenceRows.length; i += BATCH_SIZE) {
          const batch = themeEvidenceRows.slice(i, i + BATCH_SIZE);
          const { error: linkError } = await client
            .from("theme_evidence")
            .upsert(batch, {
              onConflict: "theme_id,evidence_id,account_id",
              ignoreDuplicates: true,
            });

          if (linkError) {
            consola.warn(
              `[generateInsights] Failed to create some theme_evidence links:`,
              linkError.message,
            );
          } else {
            linkCount += batch.length;
          }
        }

        consola.success(
          `[generateInsights] Created ${linkCount} theme_evidence links`,
        );
      } else {
        consola.warn(
          `[generateInsights] Skipping theme_evidence links: evidenceIds=${evidenceIds?.length || 0}, themes=${createdThemes.length}`,
        );
      }

      // Update workflow state
      if (analysisJobId) {
        await saveWorkflowState(client, analysisJobId, {
          insightIds: createdThemes.map((t) => t.id),
          completedSteps: ["upload", "evidence", "insights"],
          currentStep: "insights",
          interviewId,
        });

        await updateAnalysisJobProgress(client, analysisJobId, {
          progress: 75,
          statusDetail: `Created ${createdThemes.length} insights`,
        });
      }

      return {
        insightIds: createdThemes.map((t) => t.id),
      };
    } catch (error) {
      // Update processing_metadata on error
      await client
        .from("interviews")
        .update({
          processing_metadata: {
            current_step: "insights",
            progress: 65,
            failed_at: new Date().toISOString(),
            error: errorMessage(error),
            trigger_run_id: ctx.run.id,
          },
        })
        .eq("id", interviewId);

      await updateAnalysisJobError(client, analysisJobId, {
        currentStep: "insights",
        error: errorMessage(error),
      });

      throw error;
    }
  },
});
