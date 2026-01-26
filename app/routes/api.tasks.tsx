/**
 * Task API Routes
 * Handles CRUD operations for the unified task/feature system
 *
 * POST /api/tasks?action=create - Create a new task
 * GET /api/tasks?projectId=xxx - Get all tasks for a project
 * GET /api/tasks?id=xxx - Get a specific task
 * POST /api/tasks?action=update - Update a task
 * POST /api/tasks?action=delete - Delete (archive) a task
 * POST /api/tasks?action=bulk-update - Update multiple tasks
 * GET /api/tasks?action=activity&taskId=xxx - Get activity for a task
 */

import consola from "consola";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
  bulkUpdateTasks,
  createTask,
  deleteTask,
  getTaskActivity,
  getTaskById,
  getTasks,
  updateTask,
} from "~/features/tasks/db";
import type {
  TaskInsert,
  TaskListOptions,
  TaskUpdate,
} from "~/features/tasks/types";
import { getPostHogServerClient } from "~/lib/posthog.server";
import { getServerClient } from "~/lib/supabase/client.server";

// ============================================================================
// Loader - Handle GET requests
// ============================================================================

export async function loader({ request }: LoaderFunctionArgs) {
  const { client: supabase, user } = getServerClient(request);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const action = url.searchParams.get("action");
    const id = url.searchParams.get("id");
    const projectId = url.searchParams.get("projectId");
    const taskId = url.searchParams.get("taskId");

    // Get single task
    if (id) {
      const task = await getTaskById({ supabase, taskId: id });
      return { task };
    }

    // Get task activity
    if (action === "activity" && taskId) {
      const limitParam = url.searchParams.get("limit");
      const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;
      const activity = await getTaskActivity({ supabase, taskId, limit });
      return { activity };
    }

    // Get tasks for project
    if (projectId) {
      // Parse filters from query params
      const status = url.searchParams.get("status");
      const cluster = url.searchParams.get("cluster");
      const priority = url.searchParams.get("priority");
      const assignedTo = url.searchParams.get("assignedTo");
      const search = url.searchParams.get("search");
      const sortField = url.searchParams.get("sortField");
      const sortDirection = url.searchParams.get("sortDirection");
      const limitParam = url.searchParams.get("limit");
      const offsetParam = url.searchParams.get("offset");

      const options: TaskListOptions = {
        filters: {
          ...(status && { status: status.split(",") as any }),
          ...(cluster && { cluster }),
          ...(priority && { priority: Number.parseInt(priority, 10) as any }),
          ...(assignedTo && { assigned_to: assignedTo }),
          ...(search && { search }),
        },
        ...(sortField && {
          sort: {
            field: sortField as any,
            direction: (sortDirection as "asc" | "desc") || "asc",
          },
        }),
        ...(limitParam && { limit: Number.parseInt(limitParam, 10) }),
        ...(offsetParam && { offset: Number.parseInt(offsetParam, 10) }),
      };

      const tasks = await getTasks({ supabase, projectId, options });
      return { tasks };
    }

    return Response.json(
      { error: "Missing required parameters" },
      { status: 400 },
    );
  } catch (error) {
    consola.error("Error in tasks loader:", error);
    return Response.json({ error: "Failed to fetch tasks" }, { status: 500 });
  }
}

// ============================================================================
// Action - Handle POST requests
// ============================================================================

export async function action({ request }: ActionFunctionArgs) {
  const { client: supabase, user } = getServerClient(request);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const action = formData.get("_action") as string;

    switch (action) {
      case "create": {
        const accountId = formData.get("accountId") as string;
        const projectId = formData.get("projectId") as string;
        const dataJson = formData.get("data") as string;

        if (!accountId || !projectId || !dataJson) {
          return Response.json(
            { error: "Missing required parameters" },
            { status: 400 },
          );
        }

        const data: TaskInsert = JSON.parse(dataJson);
        const task = await createTask({
          supabase,
          accountId,
          projectId,
          userId: user.id,
          data,
        });

        // Track task_created event for PLG instrumentation
        try {
          const posthogServer = getPostHogServerClient();
          if (posthogServer && task) {
            posthogServer.capture({
              distinctId: user.id,
              event: "task_created",
              properties: {
                task_id: task.id,
                project_id: projectId,
                account_id: accountId,
                priority: data.priority,
                source: data.source_insight_id ? "insight" : "manual",
                source_insight_id: data.source_insight_id || null,
                $groups: { account: accountId },
              },
            });
          }
        } catch (trackingError) {
          consola.warn(
            "[TASK_CREATED] PostHog tracking failed:",
            trackingError,
          );
        }

        return { task };
      }

      case "update": {
        const taskId = formData.get("taskId") as string;
        const updatesJson = formData.get("updates") as string;

        if (!taskId || !updatesJson) {
          return Response.json(
            { error: "Missing required parameters" },
            { status: 400 },
          );
        }

        const updates: TaskUpdate = JSON.parse(updatesJson);
        const task = await updateTask({
          supabase,
          taskId,
          userId: user.id,
          updates,
        });

        // Track task_completed event when status changes to "done"
        if (updates.status === "done" && task) {
          try {
            const posthogServer = getPostHogServerClient();
            if (posthogServer) {
              posthogServer.capture({
                distinctId: user.id,
                event: "task_completed",
                properties: {
                  task_id: taskId,
                  project_id: task.project_id,
                  account_id: task.account_id,
                  priority: task.priority,
                  $groups: { account: task.account_id },
                },
              });
            }
          } catch (trackingError) {
            consola.warn(
              "[TASK_COMPLETED] PostHog tracking failed:",
              trackingError,
            );
          }
        }

        return { task };
      }

      case "delete": {
        const taskId = formData.get("taskId") as string;

        if (!taskId) {
          return Response.json({ error: "Missing taskId" }, { status: 400 });
        }

        const task = await deleteTask({
          supabase,
          taskId,
          userId: user.id,
        });

        return { task };
      }

      case "bulk-update": {
        const taskIdsJson = formData.get("taskIds") as string;
        const updatesJson = formData.get("updates") as string;

        if (!taskIdsJson || !updatesJson) {
          return Response.json(
            { error: "Missing required parameters" },
            { status: 400 },
          );
        }

        const taskIds: string[] = JSON.parse(taskIdsJson);
        const updates: TaskUpdate = JSON.parse(updatesJson);

        const tasks = await bulkUpdateTasks({
          supabase,
          taskIds,
          userId: user.id,
          updates,
        });

        return { tasks };
      }

      default:
        return Response.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    consola.error("Error in tasks action:", error);
    return Response.json(
      { error: "Failed to process request" },
      { status: 500 },
    );
  }
}
