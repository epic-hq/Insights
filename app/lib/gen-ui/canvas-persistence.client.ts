/**
 * Canvas Persistence (client-side)
 *
 * Hybrid save layer: persists canvas edits to DB via Supabase browser client,
 * while onAction still fires to notify the agent.
 */

import consola from "consola"
import { createClient } from "~/lib/supabase/client"
import type { A2UIAction } from "~/components/gen-ui/A2UIRenderer"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isUUID(id: string): boolean {
	return UUID_RE.test(id)
}

/**
 * Persist a canvas action to the database.
 * Returns { saved, error? } — callers should still fire onAction to the agent regardless.
 */
export async function persistCanvasAction(
	action: A2UIAction,
	projectId: string,
): Promise<{ saved: boolean; error?: string }> {
	try {
		switch (action.componentType) {
			case "InterviewPrompts":
				return persistInterviewPromptsAction(action, projectId)
			default:
				return { saved: false, error: `No persistence handler for ${action.componentType}` }
		}
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err)
		consola.error("[canvas-persistence] Unexpected error", msg)
		return { saved: false, error: msg }
	}
}

// ---------------------------------------------------------------------------
// InterviewPrompts
// ---------------------------------------------------------------------------

async function persistInterviewPromptsAction(
	action: A2UIAction,
	projectId: string,
): Promise<{ saved: boolean; error?: string }> {
	const supabase = createClient()
	const { actionName, payload } = action

	switch (actionName) {
		case "reorder": {
			const newOrder = payload?.newOrder as string[] | undefined
			if (!newOrder?.length) return { saved: false, error: "No order data" }

			const dbIds = newOrder.filter(isUUID)
			if (dbIds.length === 0) return { saved: false, error: "No DB prompts to reorder" }

			const results = await Promise.all(
				dbIds.map((id, idx) =>
					supabase
						.from("interview_prompts")
						.update({ order_index: idx, updated_at: new Date().toISOString() })
						.eq("id", id)
						.eq("project_id", projectId),
				),
			)

			const errors = results.filter((r) => r.error)
			if (errors.length > 0) {
				consola.error("[canvas-persistence] reorder errors", errors.map((e) => e.error))
				return { saved: false, error: `${errors.length} reorder updates failed` }
			}
			consola.info("[canvas-persistence] reorder saved", { count: dbIds.length })
			return { saved: true }
		}

		case "editQuestion": {
			const promptId = payload?.promptId as string | undefined
			const promptText = payload?.promptText as string | undefined
			if (!promptId || !isUUID(promptId)) return { saved: false, error: "Non-DB prompt, skipping" }
			if (!promptText) return { saved: false, error: "No text to save" }

			const { error } = await supabase
				.from("interview_prompts")
				.update({ text: promptText, updated_at: new Date().toISOString() })
				.eq("id", promptId)
				.eq("project_id", projectId)

			if (error) {
				consola.error("[canvas-persistence] editQuestion error", error)
				return { saved: false, error: error.message }
			}
			return { saved: true }
		}

		case "deleteQuestion": {
			const promptId = payload?.promptId as string | undefined
			if (!promptId || !isUUID(promptId)) return { saved: false, error: "Non-DB prompt, skipping" }

			const { error } = await supabase
				.from("interview_prompts")
				.delete()
				.eq("id", promptId)
				.eq("project_id", projectId)

			if (error) {
				consola.error("[canvas-persistence] deleteQuestion error", error)
				return { saved: false, error: error.message }
			}
			return { saved: true }
		}

		case "addQuestion": {
			const promptText = payload?.promptText as string | undefined
			if (!promptText) return { saved: false, error: "No text" }

			const promptCount = (payload?.promptCount as number) ?? 0
			const { error } = await supabase.from("interview_prompts").insert({
				project_id: projectId,
				text: promptText,
				status: "proposed",
				source: "canvas",
				order_index: promptCount,
				is_must_have: false,
			})

			if (error) {
				consola.error("[canvas-persistence] addQuestion error", error)
				return { saved: false, error: error.message }
			}
			return { saved: true }
		}

		case "toggleMustHave": {
			const promptId = payload?.promptId as string | undefined
			if (!promptId || !isUUID(promptId)) return { saved: false, error: "Non-DB prompt, skipping" }

			// We don't have the new value in payload, so fetch current and toggle
			const { data: current, error: fetchErr } = await supabase
				.from("interview_prompts")
				.select("is_must_have")
				.eq("id", promptId)
				.single()

			if (fetchErr || !current) return { saved: false, error: fetchErr?.message ?? "Not found" }

			const { error } = await supabase
				.from("interview_prompts")
				.update({
					is_must_have: !current.is_must_have,
					updated_at: new Date().toISOString(),
				})
				.eq("id", promptId)
				.eq("project_id", projectId)

			if (error) {
				consola.error("[canvas-persistence] toggleMustHave error", error)
				return { saved: false, error: error.message }
			}
			return { saved: true }
		}

		case "markDone":
		case "unmarkDone":
		case "skip":
		case "unhide": {
			const promptId = payload?.promptId as string | undefined
			if (!promptId || !isUUID(promptId)) return { saved: false, error: "Non-DB prompt, skipping" }

			const statusMap: Record<string, string> = {
				markDone: "answered",
				unmarkDone: "proposed",
				skip: "skipped",
				unhide: "proposed",
			}

			const { error } = await supabase
				.from("interview_prompts")
				.update({
					status: statusMap[actionName],
					updated_at: new Date().toISOString(),
				})
				.eq("id", promptId)
				.eq("project_id", projectId)

			if (error) {
				consola.error(`[canvas-persistence] ${actionName} error`, error)
				return { saved: false, error: error.message }
			}
			return { saved: true }
		}

		default:
			return { saved: false, error: `Unknown InterviewPrompts action: ${actionName}` }
	}
}
