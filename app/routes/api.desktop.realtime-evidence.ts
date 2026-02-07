/**
 * POST /api/desktop/realtime-evidence
 *
 * FAST endpoint for real-time evidence extraction during live meetings.
 * Uses gpt-4o-mini directly for speed (<3 seconds) instead of BAML.
 *
 * Now also PERSISTS evidence to the database incrementally.
 * Evidence is saved with confidence='low' to indicate provisional status.
 */
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import consola from "consola";
import type { ActionFunctionArgs } from "react-router";
import { z } from "zod";
import { authenticateDesktopRequest } from "~/lib/auth/desktop-auth.server";
import { FacetResolver } from "~/lib/database/facets.server";

const EvidenceSchema = z.object({
  evidence: z.array(
    z.object({
      action: z
        .enum(["new", "update", "skip"])
        .optional()
        .describe(
          "new = genuinely new insight, update = strengthens existing evidence, skip = redundant/already captured. Defaults to new.",
        ),
      updates_gist: z
        .string()
        .optional()
        .describe(
          'When action is "update", the gist of the existing evidence being updated',
        ),
      gist: z.string().describe("≤12 word essence of the insight"),
      category: z
        .enum(["pain", "goal", "workflow", "tool", "context"])
        .describe("Type of insight"),
      speaker_label: z.string().optional().describe("Speaker name if known"),
      verbatim: z.string().optional().describe("Short supporting quote"),
    }),
  ),
  tasks: z
    .array(
      z.object({
        text: z.string().describe("Action item or task mentioned"),
        assignee: z.string().optional().describe("Who should do it"),
        due: z.string().optional().describe("When it's due if mentioned"),
      }),
    )
    .optional(),
  people: z.array(
    z.object({
      person_key: z.string(),
      person_name: z.string(),
    }),
  ),
});

interface RealtimeEvidenceRequest {
  utterances: Array<{
    speaker: string;
    text: string;
  }>;
  existingEvidence?: string[]; // Gists of already-extracted evidence for deduplication
  sessionId?: string;
  batchIndex?: number;
  interviewId?: string; // Database interview ID for persistence
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const auth = await authenticateDesktopRequest(request);
  if (!auth) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { supabase } = auth;

