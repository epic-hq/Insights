/**
 * Compute Survey Statistics Task
 *
 * Aggregates all completed responses for a survey and stores computed
 * statistics in the research_links.statistics JSONB column. This enables
 * efficient retrieval of survey results without recomputing from scratch.
 *
 * Triggered after:
 * - A survey response is completed
 * - Manual backfill request
 */

import { schemaTask } from "@trigger.dev/sdk";
import consola from "consola";
import { z } from "zod";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";

/** Question types supported in surveys */
type QuestionType =
  | "auto"
  | "short_text"
  | "long_text"
  | "single_select"
  | "multi_select"
  | "likert"
  | "image_select";

interface QuestionDefinition {
  id: string;
  prompt: string;
  type: QuestionType;
  options?: string[] | null;
  likertScale?: number | null;
  likertLabels?: { low?: string; high?: string } | null;
}

interface QuestionStats {
  average?: number;
  distribution?: Record<string, number>;
  percentages?: Record<string, number>;
}

interface TextSample {
  answer: string;
  personId: string | null;
}

interface QuestionSummary {
  questionId: string;
  prompt: string;
  type: QuestionType;
  responseCount: number;
  stats?: QuestionStats;
  topResponses?: TextSample[];
}

interface SurveyStatistics {
  computedAt: string;
  responseCount: number;
  completedCount: number;
  questions: QuestionSummary[];
}

export const computeSurveyStatsTask = schemaTask({
  id: "survey.compute-stats",
  schema: z.object({
    researchLinkId: z.string().uuid(),
  }),
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 30000,
  },
  run: async (payload) => {
    const { researchLinkId } = payload;
    const db = createSupabaseAdminClient();

    consola.info(
      `[computeSurveyStats] Starting for research link: ${researchLinkId}`,
    );

    // 1. Load the research link to get questions
    const { data: researchLink, error: linkError } = await db
      .from("research_links")
      .select("id, name, questions")
      .eq("id", researchLinkId)
      .single();

    if (linkError || !researchLink) {
      consola.error(
        `[computeSurveyStats] Research link not found: ${researchLinkId}`,
        linkError,
      );
      throw new Error(`Research link not found: ${researchLinkId}`);
    }

    const questions = (researchLink.questions as QuestionDefinition[]) ?? [];

    // 2. Load all responses (both completed and not, for total count)
    const { data: allResponses, error: allError } = await db
      .from("research_link_responses")
      .select("id, completed")
      .eq("research_link_id", researchLinkId);

    if (allError) {
      consola.error(
        `[computeSurveyStats] Failed to fetch responses:`,
        allError,
      );
      throw new Error(`Failed to fetch responses: ${allError.message}`);
    }

    const responseCount = allResponses?.length ?? 0;
    const completedCount = allResponses?.filter((r) => r.completed).length ?? 0;

    // 3. Load completed responses with their answers
    const { data: completedResponses, error: completedError } = await db
      .from("research_link_responses")
      .select("id, responses, person_id")
      .eq("research_link_id", researchLinkId)
      .eq("completed", true);

    if (completedError) {
      consola.error(
        `[computeSurveyStats] Failed to fetch completed responses:`,
        completedError,
      );
      throw new Error(
        `Failed to fetch completed responses: ${completedError.message}`,
      );
    }

    consola.info(
      `[computeSurveyStats] Found ${responseCount} total, ${completedCount} completed responses`,
    );

    // 4. Aggregate stats for each question
    const questionSummaries: QuestionSummary[] = [];

    for (const question of questions) {
      const summary = aggregateQuestionResponses(
        question,
        completedResponses ?? [],
      );
      questionSummaries.push(summary);
    }

    // 5. Build the statistics object
    const statistics: SurveyStatistics = {
      computedAt: new Date().toISOString(),
      responseCount,
      completedCount,
      questions: questionSummaries,
    };

    // 6. Update the research link with computed stats
    const { error: updateError } = await db
      .from("research_links")
      .update({
        statistics,
        stats_updated_at: new Date().toISOString(),
      })
      .eq("id", researchLinkId);

    if (updateError) {
      consola.error(
        `[computeSurveyStats] Failed to update statistics:`,
        updateError,
      );
      throw new Error(`Failed to update statistics: ${updateError.message}`);
    }

    consola.success(
      `[computeSurveyStats] Complete for ${researchLink.name}: ${completedCount} responses, ${questionSummaries.length} questions`,
    );

    return {
      success: true,
      researchLinkId,
      responseCount,
      completedCount,
      questionCount: questionSummaries.length,
    };
  },
});

