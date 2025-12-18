/**
 * API endpoint to trigger note indexing
 * POST /api/index-note
 *
 * Triggers the note.index task to extract evidence and generate embeddings
 * for semantic search from notes/documents.
 */

import { tasks } from "@trigger.dev/sdk/v3";
import consola from "consola";
import type { ActionFunctionArgs } from "react-router";
import { z } from "zod";
import {
  getAuthenticatedUser,
  getServerClient,
} from "~/lib/supabase/client.server";
import type { indexNoteTask } from "../../src/trigger/note/indexNote";

const IndexNoteSchema = z.object({
  interviewId: z.string().uuid(),
  maxEvidence: z.coerce.number().min(1).max(50).optional().default(15),
});

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  // Verify auth
  const { client: db, headers } = getServerClient(request);
  const { user: claims } = await getAuthenticatedUser(request);
  if (!claims?.sub) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers });
  }

  // Accept both JSON (fetch) and FormData (fetcher/HTML form)
  const contentType = request.headers.get("content-type") || "";
  let body: Record<string, unknown>;

  if (contentType.includes("application/json")) {
    try {
      body = await request.json();
    } catch (parseError) {
      consola.warn("[api.index-note] Invalid JSON body", parseError);
      return Response.json(
        { error: "Invalid JSON body" },
        { status: 400, headers },
      );
    }
  } else if (
    contentType.includes("multipart/form-data") ||
    contentType.includes("application/x-www-form-urlencoded")
  ) {
    const formData = await request.formData();
    body = {
      interviewId: formData.get("interviewId"),
      maxEvidence: formData.get("maxEvidence") || undefined,
    };
  } else {
    // Fallback to JSON parsing to avoid formData throwing on unsupported content types
    try {
      body = await request.json();
    } catch {
      return Response.json(
        { error: "Unsupported content type" },
        { status: 415, headers },
      );
    }
  }

  const parsed = IndexNoteSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.message },
      { status: 400, headers },
    );
  }

  const { interviewId, maxEvidence } = parsed.data;

  // Verify user has access to this interview
  const { data: interview, error } = await db
    .from("interviews")
    .select("id, account_id, source_type")
    .eq("id", interviewId)
    .single();

  if (error || !interview) {
    return Response.json(
      { error: "Interview not found" },
      { status: 404, headers },
    );
  }

  // Trigger the indexing task
  try {
    const handle = await tasks.trigger<typeof indexNoteTask>("note.index", {
      interviewId,
      maxEvidence,
    });

    return Response.json(
      {
        success: true,
        message: "Indexing started",
        runId: handle.id,
      },
      { headers },
    );
  } catch (triggerError) {
    consola.error("[api.index-note] Failed to trigger task:", triggerError);
    return Response.json(
      { error: "Failed to start indexing" },
      { status: 500, headers },
    );
  }
}
