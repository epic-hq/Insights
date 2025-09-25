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

			const updateData: Record<string, any> = {
				updated_at: new Date().toISOString()
			}

			if (text !== undefined) updateData.text = text
			if (rationale !== undefined) updateData.rationale = rationale

			consola.info(`📝 PATCH Update ${table}:`, { id: questionId, updateData })

			const { data, error } = await supabase
				.from(table)
				.update(updateData)
				.eq("id", questionId)
				.select("id, text, rationale")
				.single()

			if (error) {
				consola.error("❌ Failed to update:", error)
				return { error: "Failed to update", details: error.message, status: 500 }
			}

			consola.info("✅ Updated successfully:", data)
			return { success: true, data, message: `${table.replace('_', ' ')} updated successfully` }
		}

		// Handle POST requests with form data (existing logic)
		const formData = await request.formData()
		const intent = formData.get("intent") as string

		if (!intent) {
			return { error: "Intent is required", status: 400 }
		}

		consola.info(`🎯 Question Action: ${intent} for ${questionId}`)

		// First, verify question exists and get current state
		const { data: existing, error: fetchError } = await supabase
			.from("interview_prompts")
			.select("id, text, status, is_must_have, category, order_index, project_id")
			.eq("id", questionId)
			.single()

		if (fetchError) {
			consola.error("❌ Failed to fetch question:", fetchError)
			return { error: "Question not found", status: 404 }
		}

		// Prepare update data based on intent
		let updateData: Record<string, any> = {
			updated_at: new Date().toISOString()
		}

		switch (intent) {
			case "delete":
				updateData.status = 'deleted'
				break

			case "reject":
				updateData.status = 'rejected'
				break

			case "backup":
				updateData.status = 'backup'
				break

			case "select":
				updateData.status = 'selected'
				updateData.is_selected = true
				break

			case "toggle-must-have":
				updateData.is_must_have = !existing.is_must_have
				break

			case "update-order":
				const order = formData.get("order")
				if (!order) {
					return { error: "Order value required for update-order intent", status: 400 }
				}
				updateData.order_index = parseInt(order as string)
				break

			case "update-category":
				const category = formData.get("category")
				if (!category) {
					return { error: "Category value required for update-category intent", status: 400 }
				}
				updateData.category = category as string
				break

			default:
				return { 
					error: `Unsupported intent: ${intent}. Supported: delete, reject, backup, select, toggle-must-have, update-order, update-category`, 
					status: 400 
				}
		}

		consola.info("📝 Updating question:", {
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
			consola.error("❌ Failed to update question:", error)
			return { error: "Failed to update question", details: error.message, status: 500 }
		}

		consola.info("✅ Question updated successfully:", {
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
		consola.error("❌ Unexpected error in question operation:", error)
		return {
			error: "Internal server error",
			details: error instanceof Error ? error.message : "Unknown error",
			status: 500
		}
	}
}

function getSuccessMessage(intent: string, data: any): string {
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
			return data.is_must_have ? "Question marked as must-have" : "Question removed from must-have"
		case "update-order":
			return `Question order updated to ${data.order_index}`
		case "update-category":
			return `Question category updated to ${data.category}`
		default:
			return "Question updated successfully"
	}
}