interface ResponseRow {
  id: string;
  responses: Record<string, unknown> | null;
  person_id: string | null;
}

function aggregateQuestionResponses(
  question: QuestionDefinition,
  responses: ResponseRow[],
): QuestionSummary {
  const questionId = question.id;
  const answers: Array<{
    value: unknown;
    personId: string | null;
  }> = [];

  for (const response of responses) {
    const responseData = response.responses ?? {};
    if (questionId in responseData) {
      answers.push({
        value: responseData[questionId],
        personId: response.person_id,
      });
    }
  }

  const summary: QuestionSummary = {
    questionId,
    prompt: question.prompt,
    type: question.type,
    responseCount: answers.length,
  };

  // Aggregate based on question type
  switch (question.type) {
    case "likert": {
      const numericValues = answers
        .map((a) => {
          const val =
            typeof a.value === "number"
              ? a.value
              : Number.parseInt(String(a.value), 10);
          return Number.isNaN(val) ? null : val;
        })
        .filter((v): v is number => v !== null);

      if (numericValues.length > 0) {
        const average =
          numericValues.reduce((sum, v) => sum + v, 0) / numericValues.length;
        const distribution: Record<string, number> = {};
        const scale = question.likertScale ?? 5;

        // Initialize all values in scale
        for (let i = 1; i <= scale; i++) {
          distribution[String(i)] = 0;
        }

        for (const val of numericValues) {
          distribution[String(val)] = (distribution[String(val)] ?? 0) + 1;
        }

        const percentages: Record<string, number> = {};
        for (const [key, count] of Object.entries(distribution)) {
          percentages[key] = Math.round((count / numericValues.length) * 100);
        }

        summary.stats = {
          average: Math.round(average * 100) / 100,
          distribution,
          percentages,
        };
      }
      break;
    }

    case "single_select":
    case "image_select": {
      const distribution: Record<string, number> = {};

      for (const answer of answers) {
        const val = String(answer.value ?? "");
        if (val) {
          distribution[val] = (distribution[val] ?? 0) + 1;
        }
      }

      if (Object.keys(distribution).length > 0) {
        const total = Object.values(distribution).reduce(
          (sum, v) => sum + v,
          0,
        );
        const percentages: Record<string, number> = {};
        for (const [key, count] of Object.entries(distribution)) {
          percentages[key] = Math.round((count / total) * 100);
        }

        summary.stats = { distribution, percentages };
      }
      break;
    }

    case "multi_select": {
      const distribution: Record<string, number> = {};

      for (const answer of answers) {
        const values = Array.isArray(answer.value)
          ? answer.value
          : [answer.value];
        for (const val of values) {
          const strVal = String(val ?? "");
          if (strVal) {
            distribution[strVal] = (distribution[strVal] ?? 0) + 1;
          }
        }
      }

      if (Object.keys(distribution).length > 0) {
        // For multi-select, percentage is of respondents who selected each option
        const respondentCount = answers.length;
        const percentages: Record<string, number> = {};
        for (const [key, count] of Object.entries(distribution)) {
          percentages[key] = Math.round((count / respondentCount) * 100);
        }

        summary.stats = { distribution, percentages };
      }
      break;
    }

    case "short_text":
    case "long_text":
    case "auto": {
      // For text questions, include a sample of top responses (first 5)
      const textResponses = answers
        .filter((a) => a.value && String(a.value).trim().length > 0)
        .slice(0, 5)
        .map((a) => ({
          answer: String(a.value),
          personId: a.personId,
        }));

      if (textResponses.length > 0) {
        summary.topResponses = textResponses;
      }
      break;
    }
  }

  return summary;
}
