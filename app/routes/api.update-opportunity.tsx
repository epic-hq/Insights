import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { getServerClient } from "~/lib/supabase/client.server"
import { updateOpportunity } from "~/features/opportunities/db"

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

	const currentMetadata = (currentOpp.metadata as Record<string, any>) || {}

	// Store notes and product_description in metadata
	const updateData: Record<string, any> = {}
	if (field === "notes" || field === "product_description") {
		updateData.metadata = {
			...currentMetadata,
			[field]: value,
		}
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
