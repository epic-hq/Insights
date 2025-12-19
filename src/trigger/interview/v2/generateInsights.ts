/**
 * V2 Generate Insights Task
 *
 * Atomic task that:
 * 1. Generates insights from evidence using BAML (ExtractedInsight class)
 * 2. Stores insights as themes in themes table (with semantic deduplication)
 * 3. Evidence linking happens separately via theme_evidence junction table
 *
 * DATA MODEL CLARIFICATION:
 * - Themes/Insights are project-level groupings with: name, statement, inclusion_criteria
 * - Themes don't have interview_id - they're linked via theme_evidence -> evidence -> interview
 * - BAML ExtractedInsight fields (category, journey_stage, jtbd, etc.) are NOT stored
 * - Only core theme fields are persisted to keep schema simple
 * - insights_current is a VIEW over themes for backwards compatibility
 * - Semantic matching prevents duplicate themes with similar names
 *
 * Fully idempotent - can be safely retried.
 */
import consola from "consola";
import { task } from "@trigger.dev/sdk";
import type { SupabaseClient } from "~/types";
import {
  generateEmbedding,
  SIMILARITY_THRESHOLDS,
} from "~/lib/embeddings/openai.server";
import { searchEvidenceForTheme } from "~/lib/evidence/semantic-search.server";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { workflowRetryConfig } from "./config";
import { generateInterviewInsightsFromEvidenceCore } from "./extractEvidenceCore";
import {
  errorMessage,
  saveWorkflowState,
  updateAnalysisJobError,
  updateAnalysisJobProgress,
} from "./state";
import type { GenerateInsightsPayload, GenerateInsightsResult } from "./types";

/**
 * Find semantically similar themes using embedding-based vector search
 */
