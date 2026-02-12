/**
 * POST /api/desktop/interviews/:interviewId/finalize
 *
 * Called when a desktop recording ends. Handles:
 * 1. Save transcript in structured format
 * 2. Resolve/link people and assignees
 * 3. Create tasks from extracted action items
 * 4. Backfill evidence speaker-to-person links when available
 * 5. Mark interview as ready
 */
import consola from "consola";
import type { ActionFunctionArgs } from "react-router";
import { z } from "zod";
import { createTask, createTaskLink } from "~/features/tasks/db";
import { authenticateDesktopRequest } from "~/lib/auth/desktop-auth.server";
import {
  buildPersonAttributionContext,
  validateAttributionParity,
} from "~/lib/evidence/personAttribution.server";
import { resolveOrCreatePerson } from "~/lib/people/resolution.server";
import { safeSanitizeTranscriptPayload } from "~/utils/transcript/sanitizeTranscriptData.server";

const FinalizeRequestSchema = z.object({
  interview_id: z.string().uuid(),
  // Full transcript from desktop
  transcript: z
    .array(
      z.object({
        speaker: z.string(),
        text: z.string(),
        timestamp_ms: z.coerce.number().optional(),
      }),
    )
    .optional(),
  // Tasks extracted during real-time processing
  tasks: z
    .array(
      z.object({
        text: z.string(),
        assignee: z.string().optional(),
        due: z.string().optional(),
      }),
    )
    .optional(),
  // People mentioned during the meeting
  people: z
    .array(
      z.object({
        person_key: z.string(),
        person_name: z.string(),
        role: z.string().optional(),
        recall_participant_id: z.string().optional(),
        recall_platform: z.string().optional(),
        email: z.string().optional(),
        is_host: z.boolean().optional(),
      }),
    )
    .optional(),
  // Pre-resolved people map from desktop people resolution endpoint
  people_map: z
    .array(
      z.object({
        person_key: z.string(),
        person_id: z.string().uuid(),
      }),
    )
    .optional(),
  // Meeting metadata
  duration_seconds: z.number().optional(),
  platform: z.string().optional(),
  meeting_title: z.string().optional(),
});

type FinalizePerson =
  z.infer<typeof FinalizeRequestSchema>["people"] extends Array<infer T>
    ? T
    : never;

const normalizeLookup = (value: string | null | undefined) =>
  (value || "").toLowerCase().replace(/\s+/g, " ").trim();

const toRelativeMs = (value: number | undefined, fallbackMs: number) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallbackMs;
  }

  return Math.max(0, value);
};

const estimateTurnDurationMs = (text: string) => {
  const words = text.split(/\s+/).filter(Boolean).length;
  const estimated = Math.round((words / 2.7) * 1000);
  return Math.max(1200, Math.min(12000, estimated || 1200));
};

