/**
 * POST /api/desktop/interviews/:interviewId/finalize
 *
 * Called when a desktop recording ends. Handles:
 * 1. Upload media file to R2
 * 2. Extract thumbnail from video
 * 3. Aggregate real-time transcript
 * 4. Create tasks from extracted action items
 * 5. Update interview status to complete
 */
import consola from "consola";
import type { ActionFunctionArgs } from "react-router";
import { z } from "zod";
import { authenticateDesktopRequest } from "~/lib/auth/desktop-auth.server";
import { createTask, createTaskLink } from "~/features/tasks/db";

const FinalizeRequestSchema = z.object({
  interview_id: z.string().uuid(),
  // Full transcript from desktop
  transcript: z
    .array(
      z.object({
        speaker: z.string(),
        text: z.string(),
        timestamp_ms: z.number().optional(),
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
      }),
    )
    .optional(),
  // Meeting metadata
  duration_seconds: z.number().optional(),
  platform: z.string().optional(),
  meeting_title: z.string().optional(),
});

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
      duration_seconds,
      platform,
    } = parsed.data;

    consola.info(`[desktop-finalize] Finalizing interview ${interview_id}`);

    // Get interview record
    const { data: interview, error: interviewError } = await supabase
      .from("interviews")
      .select("*, account_id, project_id")
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
    } = {
      transcript_saved: false,
      tasks_created: 0,
      people_resolved: 0,
      status_updated: false,
    };

    // 1. Save full transcript if provided
    if (transcript && transcript.length > 0) {
      const fullTranscript = transcript
        .map((t) => `${t.speaker}: ${t.text}`)
        .join("\n");

      // Build structured transcript for transcript_formatted
      const transcriptFormatted = transcript.map((t, i) => ({
        index: i,
        speaker: t.speaker,
        text: t.text,
        timestamp_ms: t.timestamp_ms || null,
      }));

      const { error: transcriptError } = await supabase
        .from("interviews")
        .update({
          transcript: fullTranscript,
          transcript_formatted: transcriptFormatted,
          duration_sec: duration_seconds || null,
          meeting_platform: platform || null,
          created_by: user?.id || null,
          processing_metadata: {
            ...((interview.processing_metadata as object) || {}),
            finalized_at: new Date().toISOString(),
            transcript_turns: transcript.length,
            duration_seconds,
          },
        })
        .eq("id", interview_id);

      if (!transcriptError) {
        results.transcript_saved = true;
        consola.info(
          `[desktop-finalize] Saved transcript with ${transcript.length} turns`,
        );
      } else {
        consola.error(
          "[desktop-finalize] Failed to save transcript:",
          transcriptError.message,
        );
      }
    }

    // 2. Resolve people mentions and find/create person records
    const peopleMap = new Map<string, string>(); // person_key -> person_id
    if (people && people.length > 0) {
      for (const person of people) {
        // Try to find existing person by name (fuzzy match)
        const { data: existingPeople } = await supabase
          .from("people")
          .select("id, name")
          .eq("account_id", account_id)
          .ilike("name", `%${person.person_name}%`)
          .limit(1);

        if (existingPeople && existingPeople.length > 0) {
          peopleMap.set(person.person_key, existingPeople[0].id);
          results.people_resolved++;
        } else {
          // Create new person record
          const { data: newPerson, error: personError } = await supabase
            .from("people")
            .insert({
              account_id,
              project_id,
              name: person.person_name,
              source: "desktop_meeting",
            })
            .select("id")
            .single();

          if (newPerson && !personError) {
            peopleMap.set(person.person_key, newPerson.id);
            results.people_resolved++;
            consola.info(
              `[desktop-finalize] Created person: ${person.person_name}`,
            );
          }
        }
      }
    }

    // 3. Create tasks from extracted action items
    if (tasks && tasks.length > 0) {
      for (const task of tasks) {
        try {
          // Try to resolve assignee
          let assigneeId: string | null = null;
          if (task.assignee) {
            const assigneeKey = task.assignee.toLowerCase().replace(/\s+/g, "");
            for (const [key, personId] of peopleMap.entries()) {
              if (key.toLowerCase().includes(assigneeKey)) {
                assigneeId = personId;
                break;
              }
            }
          }

          // Parse due date if provided
          let dueDate: string | null = null;
          if (task.due) {
            // Try to parse relative dates like "tomorrow", "next week"
            const now = new Date();
            const dueLower = task.due.toLowerCase();
            if (dueLower.includes("tomorrow")) {
              now.setDate(now.getDate() + 1);
              dueDate = now.toISOString().split("T")[0];
            } else if (dueLower.includes("next week")) {
              now.setDate(now.getDate() + 7);
              dueDate = now.toISOString().split("T")[0];
            } else if (dueLower.includes("end of week")) {
              const daysUntilFriday = (5 - now.getDay() + 7) % 7 || 7;
              now.setDate(now.getDate() + daysUntilFriday);
              dueDate = now.toISOString().split("T")[0];
            } else {
              // Try to parse as date string
              const parsed = new Date(task.due);
              if (!isNaN(parsed.getTime())) {
                dueDate = parsed.toISOString().split("T")[0];
              }
            }
          }

          // Create the task
          const createdTask = await createTask({
            supabase,
            accountId: account_id,
            projectId: project_id,
            userId: user?.id || null,
            data: {
              title: task.text,
              description: `Action item from meeting: ${interview.title || "Desktop Recording"}`,
              status: "backlog",
              priority: 3, // Medium priority
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

          // Link task to interview
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

          results.tasks_created++;
          consola.info(`[desktop-finalize] Created task: ${task.text}`);
        } catch (taskError: any) {
          consola.error(
            "[desktop-finalize] Failed to create task:",
            taskError.message,
          );
        }
      }
    }

    // 4. Update interview status to complete (also set duration/platform as fallback)
    const statusUpdate: Record<string, unknown> = {
      status: "complete",
      processing_metadata: {
        ...((interview.processing_metadata as object) || {}),
        finalized_at: new Date().toISOString(),
        tasks_created: results.tasks_created,
        people_resolved: results.people_resolved,
      },
    };
    // Set these if not already set by the transcript step
    if (duration_seconds && !interview.duration_sec) {
      statusUpdate.duration_sec = duration_seconds;
    }
    if (platform && !interview.meeting_platform) {
      statusUpdate.meeting_platform = platform;
    }
    if (user?.id && !interview.created_by) {
      statusUpdate.created_by = user.id;
    }

    const { error: statusError } = await supabase
      .from("interviews")
      .update(statusUpdate)
      .eq("id", interview_id);

    if (!statusError) {
      results.status_updated = true;
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
  } catch (error: any) {
    consola.error("[desktop-finalize] Error:", error);
    return Response.json(
      { error: error?.message || "Finalization failed" },
      { status: 500 },
    );
  }
}
