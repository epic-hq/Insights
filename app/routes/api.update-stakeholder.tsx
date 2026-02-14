import consola from "consola";
import type { ActionFunctionArgs } from "react-router";
import { getServerClient } from "~/lib/supabase/client.server";

export async function action({ request }: ActionFunctionArgs) {
	const formData = await request.formData();
	const stakeholderId = formData.get("stakeholderId")?.toString();
	const field = formData.get("field")?.toString();
	const value = formData.get("value")?.toString() ?? "";
	const opportunityId = formData.get("opportunityId")?.toString();
	const accountId = formData.get("accountId")?.toString();
	const projectId = formData.get("projectId")?.toString();
	const personId = formData.get("personId")?.toString();

	if (!field) {
		return Response.json({ ok: false, error: "Missing required parameters" }, { status: 400 });
	}

	const { client: supabase } = getServerClient(request);

	if (field === "create") {
		if (!opportunityId || !accountId || !projectId) {
			return Response.json({ ok: false, error: "Missing required parameters for create" }, { status: 400 });
		}

		const { data: newStakeholder, error: insertError } = await supabase
			.from("sales_lens_stakeholders")
			.insert({
				opportunity_id: opportunityId,
				account_id: accountId,
				project_id: projectId,
				display_name: value,
				person_id: personId || null,
			})
			.select()
			.single();

		if (insertError) {
			consola.error("Failed to create stakeholder", insertError);
			return Response.json({ ok: false, error: "Failed to create stakeholder" }, { status: 500 });
		}

		return Response.json({ ok: true, stakeholder: newStakeholder });
	}

	if (!stakeholderId) {
		return Response.json({ ok: false, error: "Missing stakeholderId for update" }, { status: 400 });
	}

	const updateData: Record<string, unknown> = {};

	// Handle influence field validation
	if (field === "influence") {
		if (value && !["low", "medium", "high"].includes(value)) {
			return Response.json({ ok: false, error: "Invalid influence value" }, { status: 400 });
		}
		updateData[field] = value || null;
	} else if (field === "stakeholder_type") {
		// Store type as a label in the labels array
		const validTypes = ["DM", "I", "B"];
		if (value && !validTypes.includes(value)) {
			return Response.json({ ok: false, error: "Invalid stakeholder type" }, { status: 400 });
		}

		// Get current stakeholder to update labels
		const { data: currentStakeholder } = await supabase
			.from("sales_lens_stakeholders")
			.select("labels")
			.eq("id", stakeholderId)
			.single();

		const currentLabels = (currentStakeholder?.labels as string[]) || [];
		// Remove any existing type labels
		const filteredLabels = currentLabels.filter((l) => !["DM", "I", "B"].includes(l));
		// Add new type if provided
		const newLabels = value ? [...filteredLabels, value] : filteredLabels;
		updateData.labels = newLabels;
	} else {
		updateData[field] = value || null;
	}

	const { error: updateError } = await supabase
		.from("sales_lens_stakeholders")
		.update(updateData)
		.eq("id", stakeholderId);

	if (updateError) {
		consola.error("Failed to update stakeholder", updateError);
		return Response.json({ ok: false, error: "Failed to update stakeholder" }, { status: 500 });
	}

	return Response.json({ ok: true, stakeholderId, field, value });
}
