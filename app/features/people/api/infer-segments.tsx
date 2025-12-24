/**
 * API endpoint to trigger segment inference for people
 */
import { tasks } from "@trigger.dev/sdk/v3";
import consola from "consola";
import type { ActionFunction } from "react-router";
import type { inferSegmentsTask } from "~/../src/trigger/people/inferSegments";
import { currentProjectContext } from "~/server/current-project-context";

interface InferSegmentsPayload {
  personId?: string;
  force?: boolean;
}

export const action: ActionFunction = async ({ context, request, params }) => {
  consola.info("[infer-segments] Action endpoint hit", {
    method: request.method,
    params,
  });

  // Get account/project from context (set by projects.tsx middleware)
  // or fall back to URL params
  const projectCtx = context.get(currentProjectContext);
  const accountId = projectCtx?.accountId || params?.accountId || null;
  const projectId = projectCtx?.projectId || params?.projectId || null;

  consola.info("[infer-segments] Context loaded", {
    accountId,
    projectId,
    contextAccountId: projectCtx?.accountId,
    contextProjectId: projectCtx?.projectId,
    paramsAccountId: params?.accountId,
    paramsProjectId: params?.projectId,
  });

  if (!accountId || !projectId) {
    consola.warn("[infer-segments] Missing context", { accountId, projectId });
    return Response.json(
      { error: "Missing account or project context" },
      { status: 400 },
    );
  }

  try {
    const payload = (await request.json()) as InferSegmentsPayload;
    const { personId, force = false } = payload;

    consola.info("[infer-segments] Triggering task", {
      accountId,
      projectId,
      personId,
      force,
    });

    // Trigger the task
    const handle = await tasks.trigger<typeof inferSegmentsTask>(
      "people.infer-segments",
      {
        projectId,
        accountId,
        personId,
        force,
      },
    );

    consola.success("[infer-segments] Task triggered", { runId: handle.id });

    return Response.json({
      success: true,
      runId: handle.id,
      message: personId
        ? "Segment inference started for person"
        : "Segment inference started for all people in project",
    });
  } catch (err) {
    consola.error("[infer-segments] API error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
};
