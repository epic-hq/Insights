/**
 * Extract Survey Evidence Task
 *
 * Creates evidence records from completed survey text responses.
 * This is a simple extraction (no AI processing) - just copies
 * text answers into the unified evidence table for searching,
 * theming, and analysis alongside interview evidence.
 *
 * Only processes text question types (short_text, long_text, auto).
 * Structured responses (likert, select) are used for aggregate stats.
 */

import { schemaTask } from "@trigger.dev/sdk";
import consola from "consola";
import { z } from "zod";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";

/** Question types that produce text evidence */
const TEXT_QUESTION_TYPES = new Set(["short_text", "long_text", "auto"]);

/** Minimum text length to create evidence (skip empty/trivial answers) */
const MIN_TEXT_LENGTH = 10;

export const extractSurveyEvidenceTask = schemaTask({
  id: "survey.extract-evidence",
  schema: z.object({
    responseId: z.string().uuid(),
  }),
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 30000,
  },
  run: async (payload) => {
    const { responseId } = payload;
    const db = createSupabaseAdminClient();

    consola.info(
      `[extractSurveyEvidence] Starting for response: ${responseId}`,
    );

    // 1. Load the response first
    const { data: response, error: responseError } = await db
      .from("research_link_responses")
      .select("id, research_link_id, person_id, email, responses")
      .eq("id", responseId)
      .single();

    if (responseError) {
      consola.error(
        `[extractSurveyEvidence] Supabase error for ${responseId}:`,
        responseError,
      );
      throw new Error(
        `Failed to fetch response ${responseId}: ${responseError.message}`,
      );
    }

    if (!response) {
      throw new Error(`Response not found: ${responseId}`);
    }

    // 2. Load the research link separately
    const { data: researchLinkData, error: linkError } = await db
      .from("research_links")
      .select("id, account_id, project_id, name, questions")
      .eq("id", response.research_link_id)
      .single();

    if (linkError || !researchLinkData) {
      consola.error(
        `[extractSurveyEvidence] Failed to fetch research link:`,
        linkError,
      );
      throw new Error(`Research link not found for response: ${responseId}`);
    }

    const { account_id, project_id, name: surveyName } = researchLinkData;
    const questions = Array.isArray(researchLinkData.questions)
      ? (researchLinkData.questions as Array<{
          id: string;
          prompt: string;
          type: string;
        }>)
      : [];
    const answers = (response.responses as Record<string, unknown>) ?? {};

    consola.info(
      `[extractSurveyEvidence] Survey "${surveyName}" has ${questions.length} questions, ${Object.keys(answers).length} answers`,
    );

    // 2. Filter to text questions with non-empty answers
    const textQuestionsWithAnswers: Array<{
      questionId: string;
      prompt: string;
      answer: string;
    }> = [];

    for (const question of questions) {
      if (!TEXT_QUESTION_TYPES.has(question.type)) continue;

      const answer = answers[question.id];
      if (typeof answer !== "string") continue;

      const trimmedAnswer = answer.trim();
      if (trimmedAnswer.length < MIN_TEXT_LENGTH) continue;

      textQuestionsWithAnswers.push({
        questionId: question.id,
        prompt: question.prompt,
        answer: trimmedAnswer,
      });
    }

    if (textQuestionsWithAnswers.length === 0) {
      consola.info(
        `[extractSurveyEvidence] No text answers to extract for response ${responseId}`,
      );
      return {
        success: true,
        evidenceCount: 0,
        message: "No text answers to extract",
      };
    }

    consola.info(
      `[extractSurveyEvidence] Extracting ${textQuestionsWithAnswers.length} text answers as evidence`,
    );

    // 3. Delete existing evidence for this response (idempotency)
    const { error: deleteError } = await db
      .from("evidence")
      .delete()
      .eq("research_link_response_id", responseId);

    if (deleteError) {
      consola.warn(
        `[extractSurveyEvidence] Failed to delete existing evidence:`,
        deleteError,
      );
    }

    // 4. Create evidence records
    const evidenceRecords = textQuestionsWithAnswers.map((qa) => ({
      account_id,
      project_id,
      research_link_response_id: responseId,
      // Content
      verbatim: qa.answer,
      gist: qa.answer.length > 100 ? `${qa.answer.slice(0, 97)}...` : qa.answer,
      context_summary: `Response to survey question: "${qa.prompt}"`,
      // Provenance
      source_type: "primary" as const,
      method: "survey" as const,
      modality: "qual" as const,
      confidence: "high" as const, // Direct user input = high confidence
      // No anchors for survey responses (no media)
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
      `[extractSurveyEvidence] Inserted ${insertedIds.length} evidence records`,
    );

    // 5. Create evidence_people junction if person_id exists
    if (response.person_id && insertedIds.length > 0) {
      const evidencePeopleRecords = insertedIds.map((evidenceId) => ({
        evidence_id: evidenceId,
        person_id: response.person_id,
        account_id,
        project_id,
        role: "respondent",
      }));

      const { error: junctionError } = await db
        .from("evidence_people")
        .insert(evidencePeopleRecords);

      if (junctionError) {
        consola.warn(
          `[extractSurveyEvidence] Failed to create evidence_people links:`,
          junctionError,
        );
      } else {
        consola.info(
          `[extractSurveyEvidence] Linked ${insertedIds.length} evidence records to person ${response.person_id}`,
        );
      }
    }

    consola.success(
      `[extractSurveyEvidence] Complete for response ${responseId}: ${insertedIds.length} evidence records`,
    );

    return {
      success: true,
      evidenceCount: insertedIds.length,
      evidenceIds: insertedIds,
    };
  },
});
