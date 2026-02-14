import consola from "consola";
import type { ActionFunctionArgs } from "react-router";
import { getServerClient } from "~/lib/supabase/client.server";
import type { Json } from "~/types/supabase.types";

/**
 * API endpoint for updating an entity within a conversation lens analysis.
 *
 * Updates entities in the analysis_data.entities array:
 * - Finds the entity group by entity_type (stakeholders, next_steps, objections)
 * - Finds the specific entity by index
 * - Merges the provided updates into the entity
 */
export async function action({ request }: ActionFunctionArgs) {
	const formData = await request.formData();
	const analysisId = formData.get("analysisId")?.toString();
	const entityType = formData.get("entityType")?.toString() as "stakeholders" | "next_steps" | "objections" | undefined;
	const entityIndex = Number(formData.get("entityIndex")?.toString());
	const updatesJson = formData.get("updates")?.toString();

	consola.info("[update-lens-entity] Request:", {
		analysisId,
		entityType,
		entityIndex,
		updatesJson: updatesJson?.substring(0, 100),
	});

	if (!analysisId || !entityType || Number.isNaN(entityIndex) || !updatesJson) {
		consola.warn("[update-lens-entity] Missing params:", { analysisId, entityType, entityIndex });
		return Response.json({ ok: false, error: "Missing required parameters" }, { status: 400 });
	}

	let updates: Record<string, unknown>;
	try {
		updates = JSON.parse(updatesJson);
	} catch (e) {
		consola.error("[update-lens-entity] Invalid JSON in updates:", e);
		return Response.json({ ok: false, error: "Invalid updates JSON" }, { status: 400 });
	}

	const { client: supabase } = getServerClient(request);

	// Fetch the current analysis
	const { data: analysis, error: fetchError } = await supabase
		.from("conversation_lens_analyses")
		.select("id, analysis_data")
		.eq("id", analysisId)
		.single();

	if (fetchError || !analysis) {
		consola.error("[update-lens-entity] Failed to fetch analysis", fetchError);
		return Response.json({ ok: false, error: "Analysis not found" }, { status: 404 });
	}

	// Parse and update the analysis_data
	const analysisData = (analysis.analysis_data as Record<string, unknown>) || {};
	const entities = (analysisData.entities as Array<Record<string, unknown>>) || [];

	consola.info(
		"[update-lens-entity] Found entity types:",
		entities.map((e) => e.entity_type)
	);

	// Find the entity group by type
	const entityGroup = entities.find((e) => e.entity_type === entityType);
	if (!entityGroup) {
		consola.warn("[update-lens-entity] Entity type not found:", entityType);
		return Response.json({ ok: false, error: `Entity type ${entityType} not found` }, { status: 404 });
	}

	// Get the array key based on entity type
	const arrayKey = entityType; // stakeholders, next_steps, or objections
	const entityArray = entityGroup[arrayKey] as Array<Record<string, unknown>> | undefined;

	if (!entityArray || entityIndex < 0 || entityIndex >= entityArray.length) {
		consola.warn("[update-lens-entity] Entity index out of bounds:", { entityIndex, arrayLength: entityArray?.length });
		return Response.json({ ok: false, error: `Entity index ${entityIndex} out of bounds` }, { status: 404 });
	}

	// Merge updates into the entity
	const existingEntity = entityArray[entityIndex];
	const updatedEntity = { ...existingEntity, ...updates };
	entityArray[entityIndex] = updatedEntity;

	consola.info("[update-lens-entity] Updated entity:", {
		before: Object.keys(existingEntity),
		after: Object.keys(updatedEntity),
		updates: Object.keys(updates),
	});

	// Persist the update
	const updatedData = { ...analysisData, entities } as Json;
	const { data: updateData, error: updateError } = await supabase
		.from("conversation_lens_analyses")
		.update({ analysis_data: updatedData })
		.eq("id", analysisId)
		.select("id");

	if (updateError) {
		consola.error("[update-lens-entity] Failed to update analysis", updateError);
		return Response.json({ ok: false, error: "Failed to update entity" }, { status: 500 });
	}

	consola.info("[update-lens-entity] Update result:", updateData);
	return Response.json({ ok: true, analysisId, entityType, entityIndex, updates });
}
