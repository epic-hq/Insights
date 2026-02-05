/**
 * Trigger.dev task for cross-lens synthesis
 *
 * Combines ALL lens analyses across a project into a unified executive briefing.
 * Unlike per-lens synthesis (which only sees one template), this sees everything:
 * BANT + Discovery + Empathy + custom lenses together.
 *
 * Stored in conversation_lens_summaries with template_key = '__cross_lens__'.
 */

import { schemaTask } from "@trigger.dev/sdk";
import consola from "consola";
import { z } from "zod";
import {
  runBamlWithBilling,
  systemBillingContext,
} from "~/lib/billing/instrumented-baml.server";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";

const CROSS_LENS_KEY = "__cross_lens__";

const synthesizeCrossLensSchema = z.object({
  projectId: z.string().uuid(),
  accountId: z.string().uuid(),
  customInstructions: z.string().optional(),
  force: z.boolean().optional().default(false),
});

export type SynthesizeCrossLensPayload = z.infer<
  typeof synthesizeCrossLensSchema
>;

export const synthesizeCrossLensTask = schemaTask({
  id: "lens.synthesize-cross-lens",
  schema: synthesizeCrossLensSchema,
  retry: {
    maxAttempts: 3,
    factor: 1.8,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 60_000,
  },
  run: async (payload, { ctx }) => {
    const { projectId, accountId, customInstructions, force } = payload;
    const client = createSupabaseAdminClient();

    consola.info(
      `[cross-lens] Starting cross-lens synthesis for project=${projectId}`,
    );

    // 1. Load project context
    const { data: project } = await (client as any)
      .from("projects")
      .select("name, description")
      .eq("id", projectId)
      .single();

    const projectContext = project
      ? `Project: ${project.name || "Unnamed"}\n${project.description || ""}`
      : "No project context available";

    // 2. Load all completed analyses
    const { data: analyses, error: analysesError } = await (client as any)
      .from("conversation_lens_analyses")
      .select(
        "id, interview_id, template_key, analysis_data, confidence_score, processed_at",
      )
      .eq("project_id", projectId)
      .eq("status", "completed")
      .order("processed_at", { ascending: false });

    if (analysesError) {
      throw new Error(`Failed to load analyses: ${analysesError.message}`);
    }

    if (!analyses || analyses.length === 0) {
      consola.info(`[cross-lens] No analyses found for project=${projectId}`);
      return { status: "no_data", analysisCount: 0 };
    }

    consola.info(
      `[cross-lens] Found ${analyses.length} analyses across all lenses`,
    );

    // 3. Check if synthesis is already up-to-date
    if (!force) {
      const { data: existing } = await (client as any)
        .from("conversation_lens_summaries")
        .select("id, interview_count, status")
        .eq("project_id", projectId)
        .eq("template_key", CROSS_LENS_KEY)
        .maybeSingle();

      if (
        existing &&
        existing.status === "completed" &&
        existing.interview_count === analyses.length
      ) {
        consola.info(`[cross-lens] Synthesis already up-to-date`);
        return { status: "up_to_date", summaryId: existing.id };
      }
    }

    // 4. Load per-lens summaries (already synthesized)
    const { data: perLensSummaries } = await (client as any)
      .from("conversation_lens_summaries")
      .select(
        "template_key, executive_summary, key_takeaways, recommendations, overall_confidence",
      )
      .eq("project_id", projectId)
      .neq("template_key", CROSS_LENS_KEY)
      .eq("status", "completed");

    // 5. Load template names for context
    const templateKeys = [
      ...new Set(analyses.map((a: any) => a.template_key)),
    ];
    const { data: templates } = await (client as any)
      .from("conversation_lens_templates")
      .select("template_key, template_name, category")
      .in("template_key", templateKeys);

    const templateNameMap = new Map<string, string>();
    for (const t of templates || []) {
      templateNameMap.set(t.template_key, t.template_name);
    }

    // 6. Load interview titles for context
    const interviewIds = [
      ...new Set(analyses.map((a: any) => a.interview_id)),
    ];
    const { data: interviews } = await (client as any)
      .from("interviews")
      .select("id, title, participant_pseudonym")
      .in("id", interviewIds);

    const interviewMap = new Map<
      string,
      { title: string; participant: string | null }
    >();
    for (const iv of interviews || []) {
      interviewMap.set(iv.id, {
        title: iv.title || "Untitled",
        participant: iv.participant_pseudonym,
      });
    }

    // 7. Load people context
    const { data: people } = await (client as any)
      .from("people")
      .select("id, name, title, company")
      .eq("project_id", projectId)
      .limit(50);

    const peopleContext =
      people && people.length > 0
        ? JSON.stringify(
            people.map((p: any) => ({
              name: p.name,
              role: p.title,
              company: p.company,
            })),
          )
        : null;

    // 8. Create/update summary record to "processing"
    const { data: summaryRecord, error: upsertError } = await (client as any)
      .from("conversation_lens_summaries")
      .upsert(
        {
          project_id: projectId,
          template_key: CROSS_LENS_KEY,
          account_id: accountId,
          status: "processing",
          interview_count: analyses.length,
          custom_instructions: customInstructions,
          trigger_run_id: ctx.run.id,
        },
        { onConflict: "project_id,template_key" },
      )
      .select("id")
      .single();

    if (upsertError || !summaryRecord) {
      throw new Error(
        `Failed to create summary record: ${upsertError?.message || "Unknown"}`,
      );
    }

    // 9. Prepare data for BAML
    const lensSummariesJson = JSON.stringify(
      (perLensSummaries || []).map((s: any) => ({
        lens_name: templateNameMap.get(s.template_key) || s.template_key,
        executive_summary: s.executive_summary,
        key_takeaways: s.key_takeaways,
        recommendations: s.recommendations,
        confidence: s.overall_confidence,
      })),
    );

    // Trim analyses to essential data to fit context window
    const allAnalysesJson = JSON.stringify(
      analyses.map((a: any) => {
        const interview = interviewMap.get(a.interview_id);
        return {
          lens: templateNameMap.get(a.template_key) || a.template_key,
          interview: interview?.title || "Untitled",
          participant: interview?.participant,
          executive_summary: a.analysis_data?.executive_summary,
          sections: (a.analysis_data?.sections || []).map((s: any) => ({
            section_name: s.section_name,
            summary: s.summary,
            fields: (s.fields || [])
              .filter((f: any) => f.value)
              .map((f: any) => ({
                name: f.field_name,
                value:
                  typeof f.value === "string" && f.value.length > 200
                    ? f.value.slice(0, 200) + "..."
                    : f.value,
              })),
          })),
          entities: (a.analysis_data?.entities || []).map((e: any) => ({
            type: e.entity_type,
            count: e.items?.length || 0,
            items: (e.items || []).slice(0, 5).map((item: any) => ({
              name: item.name || item.description,
              role: item.role,
            })),
          })),
          recommendations: a.analysis_data?.recommendations,
          confidence: a.confidence_score,
        };
      }),
    );

    try {
      // 10. Call BAML
      consola.info(
        `[cross-lens] Calling SynthesizeCrossLensInsights for ${analyses.length} analyses across ${templateKeys.length} lenses`,
      );
      const billingCtx = systemBillingContext(
        accountId,
        "cross_lens_synthesis",
        projectId,
      );
      const { result: synthesisResult } = await runBamlWithBilling(
        billingCtx,
        {
          functionName: "SynthesizeCrossLensInsights",
          traceName: "lens.synthesize-cross-lens",
          input: {
            analysisCount: analyses.length,
            lensCount: templateKeys.length,
          },
          metadata: {
            projectId,
            accountId,
            summaryId: summaryRecord.id,
          },
          resourceType: "cross_lens_summary",
          resourceId: summaryRecord.id,
          bamlCall: (bamlClient) =>
            bamlClient.SynthesizeCrossLensInsights(
              projectContext,
              lensSummariesJson,
              allAnalysesJson,
              peopleContext,
              customInstructions || null,
            ),
        },
        `cross-lens:${projectId}`,
      );

      // 11. Store result
      const { error: updateError } = await (client as any)
        .from("conversation_lens_summaries")
        .update({
          synthesis_data: synthesisResult,
          executive_summary: synthesisResult.executive_summary,
          key_takeaways: synthesisResult.key_findings,
          recommendations: synthesisResult.recommended_actions,
          conflicts_to_review: synthesisResult.risks,
          overall_confidence: synthesisResult.overall_confidence,
          interview_count: analyses.length,
          status: "completed",
          processed_at: new Date().toISOString(),
          processed_by: "trigger.dev",
          error_message: null,
        })
        .eq("id", summaryRecord.id);

      if (updateError) {
        throw new Error(`Failed to store synthesis: ${updateError.message}`);
      }

      consola.success(
        `[cross-lens] Synthesized ${analyses.length} analyses across ${templateKeys.length} lenses`,
      );

      return {
        status: "completed",
        summaryId: summaryRecord.id,
        analysisCount: analyses.length,
        lensCount: templateKeys.length,
        findingsCount: synthesisResult.key_findings?.length || 0,
      };
    } catch (error: any) {
      await (client as any)
        .from("conversation_lens_summaries")
        .update({
          status: "failed",
          error_message: error?.message || "Unknown error",
        })
        .eq("id", summaryRecord.id);

      throw error;
    }
  },
});
