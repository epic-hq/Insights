import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { getServerClient } from "~/lib/supabase/server"

/**
 * Intent-based API endpoint for question operations
 * POST /api/questions/:questionId - Form-based intents
 * PATCH /api/questions/:questionId - JSON-based updates
 * 
 * POST Supported intents (via formData.intent):
 * - "delete" - Set status to 'deleted'
 * - "reject" - Set status to 'rejected' 
 * - "backup" - Set status to 'backup'
 * - "select" - Set status to 'selected'
 * - "toggle-must-have" - Toggle is_must_have boolean
 * - "update-order" - Update order_index (requires 'order' field)
 * - "update-category" - Update category (requires 'category' field)
 * 
 * PATCH Supported fields (via JSON body):
 * - text - Update question text
 * - rationale - Update question rationale
 * - table - Specify table: "decision_questions", "research_questions", "interview_prompts"
 */
export async function action({ params, request }: ActionFunctionArgs) {
	const { client: supabase } = getServerClient(request)
	const { questionId } = params

	if (!questionId) {
		return { error: "Question ID is required", status: 400 }
	}

	try {
		// Handle PATCH requests for direct text/rationale updates
		if (request.method === "PATCH") {
			const body = await request.json()
			const { text, rationale, table } = body

			if (!table || !["decision_questions", "research_questions", "interview_prompts"].includes(table)) {
				return { error: "Valid table name required: decision_questions, research_questions, or interview_prompts", status: 400 }
			}

			const updateData: Record<string, unknown> = {
				updated_at: new Date().toISOString()
			}

			if (text !== undefined) updateData.text = text
			if (rationale !== undefined) updateData.rationale = rationale

			consola.info(`PATCH Update ${table}:`, { id: questionId, updateData })

			const { data, error } = await supabase
				.from(table)
				.update(updateData)
				.eq("id", questionId)
				.select("id, text, rationale")
				.single()

			if (error) {
				consola.error("Failed to update:", error)
				return { error: "Failed to update", details: error.message, status: 500 }
			}

			consola.info("Updated successfully:", data)
			return { success: true, data, message: `${table.replace('_', ' ')} updated successfully` }
		}

		// Handle POST requests with form data (existing logic)
		const formData = await request.formData()
		const intent = formData.get("intent") as string

		if (!intent) {
			return { error: "Intent is required", status: 400 }
		}

		consola.info(`Question Action: ${intent} for ${questionId}`)

		// Fast-path: handle delete idempotently without prefetch
		if (intent === "delete") {
			consola.info("🗑️ Soft delete prompt (idempotent)", { id: questionId })
			const { data: del, error: delErr } = await supabase
				.from("interview_prompts")
				.update({ status: "deleted", is_selected: false, is_must_have: false, updated_at: new Date().toISOString() })
				.eq("id", questionId)
				.select("id")
				.maybeSingle()

			if (delErr) {
				// If PostgREST returns no row error, still consider it success (idempotent)
				const code = (delErr as { code?: string }).code
				if (code && code !== "PGRST116") {
					consola.error("❌ Failed to soft delete question:", delErr)
					return { error: "Failed to delete question", details: delErr.message, status: 500 }
				}
				consola.warn("⚠️ Delete idempotent: row missing; treating as success", { id: questionId })
			}

			return {
				success: true,
				question: { id: del?.id ?? questionId },
				message: getSuccessMessage(intent, {}),
				intent,
			}
		}

		// For non-delete intents, verify question exists and get current state
		const { data: existing, error: fetchError } = await supabase
			.from("interview_prompts")
			.select("id, text, status, is_must_have, category, order_index, project_id")
			.eq("id", questionId)
			.single()

		if (fetchError) {
			// If deleting and the row doesn't exist, treat as success (idempotent delete)
			// PostgREST uses code PGRST116 for zero rows when .single() is requested
			const code = (fetchError as { code?: string }).code
			if (intent === "delete" && code === "PGRST116") {
				consola.warn("⚠️ Delete requested but question not found; treating as already deleted", { questionId })
				return {
					success: true,
					question: { id: questionId },
					message: getSuccessMessage(intent, {}),
					intent,
				}
			}
			consola.error("❌ Failed to fetch question:", fetchError)
			return { error: "Question not found", status: 404 }
		}

		// Prepare update data based on intent
		interface UpdateData {
			updated_at: string
			status?: 'proposed' | 'rejected' | 'selected' | 'backup' | 'deleted'
			is_selected?: boolean
			is_must_have?: boolean
			order_index?: number
			category?: string
		}
		const updateData: UpdateData = {
			updated_at: new Date().toISOString()
		}

		switch (intent) {
			case "delete": {
				// Soft-delete: mark as deleted but keep record for negative training
				updateData.status = 'deleted'
				updateData.is_selected = false
				updateData.is_must_have = false
				break
			}

			case "reject": {
				updateData.status = 'rejected'
				break
			}

			case "backup": {
				updateData.status = 'backup'
				break
			}

			case "select": {
				updateData.status = 'selected'
				updateData.is_selected = true
				break
			}

			case "toggle-must-have": {
				updateData.is_must_have = !existing.is_must_have
				break
			}

			case "update-order": {
				const order = formData.get("order")
				if (!order) {
					return { error: "Order value required for update-order intent", status: 400 }
				}
				updateData.order_index = Number.parseInt(order as string)
				break
			}

			case "update-category": {
				const category = formData.get("category")
				if (!category) {
					return { error: "Category value required for update-category intent", status: 400 }
				}
				updateData.category = category as string
				break
			}

			default:
				return { 
					error: `Unsupported intent: ${intent}. Supported: delete, reject, backup, select, toggle-must-have, update-order, update-category`, 
					status: 400 
				}
		}

		consola.info("Updating question:", {
			id: questionId,
			intent,
			current_status: existing.status,
			current_must_have: existing.is_must_have,
			update_data: updateData
		})

		// Perform the update
		const { data, error } = await supabase
			.from("interview_prompts")
			.update(updateData)
			.eq("id", questionId)
			.select("id, status, is_must_have, category, order_index, text")
			.single()

		if (error) {
			consola.error("Failed to update question:", error)
			return { error: "Failed to update question", details: error.message, status: 500 }
		}

		consola.info("Question updated successfully:", {
			id: data.id,
			new_status: data.status,
			new_must_have: data.is_must_have,
			text: data.text.slice(0, 50) + "..."
		})

		// Return success with updated data
		return {
			success: true,
			question: data,
			message: getSuccessMessage(intent, data),
			intent
		}

	} catch (error) {
		consola.error("Unexpected error in question operation:", error)
		return {
			error: "Internal server error",
			status: 500
		}
	}
}

export function getSuccessMessage(intent: string, data: Record<string, unknown>): string {
    const d = data as { is_must_have?: boolean; order_index?: number; category?: string }
    switch (intent) {
        case "delete":
            return "Question deleted successfully"
        case "reject":
            return "Question rejected"
        case "backup":
            return "Question moved to backup"
        case "select":
            return "Question selected for interviews"
        case "toggle-must-have":
            return d.is_must_have ? "Question marked as must-have" : "Question removed from must-have"
        case "update-order":
            return `Question order updated to ${d.order_index}`
        case "update-category":
            return `Question category updated to ${d.category}`
        default:
            return "Question updated successfully"
    }
}
