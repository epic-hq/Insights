import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { updateInsight } from "~/features/insights/db"
import { updateInterview } from "~/features/interviews/db"
import { getServerClient } from "~/lib/supabase/server"

/**
 * Generalized API endpoint for updating single fields across supported entities
 * POST /api/update-field
 *
 * Form data expected:
 * - entity: "interview" | "insight"
 * - entityId: string (ID of the entity to update)
 * - accountId: string (for RLS)
 * - projectId: string (for project scoping)
 * - fieldName: string (name of field to update)
 * - fieldValue: string (new value for the field)
 */
export async function action({ request }: ActionFunctionArgs) {
	const { client: supabase } = getServerClient(request)

	try {
		const formData = await request.formData()

		// Extract required parameters
		const entity = formData.get("entity") as string
		const entityId = formData.get("entityId") as string
		const accountId = formData.get("accountId") as string
		const projectId = formData.get("projectId") as string
		const fieldName = formData.get("fieldName") as string
		const fieldValue = formData.get("fieldValue") as string

		// Enhanced logging for debugging
		consola.info("🔧 API update-field called:", {
			entity,
			entityId,
			accountId,
			projectId,
			fieldName,
			fieldValue: fieldValue?.substring(0, 100) + (fieldValue?.length > 100 ? "..." : ""),
			fieldValueLength: fieldValue?.length,
		})

		if (!entity || !entityId || !accountId || !fieldName) {
			return { error: "Missing required parameters: entity, entityId, accountId, fieldName" }
		}

		// Check for projectId when required by entity
		if ((entity === "interview" || entity === "insight") && !projectId) {
			return { error: `projectId is required for ${entity} updates` }
		}

		// Build update data
		const updateData: Record<string, unknown> = {}

		// Handle special cases for complex field types
		if ((fieldName === "high_impact_themes" || fieldName === "relevant_answers") && fieldValue) {
			// These fields are text[] arrays in the database
			// Convert multiline text to array by splitting on newlines
			const lines = fieldValue
				.split('\n')
				.map(line => line.trim())
				.filter(line => line.length > 0)
			
			updateData[fieldName] = lines.length > 0 ? lines : null
			
			consola.info(`📝 Converted ${fieldName} to array:`, {
				originalValue: fieldValue,
				processedArray: updateData[fieldName],
				arrayLength: lines.length
			})
		} else {
			updateData[fieldName] = fieldValue || null
		}

		// Route to appropriate entity update function
		let result: { data?: unknown; error?: unknown }
		switch (entity) {
			case "interview":
				if (!projectId) {
					return { error: "projectId required for interview updates" }
				}
				result = await updateInterview({
					supabase,
					id: entityId,
					accountId,
					projectId,
					data: updateData,
				})
				break

			case "insight":
				if (!projectId) {
					return { error: "projectId required for insight updates" }
				}
				result = await updateInsight({
					supabase,
					id: entityId,
					accountId,
					projectId,
					data: updateData,
				})
				break

			default:
				return { error: `Unsupported entity type: ${entity}. Currently supports: interview, insight` }
		}

		if (result.error) {
			consola.error(`Failed to update ${entity} field:`, result.error)
			return { error: `Failed to update ${entity}` }
		}

		return { success: true, data: result.data }
	} catch (error) {
		consola.error("Error updating entity field:", error)
		return { error: "Failed to update field" }
	}
}