async function findSemanticallySimilarTheme(
  supabase: SupabaseClient,
  projectId: string,
  themeText: string,
  matchThreshold = SIMILARITY_THRESHOLDS.THEME_DEDUPLICATION,
): Promise<{ id: string; name: string; similarity: number } | null> {
  try {
    const embedding = await generateEmbedding(themeText, {
      label: "theme-dedup",
    });
    if (!embedding) return null;

    const { data, error } = await supabase.rpc("find_similar_themes", {
      query_embedding: embedding as any,
      project_id_param: projectId,
      match_threshold: matchThreshold,
      match_count: 1,
    });

    if (error) {
      consola.warn("[findSemanticallySimilarTheme] RPC error:", error);
      return null;
    }

    if (data && data.length > 0) {
      return {
        id: data[0].id,
        name: data[0].name,
        similarity: data[0].similarity,
      };
    }
    return null;
  } catch (err) {
    consola.warn("[findSemanticallySimilarTheme] Failed:", err);
    return null;
  }
}

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
      const createdThemes: {
        id: string;
        name: string;
        details: string | null;
        evidence: string | null;
      }[] = [];

      for (const insight of insights.insights) {
        // 1. Check if theme with this exact name already exists in the project
        const { data: existingTheme } = await client
          .from("themes")
          .select("id, name, synonyms")
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
          createdThemes.push({
            id: existingTheme.id,
            name: insight.name,
            details: insight.details ?? null,
            evidence: insight.evidence ?? null,
          });
          consola.info(
            `[generateInsights] Reusing existing theme "${insight.name}" (${existingTheme.id})`,
          );
          continue;
        }

        // 2. Check for semantically similar themes (prevents duplicates like
        // "AI Lacks Contextual Understanding" vs "AI fails to capture context")
        const searchText = [insight.name, insight.details]
          .filter(Boolean)
          .join(". ");
        const similarTheme = await findSemanticallySimilarTheme(
          client,
          interview.project_id,
          searchText,
          // Uses SIMILARITY_THRESHOLDS.THEME_DEDUPLICATION by default
        );

        if (similarTheme) {
          // Found semantically similar theme - use it instead of creating duplicate
          consola.info(
            `[generateInsights] Found semantically similar theme: "${similarTheme.name}" ` +
              `(${Math.round(similarTheme.similarity * 100)}% similar to "${insight.name}")`,
          );

          // Update synonyms to include the new name
          const { data: existingSimilar } = await client
            .from("themes")
            .select("synonyms")
            .eq("id", similarTheme.id)
            .single();

          const currentSynonyms = existingSimilar?.synonyms ?? [];
          if (!currentSynonyms.includes(insight.name)) {
            await client
              .from("themes")
              .update({
                synonyms: [...currentSynonyms, insight.name],
                statement: existingSimilar
                  ? undefined
                  : (insight.details ?? undefined),
                inclusion_criteria: existingSimilar
                  ? undefined
                  : (insight.evidence ?? undefined),
                updated_by: metadata?.userId || null,
              })
              .eq("id", similarTheme.id);
          }

          createdThemes.push({
            id: similarTheme.id,
            name: insight.name,
            details: insight.details ?? null,
            evidence: insight.evidence ?? null,
          });
          continue;
        }

        // 3. No exact or semantic match - create new theme with embedding
        const embedding = await generateEmbedding(searchText, {
          label: `theme:${insight.name}`,
        });

        const insertData: any = {
          account_id: interview.account_id,
          project_id: interview.project_id,
          name: insight.name,
          statement: insight.details ?? null,
          inclusion_criteria: insight.evidence ?? null,
          created_by: metadata?.userId || null,
          updated_by: metadata?.userId || null,
        };

        if (embedding) {
          insertData.embedding = embedding;
          insertData.embedding_model = "text-embedding-3-small";
          insertData.embedding_generated_at = new Date().toISOString();
        }

        const { data: newTheme, error: insertError } = await client
          .from("themes")
          .insert(insertData)
          .select("id")
          .single();

        if (insertError || !newTheme) {
          consola.warn(
            `[generateInsights] Failed to create theme "${insight.name}": ${insertError?.message}`,
          );
          continue;
        }
        createdThemes.push({
          id: newTheme.id,
          name: insight.name,
          details: insight.details ?? null,
          evidence: insight.evidence ?? null,
        });
        consola.info(
          `[generateInsights] Created new theme "${insight.name}" (${newTheme.id})`,
        );
      }

      consola.success(
        `[generateInsights] Processed ${createdThemes.length} themes/insights for interview ${interviewId}`,
      );

      // Step 3: Create theme_evidence links using semantic matching
      // For each theme, find semantically matching evidence from this interview
      // This replaces the old cross-product approach (every theme × every evidence)
      let linkCount = 0;
      const themesWithNoLinks: string[] = [];

      if (createdThemes.length > 0) {
        consola.info(
          `[generateInsights] Creating semantic theme_evidence links for ${createdThemes.length} themes`,
        );

        for (const theme of createdThemes) {
          try {
            // Build search query from the insight that created/matched this theme
            const searchQuery = [theme.name, theme.details, theme.evidence]
              .filter(Boolean)
              .join(". ");

            // Find semantically matching evidence from this interview
            const similarEvidence = await searchEvidenceForTheme(client, {
              themeQuery: searchQuery,
              interviewId,
              matchThreshold: SIMILARITY_THRESHOLDS.EVIDENCE_TO_THEME, // 0.4
              matchCount: 20,
            });

            if (similarEvidence.length === 0) {
              consola.warn(
                `[generateInsights] No matching evidence found for theme "${theme.name}" (query: "${searchQuery.substring(0, 100)}...")`,
              );
              themesWithNoLinks.push(theme.name);
            } else {
              consola.debug(
                `[generateInsights] Found ${similarEvidence.length} matching evidence for theme "${theme.name}"`,
              );
            }

            // Create links with semantic confidence scores
            let linksCreatedForTheme = 0;
            for (const match of similarEvidence) {
              const { error: linkError } = await client
                .from("theme_evidence")
                .upsert(
                  {
                    account_id: interview.account_id,
                    project_id: interview.project_id,
                    theme_id: theme.id,
                    evidence_id: match.id,
                    rationale: `Semantic match (${Math.round(match.similarity * 100)}%)`,
                    confidence: match.similarity,
                  },
                  {
                    onConflict: "theme_id,evidence_id,account_id",
                    ignoreDuplicates: false, // Update confidence if already exists
                  },
                );

              if (!linkError) {
                linkCount++;
                linksCreatedForTheme++;
              }
            }

            if (linksCreatedForTheme === 0 && similarEvidence.length > 0) {
              consola.warn(
                `[generateInsights] Failed to create links for theme "${theme.name}" despite finding ${similarEvidence.length} matches`,
              );
              themesWithNoLinks.push(theme.name);
            }
          } catch (searchErr) {
            consola.warn(
              `[generateInsights] Semantic search failed for theme "${theme.name}":`,
              searchErr,
            );
            themesWithNoLinks.push(theme.name);
          }
        }

        consola.success(
          `[generateInsights] Created ${linkCount} semantic theme_evidence links`,
        );

        // Log warning if any themes got no links
        if (themesWithNoLinks.length > 0) {
          consola.warn(
            `[generateInsights] WARNING: ${themesWithNoLinks.length} themes have 0 evidence links: ${themesWithNoLinks.join(", ")}`,
          );
        }
      } else {
        consola.warn(
          `[generateInsights] No themes created, skipping evidence linking`,
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
