import { createTool } from "@mastra/core/tools";
import type { SupabaseClient } from "@supabase/supabase-js";
import consola from "consola";
import { supabaseAdmin } from "~/lib/supabase/client.server";
import { HOST } from "~/paths";
import type { Database } from "~/types";
import { createRouteDefinitions } from "~/utils/route-definitions";

function extractProjectIdFromResourceId(
  resourceId?: string | null,
): string | null {
  if (!resourceId) return null;
  const match = resourceId.match(/[0-9a-fA-F-]{36}$/);
  return match ? match[0] : null;
}

/**
 * Tool to generate project-scoped routes for linking to entities in AI responses
 */
export const generateProjectRoutesTool = createTool({
  id: "generate-project-routes",
  description:
    "Generate URLs for project entities like personas, people, opportunities, survey_response, etc. Use this to create clickable links in responses. For survey_response, pass surveyId as parentEntityId and responseId as entityId.",
  inputSchema: {
    type: "object",
    properties: {
      entityType: {
        type: "string",
        enum: [
          "persona",
          "person",
          "opportunity",
          "organization",
          "theme",
          "evidence",
          "insight",
          "interview",
          "segment",
          "survey",
          "survey_response",
        ],
        description: "The type of entity to generate a route for",
      },
      entityId: {
        type: "string",
        description:
          "The ID of the entity (for survey_response, this is the responseId)",
      },
      parentEntityId: {
        type: "string",
        description:
          "Parent entity ID for nested resources (e.g., surveyId for survey_response)",
      },
      action: {
        type: "string",
        enum: ["detail", "edit"],
        default: "detail",
        description:
          "The action/route type to generate (detail page or edit page)",
      },
      projectId: {
        type: "string",
        description:
          "Optional project ID override when request context is missing",
      },
      accountId: {
        type: "string",
        description:
          "Optional account ID override when request context is missing",
      },
    },
    required: ["entityType", "entityId"],
  },
  outputSchema: {
    type: "object",
    properties: {
      success: {
        type: "boolean",
        description: "Whether the route generation was successful",
      },
      route: {
        type: "string",
        nullable: true,
        description: "Relative route that can be used directly in-app",
      },
      absoluteRoute: {
        type: "string",
        nullable: true,
        description:
          "Absolute URL including the host (useful for emails or copying)",
      },
      entityType: {
        type: "string",
        optional: true,
        description: "The type of entity to generate a route for",
      },
      entityId: {
        type: "string",
        optional: true,
        description: "The ID of the entity",
      },
      action: {
        type: "string",
        optional: true,
        description:
          "The action/route type to generate (detail page or edit page)",
      },
      error: {
        type: "string",
        optional: true,
        description: "Error message if route generation failed",
      },
    },
  },
  execute: async (input, context?) => {
    const supabase = supabaseAdmin as SupabaseClient<Database>;
    const { entityType, entityId, action = "detail" } = input || {};

    // Validate required parameters
    if (!entityType || !entityId) {
      consola.warn("generate-project-routes: Missing required parameters", {
        entityType,
        entityId,
        action,
      });
      return {
        success: false,
        error:
          "Missing required parameters: entityType and entityId are required",
        route: null,
        absoluteRoute: null,
      };
    }

    const contextAccountId = context?.requestContext?.get?.("account_id") as
      | string
      | undefined;
    const contextProjectId = context?.requestContext?.get?.("project_id") as
      | string
      | undefined;
    const resourceProjectId = extractProjectIdFromResourceId(
      context?.agent?.resourceId,
    );
    const inputProjectId =
      typeof input.projectId === "string" ? input.projectId : undefined;
    const inputAccountId =
      typeof input.accountId === "string" ? input.accountId : undefined;

    const projectId = (
      contextProjectId ||
      inputProjectId ||
      resourceProjectId ||
      ""
    ).trim();
    let accountId = (contextAccountId || inputAccountId || "").trim();

    if (!accountId && projectId) {
      const { data: projectRow, error } = await supabase
        .from("projects")
        .select("account_id")
        .eq("id", projectId)
        .maybeSingle();

      if (error) {
        consola.error(
          "generate-project-routes: failed to resolve accountId from project",
          error,
        );
      }

      if (projectRow?.account_id) {
        accountId = projectRow.account_id;
      }
    }

    if (!accountId || !projectId) {
      consola.warn("generate-project-routes: Missing runtime context", {
        accountId,
        projectId,
      });
      return {
        success: false,
        error: "Missing accountId or projectId in runtime context",
        route: null,
        absoluteRoute: null,
      };
    }

    try {
      // Use existing route definitions from shared codebase
      const projectPath = `/a/${accountId}/${projectId}`;
      const routes = createRouteDefinitions(projectPath);

      let route: string;

      switch (entityType) {
        case "persona":
          route =
            action === "edit"
              ? routes.personas.edit(entityId)
              : routes.personas.detail(entityId);
          break;
        case "person":
          route =
            action === "edit"
              ? routes.people.edit(entityId)
              : routes.people.detail(entityId);
          break;
        case "opportunity":
          route =
            action === "edit"
              ? routes.opportunities.edit(entityId)
              : routes.opportunities.detail(entityId);
          break;
        case "organization":
          route =
            action === "edit"
              ? routes.organizations.edit(entityId)
              : routes.organizations.detail(entityId);
          break;
        case "theme":
          route =
            action === "edit"
              ? routes.themes.edit(entityId)
              : routes.themes.detail(entityId);
          break;
        case "evidence":
          route =
            action === "edit"
              ? routes.evidence.edit(entityId)
              : routes.evidence.detail(entityId);
          break;
        case "insight":
          route =
            action === "edit"
              ? routes.insights.edit(entityId)
              : routes.insights.detail(entityId);
          break;
        case "interview":
          route =
            action === "edit"
              ? routes.interviews.edit(entityId)
              : routes.interviews.detail(entityId);
          break;
        case "segment":
          route = routes.segments.detail(entityId); // segments don't have edit
          break;
        case "survey":
          route =
            action === "edit"
              ? routes.ask.edit(entityId)
              : routes.ask.responses(entityId);
          break;
        case "survey_response": {
          const parentId =
            typeof input.parentEntityId === "string"
              ? input.parentEntityId
              : null;
          if (!parentId) {
            return {
              success: false,
              error:
                "survey_response requires parentEntityId (surveyId) to be provided",
              route: null,
              absoluteRoute: null,
            };
          }
          route = routes.ask.responseDetail(parentId, entityId);
          break;
        }
        default:
          return {
            success: false,
            error: `Unknown entity type: ${entityType}`,
            route: null,
            absoluteRoute: null,
          };
      }

      const absoluteRoute = `${HOST}${route}`;

      return {
        success: true,
        route,
        absoluteRoute,
        entityType,
        entityId,
        action,
      };
    } catch (error) {
      consola.error("generate-project-routes: Unexpected error", error);
      return {
        success: false,
        error: "Unexpected error generating route",
        route: null,
        absoluteRoute: null,
      };
    }
  },
});
