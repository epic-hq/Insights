/**
 * Tool for listing and fetching surveys (research_links)
 * Enables chat agents to view available surveys in a project
 */
import { createTool } from "@mastra/core/tools";
import consola from "consola";
import { z } from "zod";
import { resolveProjectContext } from "./context-utils";

const SurveyOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  isLive: z.boolean(),
  allowChat: z.boolean(),
  defaultResponseMode: z.string().nullable(),
  questionCount: z.number(),
  responseCount: z.number(),
  completedResponseCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  editUrl: z.string(),
  publicUrl: z.string(),
  responsesUrl: z.string(),
});

export const fetchSurveysTool = createTool({
  id: "fetch-surveys",
  description: `List surveys (Ask links) for the current project. Use this to see available surveys, check their status, or find a specific survey to update or analyze.

Returns survey metadata including:
- Name, description, slug
- Live status (whether accepting responses)
- Question count and response counts
- URLs for editing, public access, and viewing responses`,
  inputSchema: z.object({
    projectId: z
      .string()
      .nullish()
      .describe("Project ID (defaults to runtime context)"),
    surveyId: z.string().nullish().describe("Fetch a specific survey by ID"),
    search: z
      .string()
      .nullish()
      .describe("Search surveys by name or description"),
    isLive: z
      .boolean()
      .nullish()
      .describe("Filter by live status (true = only live, false = only draft)"),
    includeQuestions: z
      .boolean()
      .nullish()
      .describe(
        "Include full question definitions in response (default: false)",
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .nullish()
      .describe("Maximum number of surveys to return (default: 20)"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    surveys: z.array(
      SurveyOutputSchema.extend({
        questions: z
          .array(
            z.object({
              id: z.string(),
              prompt: z.string(),
              type: z.string(),
              required: z.boolean().nullable(),
            }),
          )
          .optional(),
      }),
    ),
    total: z.number(),
  }),
  execute: async (input, context?) => {
    const { createSupabaseAdminClient } =
      await import("~/lib/supabase/client.server");
    const supabase = createSupabaseAdminClient();

    // Resolve project context
    let accountId: string;
    let projectId: string;
    let projectPath: string;

    try {
      const resolved = await resolveProjectContext(context, "fetch-surveys");
      accountId = resolved.accountId;
      projectId = input.projectId ?? resolved.projectId;
      projectPath = `/a/${accountId}/${projectId}`;
    } catch (error) {
      const runtimeProjectId = context?.requestContext?.get?.("project_id");
      projectId =
        input.projectId ??
        (runtimeProjectId ? String(runtimeProjectId).trim() : "");

      if (!projectId) {
        consola.error("fetch-surveys: No project context available");
        return {
          success: false,
          message:
            "Missing project context. Pass projectId parameter or ensure context is set.",
          surveys: [],
          total: 0,
        };
      }

      accountId = "";
      projectPath = "";
      consola.warn(
        "fetch-surveys: accountId not resolved, URLs may be incomplete",
      );
    }

    consola.info("fetch-surveys: execute start", {
      projectId,
      surveyId: input.surveyId,
      search: input.search,
      isLive: input.isLive,
      limit: input.limit,
    });

    try {
      // Build query
      let query = supabase
        .from("research_links")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (input.surveyId) {
        query = query.eq("id", input.surveyId);
      }

      if (input.search) {
        const term = `%${input.search.trim()}%`;
        query = query.or(`name.ilike.${term},description.ilike.${term}`);
      }

      if (typeof input.isLive === "boolean") {
        query = query.eq("is_live", input.isLive);
      }

      query = query.limit(input.limit ?? 20);

      const { data: surveys, error: surveysError } = await query;

      if (surveysError) {
        consola.error("fetch-surveys: query error", surveysError);
        return {
          success: false,
          message: `Database error: ${surveysError.message}`,
          surveys: [],
          total: 0,
        };
      }

      if (!surveys || surveys.length === 0) {
        return {
          success: true,
          message: input.surveyId
            ? "Survey not found."
            : input.search
              ? `No surveys found matching "${input.search}".`
              : "No surveys found in this project.",
          surveys: [],
          total: 0,
        };
      }

      // Get response counts for each survey
      const surveyIds = surveys.map((s) => s.id);
      const { data: responseCounts } = await supabase
        .from("research_link_responses")
        .select("research_link_id, completed")
        .in("research_link_id", surveyIds);

      // Aggregate counts per survey
      const countMap: Record<string, { total: number; completed: number }> = {};
      for (const response of responseCounts ?? []) {
        const id = response.research_link_id;
        if (!countMap[id]) {
          countMap[id] = { total: 0, completed: 0 };
        }
        countMap[id].total++;
        if (response.completed) {
          countMap[id].completed++;
        }
      }

      // Map surveys to output format
      const mappedSurveys = surveys.map((survey) => {
        const questions =
          (survey.questions as Array<{
            id: string;
            prompt: string;
            type: string;
            required?: boolean;
          }>) ?? [];

        const counts = countMap[survey.id] ?? { total: 0, completed: 0 };

        const result: z.infer<typeof SurveyOutputSchema> & {
          questions?: Array<{
            id: string;
            prompt: string;
            type: string;
            required: boolean | null;
          }>;
        } = {
          id: survey.id,
          name: survey.name,
          slug: survey.slug,
          description: survey.description,
          isLive: survey.is_live,
          allowChat: survey.allow_chat,
          defaultResponseMode: survey.default_response_mode,
          questionCount: questions.length,
          responseCount: counts.total,
          completedResponseCount: counts.completed,
          createdAt: survey.created_at,
          updatedAt: survey.updated_at,
          editUrl: projectPath
            ? `${projectPath}/ask/${survey.id}/edit`
            : `/ask/${survey.id}/edit`,
          publicUrl: `/research/${survey.slug}`,
          responsesUrl: projectPath
            ? `${projectPath}/ask/${survey.id}/responses`
            : `/ask/${survey.id}/responses`,
        };

        if (input.includeQuestions) {
          result.questions = questions.map((q) => ({
            id: q.id,
            prompt: q.prompt,
            type: q.type,
            required: q.required ?? null,
          }));
        }

        return result;
      });

      const message =
        mappedSurveys.length === 1
          ? `Found survey "${mappedSurveys[0].name}" with ${mappedSurveys[0].responseCount} responses.`
          : `Found ${mappedSurveys.length} surveys.`;

      consola.info("fetch-surveys: success", {
        count: mappedSurveys.length,
      });

      return {
        success: true,
        message,
        surveys: mappedSurveys,
        total: mappedSurveys.length,
      };
    } catch (error) {
      consola.error("fetch-surveys: unexpected error", error);
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Unexpected error fetching surveys",
        surveys: [],
        total: 0,
      };
    }
  },
});