  try {
    const body = (await request.json()) as RealtimeEvidenceRequest;
    const { utterances, existingEvidence, sessionId, batchIndex, interviewId } =
      body;

    if (!utterances?.length) {
      return Response.json(
        { error: "No utterances provided" },
        { status: 400 },
      );
    }

    const startTime = Date.now();
    consola.info(
      `[desktop-realtime-evidence] Extracting from ${utterances.length} utterances`,
      { sessionId, batchIndex, interviewId },
    );

    const transcript = utterances
      .map((u) => `${u.speaker}: ${u.text}`)
      .join("\n");

    // Build existing evidence context for deduplication
    const existingContext = existingEvidence?.length
      ? `\nALREADY EXTRACTED (do NOT re-extract these):
${existingEvidence.map((g, i) => `${i + 1}. ${g}`).join("\n")}

For each insight, decide:
- "new": genuinely new insight NOT covered above
- "update": strengthens/clarifies an existing item (set updates_gist to the existing gist it replaces)
- "skip": redundant, small talk, or already captured

Be very selective. Most conversation is NOT evidence. Only extract truly new, substantive insights.\n`
      : "";

    const { object: result } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: EvidenceSchema,
      prompt: `Extract ONLY real, specific insights from this conversation transcript. Do NOT invent or assume anything not explicitly stated.

EVIDENCE types:
- pain: problems, frustrations, blockers the speaker explicitly mentions
- goal: desired outcomes the speaker explicitly states
- workflow: specific processes the speaker describes
- tool: specific tools/products the speaker names
- context: specific background facts the speaker shares
${existingContext}
TASKS: Only extract action items that someone explicitly commits to or assigns.

CRITICAL RULES:
- Only extract what is ACTUALLY SAID in the transcript. Never infer or generate generic business insights.
- If the transcript is just greetings, small talk, or lacks substance, return EMPTY arrays.
- Use the speaker's actual words for verbatim quotes.
- If speaker is unknown, omit speaker_label rather than using "Unknown Speaker".

Transcript:
${transcript}`,
      temperature: 0.2,
      maxTokens: 500,
    });

    const elapsed = Date.now() - startTime;
    const taskCount = result.tasks?.length || 0;
    consola.info(
      `[desktop-realtime-evidence] Extracted ${result.evidence.length} evidence, ${taskCount} tasks in ${elapsed}ms`,
      { sessionId, batchIndex },
    );

    // Normalize action field (default to "new" when not provided)
    const normalizedEvidence = result.evidence.map((e) => ({
      ...e,
      action: e.action || "new",
    }));

    // Filter out "skip" actions and transform to expected format
    const actionableEvidence = normalizedEvidence.filter(
      (e) => e.action !== "skip",
    );
    const evidence = actionableEvidence.map((e) => ({
      action: e.action,
      updates_gist: e.updates_gist,
      gist: e.gist,
      speaker_label: e.speaker_label,
      verbatim: e.verbatim,
      facet_mentions: [{ kind_slug: e.category }],
    }));

    const newCount = actionableEvidence.filter(
      (e) => e.action === "new",
    ).length;
    const updateCount = actionableEvidence.filter(
      (e) => e.action === "update",
    ).length;
    const skipCount = result.evidence.length - actionableEvidence.length;
    consola.info(
      `[desktop-realtime-evidence] Actions: ${newCount} new, ${updateCount} update, ${skipCount} skip`,
    );

    // === PERSIST EVIDENCE TO DATABASE ===
    // Only persist if interviewId is provided
    let savedEvidenceIds: string[] = [];
    if (interviewId && actionableEvidence.length > 0) {
      try {
        // Get interview details for account_id and project_id
        const { data: interview, error: interviewError } = await supabase
          .from("interviews")
          .select("account_id, project_id")
          .eq("id", interviewId)
          .single();

        if (interviewError || !interview) {
          consola.warn(
            `[desktop-realtime-evidence] Interview not found: ${interviewId}`,
          );
        } else {
          const { account_id, project_id } = interview;

          // Create facet resolver for this account
          const facetResolver = new FacetResolver(supabase, account_id);

          for (const e of actionableEvidence) {
            const verbatim = e.verbatim || e.gist;

            if (e.action === "update" && e.updates_gist) {
              // Update existing evidence record by matching gist
              const { error: updateError } = await supabase
                .from("evidence")
                .update({
                  verbatim,
                  gist: e.gist,
                  chunk: verbatim,
                })
                .eq("interview_id", interviewId)
                .eq("gist", e.updates_gist);

              if (updateError) {
                consola.warn(
                  `[desktop-realtime-evidence] Failed to update evidence: ${updateError.message}`,
                );
              }
            } else {
              // Insert new evidence
              const { data: savedEvidence, error: evidenceError } =
                await supabase
                  .from("evidence")
                  .insert({
                    account_id,
                    project_id,
                    interview_id: interviewId,
                    verbatim,
                    gist: e.gist,
                    chunk: verbatim,
                    confidence: "low",
                    source_type: "primary",
                    method: "interview",
                    modality: "qual",
                  })
                  .select("id")
                  .single();

              if (evidenceError) {
                consola.warn(
                  `[desktop-realtime-evidence] Failed to save evidence: ${evidenceError.message}`,
                );
                continue;
              }

              savedEvidenceIds.push(savedEvidence.id);

              // Insert evidence_facet for the category
              const facetAccountId = await facetResolver.ensureFacet({
                kindSlug: e.category,
                label: e.category,
              });

              if (facetAccountId) {
                const { error: facetError } = await supabase
                  .from("evidence_facet")
                  .insert({
                    evidence_id: savedEvidence.id,
                    account_id,
                    project_id,
                    kind_slug: e.category,
                    facet_account_id: facetAccountId,
                    label: e.category,
                    source: "interview",
                    confidence: 0.8,
                  });

                if (facetError) {
                  consola.warn(
                    `[desktop-realtime-evidence] Failed to save evidence_facet: ${facetError.message}`,
                  );
                }
              }
            }
          }

          consola.info(
            `[desktop-realtime-evidence] Saved ${savedEvidenceIds.length} new, updated ${updateCount} in DB`,
            { interviewId, batchIndex },
          );

          // Update interview processing_metadata to track real-time extraction
          await supabase
            .from("interviews")
            .update({
              processing_metadata: {
                realtime_active: true,
                realtime_last_batch: batchIndex,
                realtime_evidence_count: savedEvidenceIds.length,
              },
            })
            .eq("id", interviewId);
        }
      } catch (persistError: any) {
        consola.error(
          "[desktop-realtime-evidence] Persistence error:",
          persistError.message,
        );
        // Don't fail the request - evidence was extracted, just not persisted
      }
    }

    return Response.json({
      evidence,
      tasks: result.tasks || [],
      people: result.people,
      batchIndex,
      savedEvidenceIds, // Return IDs so desktop can track what's persisted
    });
  } catch (error: any) {
    consola.error("[desktop-realtime-evidence] Extraction failed:", error);
    return Response.json(
      { error: error?.message || "Evidence extraction failed" },
      { status: 500 },
    );
  }
}
