import consola from "consola";
import type { ActionFunctionArgs } from "react-router";
import { getServerClient } from "~/lib/supabase/client.server";

export async function action({ request }: ActionFunctionArgs) {
	const formData = await request.formData();
	const slotId = formData.get("slotId")?.toString();
	const field = formData.get("field")?.toString();
	const value = formData.get("value")?.toString() ?? "";

	if (!slotId || !field) {
		return Response.json({ ok: false, error: "Missing required parameters" }, { status: 400 });
	}

	if (field !== "summary" && field !== "text_value") {
		return Response.json({ ok: false, error: "Unsupported field" }, { status: 400 });
	}

	const { client: supabase } = getServerClient(request);

	const updateData: Record<string, string> = {};
	updateData[field] = value;

	const { error: updateError } = await supabase.from("sales_lens_slots").update(updateData).eq("id", slotId);

	if (updateError) {
		consola.error("Failed to update slot", updateError);
		return Response.json({ ok: false, error: "Failed to update slot" }, { status: 500 });
	}

	return Response.json({ ok: true, slotId, field, value });
}
