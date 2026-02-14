/**
 * Canvas Persistence (client-side)
 *
 * Hybrid save layer: persists canvas edits to DB via existing API routes,
 * while onAction still fires to notify the agent.
 *
 * Uses fetch() to POST/PATCH to /api/questions/:id — the same API
 * that InterviewQuestionsManager and ResearchStructureManager use.
 */

import consola from "consola"
import type { A2UIAction } from "~/components/gen-ui/A2UIRenderer"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isUUID(id: string): boolean {
	return UUID_RE.test(id)
}

type PersistResult = { saved: boolean; error?: string }

/** POST /api/questions/:id with FormData intent */
async function postIntent(questionId: string, intent: string, extra?: Record<string, string>): Promise<PersistResult> {
	const form = new FormData()
	form.set("intent", intent)
	if (extra) {
		for (const [k, v] of Object.entries(extra)) form.set(k, v)
	}

	const res = await fetch(`/api/questions/${questionId}`, { method: "POST", body: form })
	const data = await res.json()

	if (!res.ok || data.error) {
		consola.error(`[canvas-persistence] POST ${intent} failed`, data)
		return { saved: false, error: data.error ?? `HTTP ${res.status}` }
	}
	return { saved: true }
}

/** PATCH /api/questions/:id with JSON body */
async function patchQuestion(questionId: string, body: Record<string, unknown>): Promise<PersistResult> {
	const res = await fetch(`/api/questions/${questionId}`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ ...body, table: "interview_prompts" }),
	})
	const data = await res.json()

	if (!res.ok || data.error) {
		consola.error("[canvas-persistence] PATCH failed", data)
		return { saved: false, error: data.error ?? `HTTP ${res.status}` }
	}
	return { saved: true }
}

/**
 * Persist a canvas action to the database via existing API routes.
 * Returns { saved, error? } — callers should still fire onAction to the agent regardless.
 */
export async function persistCanvasAction(
	action: A2UIAction,
	projectId: string,
): Promise<PersistResult> {
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
// InterviewPrompts — routes through /api/questions/:id
// ---------------------------------------------------------------------------

async function persistInterviewPromptsAction(
	action: A2UIAction,
	_projectId: string,
): Promise<PersistResult> {
	const { actionName, payload } = action

	switch (actionName) {
		case "reorder": {
			const newOrder = payload?.newOrder as string[] | undefined
			if (!newOrder?.length) return { saved: false, error: "No order data" }

			const dbIds = newOrder.filter(isUUID)
			if (dbIds.length === 0) return { saved: false, error: "No DB prompts to reorder" }

			const results = await Promise.all(
				dbIds.map((id, idx) => postIntent(id, "update-order", { order: String(idx) })),
			)

			const errors = results.filter((r) => !r.saved)
			if (errors.length > 0) {
				return { saved: false, error: `${errors.length}/${dbIds.length} reorder updates failed` }
			}
			consola.info("[canvas-persistence] reorder saved", { count: dbIds.length })
			return { saved: true }
		}

		case "editQuestion": {
			const promptId = payload?.promptId as string | undefined
			const promptText = payload?.promptText as string | undefined
			if (!promptId || !isUUID(promptId)) return { saved: false, error: "Non-DB prompt, skipping" }
			if (!promptText) return { saved: false, error: "No text to save" }

			return patchQuestion(promptId, { text: promptText })
		}

		case "deleteQuestion": {
			const promptId = payload?.promptId as string | undefined
			if (!promptId || !isUUID(promptId)) return { saved: false, error: "Non-DB prompt, skipping" }

			return postIntent(promptId, "delete")
		}

		case "toggleMustHave": {
			const promptId = payload?.promptId as string | undefined
			if (!promptId || !isUUID(promptId)) return { saved: false, error: "Non-DB prompt, skipping" }

			return postIntent(promptId, "toggle-must-have")
		}

		// Actions without existing API endpoints — logged but not persisted yet.
		// TODO: extend api.questions routes for addQuestion and status transitions
		case "addQuestion":
		case "markDone":
		case "unmarkDone":
		case "skip":
		case "unhide": {
			consola.warn(`[canvas-persistence] ${actionName} has no API endpoint yet, skipping persist`)
			return { saved: false, error: `No API endpoint for ${actionName} yet` }
		}

		default:
			return { saved: false, error: `Unknown InterviewPrompts action: ${actionName}` }
	}
}
