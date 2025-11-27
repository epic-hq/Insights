import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { updateOpportunity } from "~/features/opportunities/db"
import { loadOpportunityStages } from "~/features/opportunities/server/stage-settings.server"
import { ensureStageValue } from "~/features/opportunities/stage-config"
import { getServerClient } from "~/lib/supabase/client.server"

export async function action({ request }: ActionFunctionArgs) {
	const formData = await request.formData()
	const opportunityId = formData.get("opportunityId")?.toString()
	const accountId = formData.get("accountId")?.toString()
	const projectId = formData.get("projectId")?.toString()
	const field = formData.get("field")?.toString()
	const value = formData.get("value")?.toString() ?? ""

	if (!opportunityId || !accountId || !projectId || !field) {
		return Response.json({ ok: false, error: "Missing required parameters" }, { status: 400 })
	}

	const { client: supabase } = getServerClient(request)

	// Get current opportunity to access metadata
	const { data: currentOpp, error: fetchError } = await supabase
		.from("opportunities")
		.select("metadata")
		.eq("id", opportunityId)
		.eq("account_id", accountId)
		.eq("project_id", projectId)
		.single()

	if (fetchError || !currentOpp) {
		consola.error("Failed to fetch opportunity", fetchError)
		return Response.json({ ok: false, error: "Failed to fetch opportunity" }, { status: 500 })
	}

	const currentMetadata = (currentOpp.metadata as Record<string, unknown>) || {}

	// Store notes and product_description in metadata; description is a direct field
	const updateData: Record<string, unknown> = {}
	if (field === "notes" || field === "product_description") {
		updateData.metadata = {
			...currentMetadata,
			[field]: value,
		}
	} else if (field === "description") {
		updateData.description = value
	} else if (field === "amount") {
		updateData.amount = value ? Number(value) : null
	} else if (field === "close_date") {
		updateData.close_date = value || null
	} else if (field === "title") {
		updateData.title = value
	} else if (field === "stage" || field === "kanban_status") {
		// For stage updates, we need to update both stage and kanban_status
		const { stages } = await loadOpportunityStages({ supabase, accountId })
		const normalizedStage = ensureStageValue(value, stages)
		updateData.stage = normalizedStage
		updateData.kanban_status = normalizedStage
	} else {
		return Response.json({ ok: false, error: "Unsupported field" }, { status: 400 })
	}

	const { error: updateError } = await updateOpportunity({
		supabase,
		id: opportunityId,
		accountId,
		projectId,
		data: updateData,
	})

	if (updateError) {
		consola.error("Failed to update opportunity", updateError)
		return Response.json({ ok: false, error: "Failed to update opportunity" }, { status: 500 })
	}

	return Response.json({ ok: true, opportunityId, field, value })
}
