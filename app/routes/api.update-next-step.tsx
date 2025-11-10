import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { getServerClient } from "~/lib/supabase/client.server"

export async function action({ request }: ActionFunctionArgs) {
	const formData = await request.formData()
	const slotId = formData.get("slotId")?.toString()
	const field = formData.get("field")?.toString()
	const value = formData.get("value")?.toString() ?? ""

	if (!slotId || !field) {
		return Response.json({ ok: false, error: "Missing required parameters" }, { status: 400 })
	}

	const { client: supabase } = getServerClient(request)

	// Next steps are stored in sales_lens_slots
	const updateData: Record<string, any> = {}

	if (field === "description") {
		updateData.text_value = value
		updateData.description = value
	} else if (field === "dueDate") {
		updateData.date_value = value || null
	} else {
		return Response.json({ ok: false, error: "Unsupported field" }, { status: 400 })
	}

	const { error: updateError } = await supabase
		.from("sales_lens_slots")
		.update(updateData)
		.eq("id", slotId)

	if (updateError) {
		consola.error("Failed to update next step", updateError)
		return Response.json({ ok: false, error: "Failed to update next step" }, { status: 500 })
	}

	return Response.json({ ok: true, slotId, field, value })
}
