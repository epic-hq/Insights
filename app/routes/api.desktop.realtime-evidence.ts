/**
 * POST /api/desktop/realtime-evidence
 *
 * Authenticated endpoint for Desktop app to extract evidence from transcript batches
 * during live meetings. Called incrementally (every 2-4 turns) to provide near real-time
 * insights while the meeting is ongoing.
 *
 * This is the key integration point that enables real-time evidence extraction
 * instead of waiting for the post-meeting upload/webhook pipeline.
 */
import { b } from "baml_client";
import consola from "consola";
import type { ActionFunctionArgs } from "react-router";
import { authenticateDesktopRequest } from "~/lib/auth/desktop-auth.server";
import { DEFAULT_FACET_KINDS } from "~/features/realtime-transcription/shared/facetKinds";

interface RealtimeEvidenceRequest {
  utterances: Array<{
    speaker: string;
    text: string;
    start?: number | null;
    end?: number | null;
  }>;
  language?: string;
  /** Session ID for tracking/debugging */
  sessionId?: string;
  /** Batch index for ordering */
  batchIndex?: number;
  /** Project ID for context (optional) */
  projectId?: string;
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  // Authenticate the request
  const auth = await authenticateDesktopRequest(request);
  if (!auth) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { user } = auth;

  try {
    const body = (await request.json()) as RealtimeEvidenceRequest;
    const { utterances, language, sessionId, batchIndex, projectId } = body;

    if (!utterances?.length) {
      return Response.json(
        { error: "No utterances provided" },
        { status: 400 },
      );
    }

    consola.info(
      `[desktop-realtime-evidence] User ${user.id} extracting from ${utterances.length} utterances`,
      {
        sessionId,
        batchIndex,
        projectId,
      },
    );

    // Call BAML for evidence extraction
    // Using the same function as the browser prototype, but authenticated
    const result = await b.ExtractEvidenceFromTranscriptV2(
      utterances.map((u) => ({
        speaker: u.speaker,
        text: u.text,
        start: u.start ?? null,
        end: u.end ?? null,
      })),
      [], // no chapters for realtime
      language || "en",
      { kinds: DEFAULT_FACET_KINDS, facets: [], version: "desktop-realtime" },
    );

    const evidenceCount = result.evidence?.length || 0;
    const peopleCount = result.people?.length || 0;

    consola.info(
      `[desktop-realtime-evidence] Extracted ${evidenceCount} evidence, ${peopleCount} people`,
      {
        sessionId,
        batchIndex,
      },
    );

    return Response.json({
      evidence: result.evidence || [],
      people: result.people || [],
      scenes: result.scenes || [],
      interactionContext: result.interaction_context,
      contextConfidence: result.context_confidence,
      contextReasoning: result.context_reasoning,
      batchIndex,
    });
  } catch (error: any) {
    consola.error("[desktop-realtime-evidence] Extraction failed:", error);
    return Response.json(
      { error: error?.message || "Evidence extraction failed" },
      { status: 500 },
    );
  }
}
