/**
 * Extract Personalized Survey Evidence Task
 *
 * AI-powered evidence extraction from personalized survey responses.
 * Uses BAML ExtractEvidenceFromAnswer to create structured evidence
 * with empathy map facets, confidence scores, and theme matching.
 *
 * Triggered when a personalized survey response is completed.
 */

import { schemaTask } from "@trigger.dev/sdk";
import consola from "consola";
import { z } from "zod";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";

export const extractPersonalizedEvidenceTask = schemaTask({
  id: "survey.extract-personalized-evidence",
  schema: z.object({
    personalizedSurveyId: z.string().uuid(),
    responseId: z.string().uuid().optional(),
  }),
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 2000,
    maxTimeoutInMs: 60000,
  },
  run: async (payload) => {
    const { personalizedSurveyId, responseId } = payload;
    const db = createSupabaseAdminClient();

    // Dynamic import for BAML (Trigger.dev tasks need this)
    const { b } = await import("baml_client");

    consola.info(
      `[extractPersonalizedEvidence] Starting for survey: ${personalizedSurveyId}`,
    );

    // 1. Load the personalized survey
    const { data: survey, error: surveyError } = await db
      .from("personalized_surveys")
      .select(
        "id, account_id, project_id, research_link_id, person_id, survey_goal, questions, generation_metadata",
      )
      .eq("id", personalizedSurveyId)
      .single();

    if (surveyError || !survey) {
      throw new Error(`Personalized survey not found: ${personalizedSurveyId}`);
    }

    // 2. Load the response (either specified or find the latest)
    let responseQuery = db
      .from("research_link_responses")
      .select("id, responses, person_id")
      .eq("personalized_survey_id", personalizedSurveyId);

    if (responseId) {
      responseQuery = responseQuery.eq("id", responseId);
    }

    const { data: response, error: responseError } = await responseQuery
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (responseError || !response) {
      throw new Error(
        `No response found for personalized survey: ${personalizedSurveyId}`,
      );
    }

    const questions = Array.isArray(survey.questions)
      ? (survey.questions as Array<{
          id: string;
          prompt: string;
          type: string;
          rationale?: string;
          uses_attributes?: string[];
          evidence_type?: string;
        }>)
      : [];

    const answers = (response.responses as Record<string, unknown>) ?? {};

    consola.info(
      `[extractPersonalizedEvidence] ${questions.length} questions, ${Object.keys(answers).length} answers`,
    );

    // 3. Delete existing evidence for idempotency
    const { error: deleteError } = await db
      .from("evidence")
      .delete()
      .eq("research_link_response_id", response.id);

    if (deleteError) {
      consola.warn(
        `[extractPersonalizedEvidence] Failed to delete existing evidence:`,
        deleteError,
      );
    }

    // 4. For each question+answer, run BAML extraction
    const allEvidence: Array<{
      gist: string;
      verbatim: string;
      context_summary: string;
      category: string;
      confidence: number;
      theme_matches: string[];
    }> = [];

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      const answer = answers[question.id];

      if (typeof answer !== "string" || answer.trim().length < 10) continue;

      try {
        const questionMetadata = JSON.stringify({
          rationale: question.rationale || "",
          uses_attributes: question.uses_attributes || [],
          evidence_type: question.evidence_type || "context",
          survey_goal: survey.survey_goal,
        });

        const extracted = await b.ExtractEvidenceFromAnswer(
          question.prompt,
          answer.trim(),
          questionMetadata,
          i + 1,
        );

        for (const evidence of extracted) {
          if (evidence.confidence >= 0.5) {
            allEvidence.push({
              gist: evidence.gist,
              verbatim: evidence.verbatim,
              context_summary: evidence.context_summary,
              category: evidence.category,
              confidence: evidence.confidence,
              theme_matches: evidence.theme_matches,
            });
          }
        }
      } catch (error) {
        consola.warn(
          `[extractPersonalizedEvidence] BAML extraction failed for Q${i + 1}:`,
          error instanceof Error ? error.message : error,
        );
        // Fallback: create simple evidence from raw answer
        allEvidence.push({
          gist:
            answer.trim().length > 100
              ? `${answer.trim().slice(0, 97)}...`
              : answer.trim(),
          verbatim: answer.trim(),
          context_summary: `Response to: "${question.prompt}"`,
          category: question.evidence_type || "context",
          confidence: 0.7,
          theme_matches: [],
        });
      }
    }

    if (allEvidence.length === 0) {
      consola.info(
        `[extractPersonalizedEvidence] No evidence extracted for ${personalizedSurveyId}`,
      );
      await db
        .from("personalized_surveys")
        .update({
          evidence_extracted: true,
          evidence_count: 0,
          extraction_metadata: {
            extracted_at: new Date().toISOString(),
            status: "no_evidence",
          },
        })
        .eq("id", personalizedSurveyId);

      return { success: true, evidenceCount: 0 };
    }

    // 5. Insert evidence records
    const evidenceRecords = allEvidence.map((e) => ({
      account_id: survey.account_id,
      project_id: survey.project_id,
      research_link_response_id: response.id,
      verbatim: e.verbatim,
      gist: e.gist,
      context_summary: e.context_summary,
      source_type: "primary" as const,
      method: "survey" as const,
      modality: "qual" as const,
      confidence:
        e.confidence >= 0.9
          ? ("high" as const)
          : e.confidence >= 0.7
            ? ("medium" as const)
            : ("low" as const),
      anchors: [] as unknown[],
    }));

    const { data: insertedEvidence, error: insertError } = await db
      .from("evidence")
      .insert(evidenceRecords)
      .select("id");

    if (insertError) {
      throw new Error(`Failed to insert evidence: ${insertError.message}`);
    }

    const insertedIds = (insertedEvidence ?? []).map((e) => e.id);
    consola.info(
      `[extractPersonalizedEvidence] Inserted ${insertedIds.length} evidence records`,
    );

    // 6. Link evidence to person
    if (survey.person_id && insertedIds.length > 0) {
      const evidencePeopleRecords = insertedIds.map((evidenceId) => ({
        evidence_id: evidenceId,
        person_id: survey.person_id,
        account_id: survey.account_id,
        project_id: survey.project_id,
        role: "respondent",
      }));

      const { error: junctionError } = await db
        .from("evidence_people")
        .insert(evidencePeopleRecords);

      if (junctionError) {
        consola.warn(
          `[extractPersonalizedEvidence] Failed to link evidence to person:`,
          junctionError,
        );
      }
    }

    // 7. Match themes for extracted evidence
    if (insertedIds.length > 0 && survey.project_id) {
      const { data: themes } = await db
        .from("themes")
        .select("id, name")
        .eq("project_id", survey.project_id);

      if (themes && themes.length > 0) {
        const themeMap = new Map(
          themes.map((t) => [t.name.toLowerCase(), t.id]),
        );

        const themeEvidenceLinks: Array<{
          theme_id: string;
          evidence_id: string;
        }> = [];

        for (let i = 0; i < allEvidence.length; i++) {
          const evidenceId = insertedIds[i];
          if (!evidenceId) continue;

          for (const themeName of allEvidence[i].theme_matches) {
            const themeId = themeMap.get(themeName.toLowerCase());
            if (themeId) {
              themeEvidenceLinks.push({
                theme_id: themeId,
                evidence_id: evidenceId,
              });
            }
          }
        }

        if (themeEvidenceLinks.length > 0) {
          const { error: themeError } = await db
            .from("theme_evidence")
            .upsert(themeEvidenceLinks, {
              onConflict: "theme_id,evidence_id",
              ignoreDuplicates: true,
            });

          if (themeError) {
            consola.warn(
              `[extractPersonalizedEvidence] Failed to link themes:`,
              themeError,
            );
          } else {
            consola.info(
              `[extractPersonalizedEvidence] Linked ${themeEvidenceLinks.length} theme-evidence pairs`,
            );
          }
        }
      }
    }

    // 8. Update personalized survey with extraction results
    const confidenceAvg =
      allEvidence.reduce((sum, e) => sum + e.confidence, 0) /
      allEvidence.length;

    await db
      .from("personalized_surveys")
      .update({
        evidence_extracted: true,
        evidence_count: insertedIds.length,
        extraction_metadata: {
          extracted_at: new Date().toISOString(),
          confidence_avg: Math.round(confidenceAvg * 100) / 100,
          categories: allEvidence.reduce(
            (acc, e) => {
              acc[e.category] = (acc[e.category] || 0) + 1;
              return acc;
            },
            {} as Record<string, number>,
          ),
        },
      })
      .eq("id", personalizedSurveyId);

    // 9. Update response tracking
    await db
      .from("research_link_responses")
      .update({
        evidence_extracted: true,
        evidence_count: insertedIds.length,
      })
      .eq("id", response.id);

    consola.success(
      `[extractPersonalizedEvidence] Complete: ${insertedIds.length} evidence, avg confidence ${confidenceAvg.toFixed(2)}`,
    );

    // 10. Trigger stats recomputation
    try {
      const { computeSurveyStatsTask } = await import("./computeSurveyStats");
      await computeSurveyStatsTask.trigger({
        researchLinkId: survey.research_link_id,
      });
    } catch (statsError) {
      consola.warn(
        `[extractPersonalizedEvidence] Failed to trigger stats:`,
        statsError,
      );
    }

    return {
      success: true,
      evidenceCount: insertedIds.length,
      evidenceIds: insertedIds,
      confidenceAvg,
    };
  },
});
