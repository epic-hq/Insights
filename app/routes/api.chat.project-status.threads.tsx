/**
 * API endpoint to list chat threads for the project status agent.
 * Returns all threads for a given user+project combination.
 */

import consola from "consola";
import type { LoaderFunctionArgs } from "react-router";
import { memory } from "~/mastra/memory";
import { userContext } from "~/server/user-context";

export async function loader({ context, params }: LoaderFunctionArgs) {
  const ctx = context.get(userContext);
  const projectId = String(params.projectId || "");
  const userId = ctx?.claims?.sub || "";

  if (!projectId) {
    return Response.json({ error: "Missing projectId" }, { status: 400 });
  }

  if (!userId) {
    return Response.json({ error: "Missing userId" }, { status: 401 });
  }

  try {
    const resourceId = `projectStatusAgent-${userId}-${projectId}`;

    const threads = await memory.listThreads({
      filter: { resourceId },
      orderBy: { field: "createdAt", direction: "DESC" },
      page: 0,
      perPage: 20,
    });

    if (!threads?.total || threads.total === 0) {
      return Response.json({ threads: [] });
    }

    const threadList = threads.threads.map((thread) => ({
      id: thread.id,
      title: thread.title || "Untitled chat",
      createdAt: thread.createdAt,
    }));

    return Response.json({ threads: threadList });
  } catch (error) {
    consola.error("Error listing project status chat threads:", error);
    return Response.json({ error: "Failed to list threads" }, { status: 500 });
  }
}