const parseDueDate = (dueText: string | undefined): string | null => {
  if (!dueText) return null;

  const now = new Date();
  const dueLower = dueText.toLowerCase();
  if (dueLower.includes("tomorrow")) {
    now.setDate(now.getDate() + 1);
    return now.toISOString().split("T")[0];
  }
  if (dueLower.includes("next week")) {
    now.setDate(now.getDate() + 7);
    return now.toISOString().split("T")[0];
  }
  if (dueLower.includes("end of week")) {
    const daysUntilFriday = (5 - now.getDay() + 7) % 7 || 7;
    now.setDate(now.getDate() + daysUntilFriday);
    return now.toISOString().split("T")[0];
  }

  const parsed = new Date(dueText);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().split("T")[0];
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

function buildTranscriptPayload(
  transcript: Array<{ speaker: string; text: string; timestamp_ms?: number }>,
  durationSeconds?: number,
) {
  const turns = transcript.filter((turn) => turn.text?.trim().length > 0);
  const fullTranscript = turns
    .map((turn) => `${turn.speaker}: ${turn.text}`)
    .join("\n");

  let cursorMs = 0;
  const speaker_transcripts = turns.map((turn, idx) => {
    const start = toRelativeMs(turn.timestamp_ms, cursorMs);

    let nextStart: number | null = null;
    for (let i = idx + 1; i < turns.length; i += 1) {
      const candidate = turns[i]?.timestamp_ms;
      if (
        typeof candidate === "number" &&
        Number.isFinite(candidate) &&
        candidate > start
      ) {
        nextStart = candidate;
        break;
      }
    }

    const end = nextStart ?? start + estimateTurnDurationMs(turn.text);
    cursorMs = Math.max(cursorMs, end);

    return {
      speaker: turn.speaker || "Unknown Speaker",
      text: turn.text,
      start,
      end,
      confidence: null,
    };
  });

  return safeSanitizeTranscriptPayload({
    full_transcript: fullTranscript,
    audio_duration:
      typeof durationSeconds === "number" ? durationSeconds : null,
    file_type: "realtime",
    speaker_transcripts,
  });
}

function resolvePersonIdForSpeakerLabel(
  speakerLabel: string,
  interviewPeople: Array<{
    person_id: string;
    transcript_key: string | null;
    display_name: string | null;
    people: { name: string | null } | null;
  }>,
): string | null {
  const normalized = normalizeLookup(speakerLabel);
  if (!normalized || normalized === "unknown speaker") {
    return null;
  }

  // 1) Direct name/display match
  const direct = interviewPeople.find((entry) => {
    const names = [
      normalizeLookup(entry.people?.name || null),
      normalizeLookup(entry.display_name),
      normalizeLookup(entry.transcript_key),
    ].filter(Boolean);
    return names.some((candidate) => candidate === normalized);
  });
  if (direct) return direct.person_id;

  // 2) Speaker aliases (e.g., "Speaker A", "A")
  const normalizedSpeakerKey = normalized.replace(/^speaker\s+/i, "").trim();
  if (normalizedSpeakerKey) {
    const byTranscriptKey = interviewPeople.find((entry) => {
      const transcriptKey = normalizeLookup(entry.transcript_key);
      return (
        transcriptKey === normalizedSpeakerKey ||
        transcriptKey === `speaker ${normalizedSpeakerKey}` ||
        `speaker ${transcriptKey}` === normalized
      );
    });
    if (byTranscriptKey) return byTranscriptKey.person_id;
  }

  return null;
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const auth = await authenticateDesktopRequest(request);
  if (!auth) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { supabase, user } = auth;

  try {
    const body = await request.json();
    const parsed = FinalizeRequestSchema.safeParse(body);

    if (!parsed.success) {
      consola.warn(
        "[desktop-finalize] Invalid request body:",
        parsed.error.issues,
      );
      return Response.json(
        { error: "Invalid request body", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const {
      interview_id,
      transcript,
      tasks,
      people,
      people_map,
      duration_seconds,
      platform,
    } = parsed.data;

    consola.info(`[desktop-finalize] Finalizing interview ${interview_id}`);

    const { data: interview, error: interviewError } = await supabase
      .from("interviews")
      .select(
        "id, account_id, project_id, title, processing_metadata, duration_sec, meeting_platform, created_by",
      )
      .eq("id", interview_id)
      .single();

    if (interviewError || !interview) {
      consola.error(
        "[desktop-finalize] Interview not found:",
        interview_id,
        interviewError,
      );
      return Response.json({ error: "Interview not found" }, { status: 404 });
    }

    const { account_id, project_id } = interview;

    const results: {
      transcript_saved: boolean;
      tasks_created: number;
      people_resolved: number;
      status_updated: boolean;
      evidence_people_linked: number;
    } = {
      transcript_saved: false,
      tasks_created: 0,
      people_resolved: 0,
      status_updated: false,
      evidence_people_linked: 0,
    };

    // 1. Save transcript in sanitized AssemblyAI-like shape
    if (transcript && transcript.length > 0) {
      const transcriptPayload = buildTranscriptPayload(
        transcript,
        duration_seconds ?? interview.duration_sec ?? undefined,
      );
      const fullTranscript = transcriptPayload.full_transcript || "";

      const { error: transcriptError } = await supabase
        .from("interviews")
        .update({
          transcript: fullTranscript,
          transcript_formatted: transcriptPayload as unknown as Record<
            string,
            unknown
          >,
          duration_sec: duration_seconds || interview.duration_sec || null,
          meeting_platform: platform || interview.meeting_platform || null,
          created_by: user?.id || interview.created_by || null,
          processing_metadata: {
            ...((interview.processing_metadata as object) || {}),
            finalized_at: new Date().toISOString(),
            transcript_turns: transcript.length,
            duration_seconds,
          },
        })
        .eq("id", interview_id);

      if (transcriptError) {
        consola.error(
          "[desktop-finalize] Failed to save transcript:",
          transcriptError.message,
        );
      } else {
        results.transcript_saved = true;
        consola.info(
          `[desktop-finalize] Saved transcript with ${transcript.length} turns`,
        );
      }
    }

    // 2. Resolve/link people (prefer desktop-provided people_map, fallback to shared resolver)
    const resolvedPeopleMap = new Map<string, string>();
    for (const item of people_map || []) {
      resolvedPeopleMap.set(item.person_key, item.person_id);
    }

    if (people?.length) {
      for (const person of people) {
        if (!person.person_key || resolvedPeopleMap.has(person.person_key)) {
          continue;
        }

        try {
          const resolution = await resolveOrCreatePerson(
            supabase,
            account_id,
            project_id,
            {
              name: person.person_name,
              primary_email: person.email || undefined,
              role:
                person.role || (person.is_host ? "interviewer" : "participant"),
              platform: person.recall_platform || undefined,
              platform_user_id: person.recall_participant_id || undefined,
              person_type:
                person.role === "interviewer" || person.is_host
                  ? "internal"
                  : null,
              source: "desktop_meeting",
            },
          );

          resolvedPeopleMap.set(person.person_key, resolution.person.id);
        } catch (error: unknown) {
          consola.warn("[desktop-finalize] Failed to resolve person", {
            interviewId: interview_id,
            personKey: person.person_key,
            error: getErrorMessage(error),
          });
        }
      }
    }

    results.people_resolved = resolvedPeopleMap.size;

    // 2b. Upsert interview_people links
    if (resolvedPeopleMap.size > 0) {
      const peopleByKey = new Map<string, FinalizePerson>();
      for (const person of people || []) {
        peopleByKey.set(person.person_key, person);
      }

      const interviewPeopleRows = Array.from(resolvedPeopleMap.entries()).map(
        ([personKey, personId]) => {
          const source = peopleByKey.get(personKey);
          return {
            interview_id,
            person_id: personId,
            project_id,
            role:
              source?.role ||
              (source?.is_host ? "interviewer" : "participant") ||
              null,
            display_name: source?.person_name || null,
            transcript_key: source?.person_key || personKey,
          };
        },
      );

      if (interviewPeopleRows.length > 0) {
        const { error: interviewPeopleError } = await supabase
          .from("interview_people")
          .upsert(interviewPeopleRows, {
            onConflict: "interview_id,person_id",
          });

        if (interviewPeopleError) {
          consola.warn(
            "[desktop-finalize] Failed to upsert interview_people:",
            interviewPeopleError.message,
          );
        }
      }
    }

    // 3. Create tasks from extracted action items
    if (tasks?.length) {
      const peopleByKey = new Map<string, FinalizePerson>();
      for (const person of people || []) {
        peopleByKey.set(person.person_key, person);
      }

      for (const task of tasks) {
        try {
          let assigneeId: string | null = null;
          const assigneeLookup = normalizeLookup(task.assignee);
          if (assigneeLookup) {
            for (const [personKey, personId] of resolvedPeopleMap.entries()) {
              const sourcePerson = peopleByKey.get(personKey);
              const candidates = [
                normalizeLookup(sourcePerson?.person_name),
                normalizeLookup(sourcePerson?.email),
                normalizeLookup(sourcePerson?.person_key),
                normalizeLookup(personKey),
              ];
              if (
                candidates.some((candidate) =>
                  candidate?.includes(assigneeLookup),
                )
              ) {
                assigneeId = personId;
                break;
              }
            }
          }

          const dueDate = parseDueDate(task.due);

          const createdTask = await createTask({
            supabase,
            accountId: account_id,
            projectId: project_id,
            userId: user?.id || null,
            data: {
              title: task.text,
              description: `Action item from meeting: ${interview.title || "Desktop Recording"}`,
              status: "backlog",
              priority: 3,
              due_date: dueDate,
              assigned_to: assigneeId
                ? [
                    {
                      user_id: assigneeId,
                      assigned_at: new Date().toISOString(),
                    },
                  ]
                : [],
              tags: ["from-meeting"],
            },
          });

          await createTaskLink({
            supabase,
            userId: user?.id || "system",
            data: {
              task_id: createdTask.id,
              entity_type: "interview",
              entity_id: interview_id,
              link_type: "source",
              description: "Created from desktop meeting",
            },
          });

          results.tasks_created += 1;
        } catch (taskError: unknown) {
          consola.error(
            "[desktop-finalize] Failed to create task:",
            getErrorMessage(taskError),
          );
        }
      }
    }

    // 4. Backfill evidence_people links from speaker labels stored in anchors
    if (resolvedPeopleMap.size > 0) {
      try {
        const { data: interviewPeople, error: interviewPeopleError } =
          await supabase
            .from("interview_people")
            .select("person_id, transcript_key, display_name, people(name)")
            .eq("interview_id", interview_id);

        if (interviewPeopleError) {
          consola.warn(
            "[desktop-finalize] Could not fetch interview_people for evidence linking:",
            interviewPeopleError.message,
          );
        } else if (interviewPeople?.length) {
          const typedInterviewPeople = interviewPeople as Array<{
            person_id: string;
            transcript_key: string | null;
            display_name: string | null;
            people: { name: string | null } | null;
          }>;
          const { data: evidenceRows, error: evidenceError } = await supabase
            .from("evidence")
            .select("id, anchors")
            .eq("interview_id", interview_id);

          if (evidenceError) {
            consola.warn(
              "[desktop-finalize] Could not fetch evidence for linking:",
              evidenceError.message,
            );
          } else {
            const evidencePeopleRows: Array<{
              account_id: string;
              project_id: string | null;
              evidence_id: string;
              person_id: string;
              role: string | null;
              confidence: number;
            }> = [];
            const evidenceIdsByPersonId = new Map<string, string[]>();

            for (const row of evidenceRows || []) {
              const anchors = Array.isArray(row.anchors) ? row.anchors : [];
              const speakerLabel = anchors
                .map((anchor) => {
                  if (!anchor || typeof anchor !== "object") return "";
                  const record = anchor as Record<string, unknown>;
                  return (
                    (typeof record.speaker === "string" && record.speaker) ||
                    (typeof record.speaker_label === "string" &&
                      record.speaker_label) ||
                    ""
                  );
                })
                .find(Boolean);

              if (!speakerLabel) continue;

              const personId = resolvePersonIdForSpeakerLabel(
                speakerLabel,
                typedInterviewPeople,
              );
              if (!personId) continue;

              evidencePeopleRows.push({
                account_id,
                project_id,
                evidence_id: row.id,
                person_id: personId,
                role: "speaker",
                confidence: 0.9,
              });
              const evidenceIds = evidenceIdsByPersonId.get(personId) ?? [];
              evidenceIds.push(row.id);
              evidenceIdsByPersonId.set(personId, evidenceIds);
            }

            if (evidencePeopleRows.length > 0) {
              const { error: evidencePeopleError } = await supabase
                .from("evidence_people")
                .upsert(evidencePeopleRows, {
                  onConflict: "evidence_id,person_id,account_id",
                });

              if (evidencePeopleError) {
                consola.warn(
                  "[desktop-finalize] Failed to upsert evidence_people:",
                  evidencePeopleError.message,
                );
              } else {
                results.evidence_people_linked = evidencePeopleRows.length;

                // Keep evidence_facet.person_id aligned with evidence_people linkage.
                for (const [
                  personId,
                  evidenceIds,
                ] of evidenceIdsByPersonId.entries()) {
                  const uniqueEvidenceIds = Array.from(new Set(evidenceIds));
                  const { error: facetPersonError } = await supabase
                    .from("evidence_facet")
                    .update({ person_id: personId })
                    .in("evidence_id", uniqueEvidenceIds)
                    .is("person_id", null);

                  if (facetPersonError) {
                    consola.warn(
                      `[desktop-finalize] Failed to backfill evidence_facet.person_id for person ${personId}: ${facetPersonError.message}`,
                    );
                  }
                }
              }
            }
          }
        }
      } catch (linkError: unknown) {
        consola.warn(
          "[desktop-finalize] Evidence speaker linking failed:",
          getErrorMessage(linkError),
        );
      }
    }

    // 5. Mark interview finalized with a valid terminal status
    const { data: freshInterview } = await supabase
      .from("interviews")
      .select("processing_metadata")
      .eq("id", interview_id)
      .single();

    const statusUpdate: Record<string, unknown> = {
      status: "ready",
      duration_sec: duration_seconds || interview.duration_sec || null,
      meeting_platform: platform || interview.meeting_platform || null,
      created_by: user?.id || interview.created_by || null,
      processing_metadata: {
        ...((freshInterview?.processing_metadata as object) ||
          (interview.processing_metadata as object) ||
          {}),
        finalized_at: new Date().toISOString(),
        tasks_created: results.tasks_created,
        people_resolved: results.people_resolved,
        realtime_active: false,
      },
    };

    const { error: statusError } = await supabase
      .from("interviews")
      .update(statusUpdate)
      .eq("id", interview_id);

    if (statusError) {
      consola.error(
        "[desktop-finalize] Status update failed:",
        statusError.message,
      );
    } else {
      results.status_updated = true;
    }

    // 6. Validate person attribution parity (TrustCore check)
    try {
      const parityResult = await validateAttributionParity(
        supabase,
        interview_id,
        "desktop-finalize",
      );
      if (!parityResult.passed) {
        consola.warn(
          `[TrustCore] Person attribution parity check failed after finalize`,
          { interviewId: interview_id, mismatches: parityResult.mismatches },
        );
      }
    } catch (parityError: unknown) {
      consola.error(
        "[desktop-finalize] Parity validation failed:",
        getErrorMessage(parityError),
      );
    }

    consola.info(
      `[desktop-finalize] Finalization complete for ${interview_id}`,
      results,
    );
    return Response.json({
      success: true,
      interview_id,
      results,
    });
  } catch (error: unknown) {
    consola.error("[desktop-finalize] Error:", error);
    return Response.json(
      { error: getErrorMessage(error) || "Finalization failed" },
      { status: 500 },
    );
  }
}
