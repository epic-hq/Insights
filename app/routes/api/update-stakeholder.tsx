import type { ActionFunctionArgs } from "react-router"
import { data } from "react-router"
import { supabaseServer } from "~/lib/supabase.server"
import { userContext } from "~/server/user-context"

export async function action({ request, context }: ActionFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase

	if (!supabase) {
		throw new Response("Supabase client unavailable", { status: 500 })
	}

	const formData = await request.formData()
	const stakeholderId = formData.get("stakeholderId") as string | null
	const field = formData.get("field") as string
	const value = formData.get("value") as string
	const opportunityId = formData.get("opportunityId") as string
	const accountId = formData.get("accountId") as string
	const projectId = formData.get("projectId") as string
	const personId = formData.get("personId") as string | null

	if (!accountId || !projectId || !opportunityId) {
		throw new Response("Missing required parameters", { status: 400 })
	}

	try {
		if (stakeholderId) {
			// Update existing stakeholder
			const updateData: Record<string, unknown> = {}

			if (field === "display_name") {
				updateData.display_name = value
			} else if (field === "role") {
				updateData.role = value
			} else if (field === "influence") {
				updateData.influence = value
			} else if (field === "stakeholder_type") {
				// Update labels based on type
				if (value === "DM") {
					updateData.labels = ["DM"]
				} else if (value === "I") {
					updateData.labels = ["I"]
				} else if (value === "B") {
					updateData.labels = ["B"]
				} else {
					updateData.labels = []
				}
			}

			const { error } = await supabase
				.from("stakeholders")
				.update(updateData)
				.eq("id", stakeholderId)

			if (error) {
				console.error("Error updating stakeholder:", error)
				throw new Response("Failed to update stakeholder", { status: 500 })
			}
		} else {
			// Create new stakeholder
			if (field === "create") {
				const insertData: Record<string, unknown> = {
					opportunity_id: opportunityId,
					display_name: value || "New Stakeholder",
					person_id: personId || null,
					labels: [],
					influence: "medium",
				}

				const { error } = await supabase
					.from("stakeholders")
					.insert(insertData)

				if (error) {
					console.error("Error creating stakeholder:", error)
					throw new Response("Failed to create stakeholder", { status: 500 })
				}
			} else {
				throw new Response("Invalid operation", { status: 400 })
			}
		}

		return data({ ok: true })
	} catch (error) {
		console.error("Stakeholder update error:", error)
		throw new Response("Internal server error", { status: 500 })
	}
}
