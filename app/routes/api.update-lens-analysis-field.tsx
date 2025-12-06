import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { getServerClient } from "~/lib/supabase/client.server"
import type { Json } from "~/types/supabase.types"

/**
 * API endpoint for updating a field value within a conversation lens analysis.
 *
 * Updates the analysis_data JSONB structure:
 * - Finds the section by section_key
 * - Finds the field by field_key within that section
 * - Updates the field's value
 */
export async function action({ request }: ActionFunctionArgs) {
	const formData = await request.formData()
	const analysisId = formData.get("analysisId")?.toString()
	const sectionKey = formData.get("sectionKey")?.toString()
	const fieldKey = formData.get("fieldKey")?.toString()
	const value = formData.get("value")?.toString() ?? ""

	consola.info("[update-lens-analysis-field] Request:", {
		analysisId,
		sectionKey,
		fieldKey,
		value: value.substring(0, 50),
	})

	if (!analysisId || !sectionKey || !fieldKey) {
		consola.warn("[update-lens-analysis-field] Missing params:", { analysisId, sectionKey, fieldKey })
		return Response.json({ ok: false, error: "Missing required parameters" }, { status: 400 })
	}

	const { client: supabase } = getServerClient(request)

	// Fetch the current analysis
	const { data: analysis, error: fetchError } = await supabase
		.from("conversation_lens_analyses")
		.select("id, analysis_data")
		.eq("id", analysisId)
		.single()

	if (fetchError || !analysis) {
		consola.error("[update-lens-analysis-field] Failed to fetch analysis", fetchError)
		return Response.json({ ok: false, error: "Analysis not found" }, { status: 404 })
	}

	// Parse and update the analysis_data
	const analysisData = (analysis.analysis_data as Record<string, unknown>) || {}
	const sections =
		(analysisData.sections as Array<{ section_key: string; fields: Array<{ field_key: string; value: unknown }> }>) ||
		[]

	consola.info(
		"[update-lens-analysis-field] Found sections:",
		sections.map((s) => s.section_key)
	)

	// Find and update the field
	let fieldUpdated = false
	for (const section of sections) {
		if (section.section_key === sectionKey) {
			consola.info(
				"[update-lens-analysis-field] Found section, fields:",
				section.fields?.map((f) => f.field_key)
			)
			for (const field of section.fields || []) {
				if (field.field_key === fieldKey) {
					consola.info("[update-lens-analysis-field] Updating field from:", field.value, "to:", value.substring(0, 50))
					field.value = value
					fieldUpdated = true
					break
				}
			}
			if (fieldUpdated) break
		}
	}

	if (!fieldUpdated) {
		consola.warn("[update-lens-analysis-field] Field not found:", { sectionKey, fieldKey })
		return Response.json({ ok: false, error: `Field ${sectionKey}.${fieldKey} not found` }, { status: 404 })
	}

	// Persist the update - cast to satisfy Supabase JSONB type
	const updatedData = { ...analysisData, sections } as Json
	const { data: updateData, error: updateError } = await supabase
		.from("conversation_lens_analyses")
		.update({ analysis_data: updatedData })
		.eq("id", analysisId)
		.select("id")

	if (updateError) {
		consola.error("[update-lens-analysis-field] Failed to update analysis", updateError)
		return Response.json({ ok: false, error: "Failed to update field" }, { status: 500 })
	}

	consola.info("[update-lens-analysis-field] Update result:", updateData)
	return Response.json({ ok: true, analysisId, sectionKey, fieldKey, value })
}
