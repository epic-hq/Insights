/**
 * POST /api/desktop/realtime-evidence
 *
 * FAST endpoint for real-time evidence extraction during live meetings.
 * Uses gpt-4o-mini directly for speed (<3 seconds) instead of BAML.
 *
 * Now also PERSISTS evidence to the database incrementally.
 * Evidence is saved with confidence='low' to indicate provisional status.
 */

import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import consola from "consola";
import type { ActionFunctionArgs } from "react-router";
import { z } from "zod";
import { authenticateDesktopRequest } from "~/lib/auth/desktop-auth.server";
import { FacetResolver } from "~/lib/database/facets.server";
import { validateAttributionParity } from "~/lib/evidence/personAttribution.server";

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
    timestamp_ms?: number | null;
  }>;
  existingEvidence?: string[]; // Gists of already-extracted evidence for deduplication
  sessionId?: string;
  batchIndex?: number;
  interviewId?: string; // Database interview ID for persistence
}

const normalizeForMatch = (value: string | null | undefined) =>
  (value || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

function findBestTimestampMsForEvidence(
  utterances: RealtimeEvidenceRequest["utterances"],
  candidateText: string,
  speakerLabel?: string,
): number | null {
  if (!utterances.length) return null;

  const normalizedSpeaker = normalizeForMatch(speakerLabel);
  const speakerScoped = normalizedSpeaker
    ? utterances.filter(
        (u) => normalizeForMatch(u.speaker) === normalizedSpeaker,
      )
    : utterances;
  const pool = speakerScoped.length ? speakerScoped : utterances;

  const normalizedCandidate = normalizeForMatch(candidateText);
  if (!normalizedCandidate) {
    const firstTs = pool.find(
      (u) => typeof u.timestamp_ms === "number",
    )?.timestamp_ms;
    return typeof firstTs === "number" && Number.isFinite(firstTs)
      ? Math.max(0, firstTs)
      : null;
  }

  const exactMatch = pool.find((u) => {
    const utteranceText = normalizeForMatch(u.text);
    return (
      utteranceText.includes(normalizedCandidate) ||
      normalizedCandidate.includes(utteranceText)
    );
  });
  if (
    exactMatch &&
    typeof exactMatch.timestamp_ms === "number" &&
    Number.isFinite(exactMatch.timestamp_ms)
  ) {
    return Math.max(0, exactMatch.timestamp_ms);
  }

  const candidateWords = new Set(
    normalizedCandidate.split(" ").filter((word) => word.length > 3),
  );
  let best: { ts: number | null; overlap: number } = { ts: null, overlap: 0 };
  for (const utterance of pool) {
    const utteranceWords = normalizeForMatch(utterance.text)
      .split(" ")
      .filter((word) => word.length > 3);
    const overlap = utteranceWords.filter((word) =>
      candidateWords.has(word),
    ).length;
    if (overlap > best.overlap) {
      best = {
        ts:
          typeof utterance.timestamp_ms === "number" &&
          Number.isFinite(utterance.timestamp_ms)
            ? Math.max(0, utterance.timestamp_ms)
            : null,
        overlap,
      };
    }
  }

  return best.ts;
}

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

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
      {
        sessionId,
        batchIndex,
        interviewId,
      },
    );

    const transcript = utterances
      .map((u) => `${u.speaker}: ${u.text}`)
      .join("\n");

    // Build existing evidence context for deduplication
    const existingContext = existingEvidence?.length
      ? `\nPREVIOUSLY EXTRACTED (avoid exact duplicates):
${existingEvidence.map((g, i) => `${i + 1}. ${g}`).join("\n")}

For each insight, set action:
- "new": a new insight not already in the list above
- "update": strengthens/adds detail to an existing item (set updates_gist to the gist it updates)
- "skip": exact duplicate of something already extracted

Keep extracting new insights from the transcript — having prior evidence does NOT mean you should stop. New topics, details, or speakers always warrant new evidence.\n`
      : "";

    const { object: result } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: EvidenceSchema,
      prompt: `Extract specific insights from this conversation transcript. Stick to what was actually said — do not invent or assume.

EVIDENCE types:
- pain: problems, frustrations, blockers mentioned
- goal: desired outcomes stated
- workflow: specific processes described
- tool: specific tools/products named
- context: specific background facts shared (company, role, situation, etc.)
${existingContext}
TASKS: Extract action items someone explicitly commits to or assigns.

RULES:
- Extract what is ACTUALLY SAID. Do not generate generic business insights.
- Use the speaker's actual words for verbatim quotes.
- If speaker is unknown, omit speaker_label.
- Even short statements can contain evidence — a single sentence about a pain point or goal counts.
- Only return EMPTY arrays if the transcript is purely greetings or small talk with zero informational content.

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
    const savedEvidenceIds: string[] = [];
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
          const { data: interviewPeople } = await supabase
            .from("interview_people")
            .select("person_id, transcript_key, display_name, people(name)")
            .eq("interview_id", interviewId);

          const resolveSpeakerPersonId = (speakerLabel: string | undefined) => {
            const normalizedSpeaker = normalizeForMatch(speakerLabel);
            if (!normalizedSpeaker || normalizedSpeaker === "unknown speaker")
              return null;
            if (!interviewPeople?.length) return null;

            const directMatch = interviewPeople.find((person) => {
              const names = [
                normalizeForMatch(person.display_name),
                normalizeForMatch(person.transcript_key),
                normalizeForMatch(person.people?.name || null),
              ].filter(Boolean);
              return names.some((name) => name === normalizedSpeaker);
            });
            if (directMatch) return directMatch.person_id;

            const normalizedKey = normalizedSpeaker
              .replace(/^speaker\s+/i, "")
              .trim();
            if (!normalizedKey) return null;

            const keyMatch = interviewPeople.find((person) => {
              const transcriptKey = normalizeForMatch(person.transcript_key);
              return (
                transcriptKey === normalizedKey ||
                transcriptKey === `speaker ${normalizedKey}` ||
                `speaker ${transcriptKey}` === normalizedSpeaker
              );
            });

            return keyMatch?.person_id || null;
          };

          for (const e of actionableEvidence) {
            const verbatim = e.verbatim || e.gist;
            const anchorStartMs = findBestTimestampMsForEvidence(
              utterances,
              verbatim || e.gist,
              e.speaker_label,
            );
            const anchors =
              anchorStartMs !== null || e.speaker_label
                ? [
                    {
                      type: "transcript",
                      start_ms: anchorStartMs,
                      speaker: e.speaker_label || null,
                    },
                  ]
                : null;
            const speakerPersonId = resolveSpeakerPersonId(e.speaker_label);

            if (e.action === "update" && e.updates_gist) {
              // Update existing evidence record by matching gist
              const { data: updatedEvidenceRows, error: updateError } =
                await supabase
                  .from("evidence")
                  .update({
                    verbatim,
                    gist: e.gist,
                    chunk: verbatim,
                    anchors,
                  })
                  .eq("interview_id", interviewId)
                  .eq("gist", e.updates_gist)
                  .select("id");

              if (updateError) {
                consola.warn(
                  `[desktop-realtime-evidence] Failed to update evidence: ${updateError.message}`,
                );
              } else if (speakerPersonId && updatedEvidenceRows?.length) {
                const updatedEvidenceIds = updatedEvidenceRows.map(
                  (row) => row.id,
                );
                const evidencePeopleRows = updatedEvidenceIds.map(
                  (evidenceId) => ({
                    account_id,
                    project_id,
                    evidence_id: evidenceId,
                    person_id: speakerPersonId,
                    role: "speaker",
                    confidence: 0.9,
                  }),
                );
                const { error: evidencePeopleError } = await supabase
                  .from("evidence_people")
                  .upsert(evidencePeopleRows, {
                    onConflict: "evidence_id,person_id,account_id",
                  });
                if (evidencePeopleError) {
                  consola.warn(
                    `[desktop-realtime-evidence] Failed to backfill evidence_people for updates: ${evidencePeopleError.message}`,
                  );
                }

                const { error: facetPersonError } = await supabase
                  .from("evidence_facet")
                  .update({ person_id: speakerPersonId })
                  .in("evidence_id", updatedEvidenceIds)
                  .is("person_id", null);
                if (facetPersonError) {
                  consola.warn(
                    `[desktop-realtime-evidence] Failed to backfill evidence_facet.person_id for updates: ${facetPersonError.message}`,
                  );
                }
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
                    anchors,
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
                    person_id: speakerPersonId,
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

              if (speakerPersonId) {
                const { error: evidencePeopleError } = await supabase
                  .from("evidence_people")
                  .upsert(
                    {
                      account_id,
                      project_id,
                      evidence_id: savedEvidence.id,
                      person_id: speakerPersonId,
                      role: "speaker",
                      confidence: 0.9,
                    },
                    { onConflict: "evidence_id,person_id,account_id" },
                  );

                if (evidencePeopleError) {
                  consola.warn(
                    `[desktop-realtime-evidence] Failed to save evidence_people: ${evidencePeopleError.message}`,
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

          // TrustCore: Validate person attribution parity after persistence
          try {
            const parityResult = await validateAttributionParity(
              supabase,
              interviewId,
              "desktop-realtime",
            );
            if (!parityResult.passed) {
              consola.warn(
                "[TrustCore] Person attribution parity check failed in desktop realtime",
                {
                  interviewId,
                  batchIndex,
                  mismatches: parityResult.mismatches,
                },
              );
            }
          } catch (parityError: unknown) {
            consola.error(
              "[desktop-realtime-evidence] Parity validation failed:",
              getErrorMessage(parityError),
            );
          }
        }
      } catch (persistError: unknown) {
        consola.error(
          "[desktop-realtime-evidence] Persistence error:",
          getErrorMessage(persistError),
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
  } catch (error: unknown) {
    consola.error("[desktop-realtime-evidence] Extraction failed:", error);
    return Response.json(
      { error: getErrorMessage(error) || "Evidence extraction failed" },
      { status: 500 },
    );
  }
}
