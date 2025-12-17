/**
 * Shared utilities for resolving Mastra tool context
 *
 * IMPORTANT: These utilities ensure that account_id is always resolved from the
 * project record, NOT from the session context. This prevents data from being
 * created with the wrong account_id when a user is viewing a project in one
 * account while their session is set to a different account.
 */

import consola from "consola";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";

export interface ResolvedContext {
  accountId: string;
  projectId: string;
  userId: string | null;
}

/**
 * Resolves the correct account_id, project_id, and user_id from Mastra tool context.
 *
 * CRITICAL: This function always fetches account_id from the project record,
 * NOT from the session/URL context. This prevents the bug where data gets created
 * with the wrong account_id when:
 * - User has multiple accounts
 * - User's session account differs from the project's account
 * - URL params have a different account than the project's actual account
 *
 * @param context - Mastra tool execution context
 * @param toolName - Name of the calling tool (for logging)
 * @returns Resolved context with correct accountId from project
 * @throws Error if projectId is missing or project cannot be found
 */
export async function resolveProjectContext(
  context: Map<string, unknown> | any,
  toolName: string,
): Promise<ResolvedContext> {
  const projectId = context?.requestContext?.get?.("project_id") as
    | string
    | undefined;
  const userId =
    (context?.requestContext?.get?.("user_id") as string | undefined) || null;

  if (!projectId) {
    consola.error(`[${toolName}] Missing required project_id in context`);
    throw new Error("Missing project_id in runtime context");
  }

  // IMPORTANT: Always get account_id from the project record, NOT from session context
  // The session context account_id can differ from the project's actual account
  const supabase = createSupabaseAdminClient();

  const { data: project, error } = await supabase
    .from("projects")
    .select("account_id")
    .eq("id", projectId)
    .single();

  if (error || !project?.account_id) {
    consola.error(`[${toolName}] Failed to fetch project account_id`, {
      projectId,
      error,
    });
    throw new Error(`Failed to resolve account_id for project ${projectId}`);
  }

  const accountId = project.account_id;

  // Log if session account differs from project account (helps debug issues)
  const sessionAccountId = context?.requestContext?.get?.("account_id") as
    | string
    | undefined;
  if (sessionAccountId && sessionAccountId !== accountId) {
    consola.warn(`[${toolName}] Session account differs from project account`, {
      sessionAccountId,
      projectAccountId: accountId,
      projectId,
    });
  }

  consola.debug(`[${toolName}] Resolved context`, {
    accountId,
    projectId,
    userId: userId || "(empty)",
  });

  return { accountId, projectId, userId };
}

/**
 * Resolves account_id directly from a project ID.
 * Use this in API routes to get the correct account_id before setting up requestContext.
 *
 * @param projectId - The project ID to resolve account from
 * @param routeName - Name of the calling route (for logging)
 * @param fallbackAccountId - Optional fallback if project lookup fails (NOT recommended for writes)
 * @returns accountId from project record
 */
export async function resolveAccountIdFromProject(
  projectId: string,
  routeName: string,
  fallbackAccountId?: string,
): Promise<string> {
  if (!projectId) {
    if (fallbackAccountId) {
      consola.warn(
        `[${routeName}] No projectId provided, using fallback accountId`,
      );
      return fallbackAccountId;
    }
    throw new Error(`[${routeName}] Missing projectId`);
  }

  const supabase = createSupabaseAdminClient();
  const { data: project, error } = await supabase
    .from("projects")
    .select("account_id")
    .eq("id", projectId)
    .single();

  if (error || !project?.account_id) {
    consola.error(`[${routeName}] Failed to fetch project account_id`, {
      projectId,
      error,
    });
    if (fallbackAccountId) {
      consola.warn(
        `[${routeName}] Using fallback accountId due to project lookup failure`,
      );
      return fallbackAccountId;
    }
    throw new Error(
      `[${routeName}] Failed to resolve account_id for project ${projectId}`,
    );
  }

  // Log if fallback differs from project account (helps identify mismatches)
  if (fallbackAccountId && fallbackAccountId !== project.account_id) {
    consola.warn(
      `[${routeName}] URL/session accountId differs from project's actual accountId`,
      {
        urlOrSessionAccountId: fallbackAccountId,
        projectAccountId: project.account_id,
        projectId,
      },
    );
  }

  return project.account_id;
}

/**
 * Gets account_id from context, preferring project-based resolution when project_id is available.
 * Falls back to session account_id for non-project-scoped operations.
 *
 * Use this when the operation might not have a project context (e.g., account-level operations).
 *
 * @param context - Mastra tool execution context
 * @param toolName - Name of the calling tool (for logging)
 * @returns accountId (from project if available, otherwise from session)
 * @throws Error if no account_id can be resolved
 */
export async function resolveAccountId(
  context: Map<string, unknown> | any,
  toolName: string,
): Promise<string> {
  const projectId = context?.requestContext?.get?.("project_id") as
    | string
    | undefined;

  // If we have a project_id, resolve account from project
  if (projectId) {
    const { accountId } = await resolveProjectContext(context, toolName);
    return accountId;
  }

  // Fallback to session account_id for non-project operations
  const sessionAccountId = context?.requestContext?.get?.("account_id") as
    | string
    | undefined;

  if (!sessionAccountId) {
    consola.error(
      `[${toolName}] No account_id available (no project_id or session account)`,
    );
    throw new Error("Missing account_id in runtime context");
  }

  consola.debug(`[${toolName}] Using session account_id (no project context)`, {
    accountId: sessionAccountId,
  });

  return sessionAccountId;
}
