import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { getServerClient } from "~/lib/supabase/client.server"

export async function action({ request }: ActionFunctionArgs) {
	const formData = await request.formData()
	const stakeholderId = formData.get("stakeholderId")?.toString()
	const field = formData.get("field")?.toString()
	const value = formData.get("value")?.toString() ?? ""

	if (!stakeholderId || !field) {
		return Response.json({ ok: false, error: "Missing required parameters" }, { status: 400 })
	}

	const allowedFields = ["display_name", "role", "influence", "email", "stakeholder_type"]
	if (!allowedFields.includes(field)) {
		return Response.json({ ok: false, error: "Unsupported field" }, { status: 400 })
	}

	const { client: supabase } = getServerClient(request)

	const updateData: Record<string, any> = {}

	// Handle influence field validation
	if (field === "influence") {
		if (value && !["low", "medium", "high"].includes(value)) {
			return Response.json({ ok: false, error: "Invalid influence value" }, { status: 400 })
		}
		updateData[field] = value || null
	} else if (field === "stakeholder_type") {
		// Store type as a label in the labels array
		const validTypes = ["DM", "I", "B"]
		if (value && !validTypes.includes(value)) {
			return Response.json({ ok: false, error: "Invalid stakeholder type" }, { status: 400 })
		}

		// Get current stakeholder to update labels
		const { data: currentStakeholder } = await supabase
			.from("sales_lens_stakeholders")
			.select("labels")
			.eq("id", stakeholderId)
			.single()

		const currentLabels = (currentStakeholder?.labels as string[]) || []
		// Remove any existing type labels
		const filteredLabels = currentLabels.filter((l) => !["DM", "I", "B"].includes(l))
		// Add new type if provided
		const newLabels = value ? [...filteredLabels, value] : filteredLabels
		updateData.labels = newLabels
	} else {
		updateData[field] = value || null
	}

	const { error: updateError } = await supabase
		.from("sales_lens_stakeholders")
		.update(updateData)
		.eq("id", stakeholderId)

	if (updateError) {
		consola.error("Failed to update stakeholder", updateError)
		return Response.json({ ok: false, error: "Failed to update stakeholder" }, { status: 500 })
	}

	return Response.json({ ok: true, stakeholderId, field, value })
}
