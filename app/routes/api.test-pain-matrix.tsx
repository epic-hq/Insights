import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { generatePainMatrix } from "~/features/lenses/services/generatePainMatrix.server"
import { supabaseAdmin } from "~/lib/supabase/client.server"

/**
 * Test API route for pain matrix generation
 * POST /api/test-pain-matrix with { projectId: string, minEvidence?: number, minGroupSize?: number }
 *
 * NOTE: Uses admin client to bypass RLS for testing
 */
export async function action({ request }: ActionFunctionArgs) {
	const supabase = supabaseAdmin

	try {
		const formData = await request.formData()
		const projectId = formData.get("projectId")?.toString()
		const minEvidence = Number.parseInt(formData.get("minEvidence")?.toString() || "2", 10)
		const minGroupSize = Number.parseInt(formData.get("minGroupSize")?.toString() || "1", 10)

		if (!projectId) {
			return Response.json({ error: "projectId is required" }, { status: 400 })
		}

		consola.log(`[test-pain-matrix] Generating pain matrix for project: ${projectId}`)
		consola.log(`[test-pain-matrix] minEvidence: ${minEvidence}, minGroupSize: ${minGroupSize}`)

		const matrix = await generatePainMatrix({
			supabase,
			projectId,
			minEvidencePerPain: minEvidence,
			minGroupSize,
		})

		consola.log(`[test-pain-matrix] Generated matrix:`, {
			pain_themes: matrix.pain_themes.length,
			user_groups: matrix.user_groups.length,
			cells: matrix.cells.length,
			high_impact_cells: matrix.summary.high_impact_cells,
		})

		// Get top 10 high-impact cells for preview
		const topCells = matrix.cells.slice(0, 10).map((cell) => ({
			pain: cell.pain_theme_name,
			pain_id: cell.pain_theme_id,
			user_group: cell.user_group.name,
			impact_score: Math.round(cell.metrics.impact_score * 100) / 100,
			frequency: Math.round(cell.metrics.frequency * 100),
			intensity: cell.metrics.intensity,
			intensity_score: cell.metrics.intensity_score,
			wtp: cell.metrics.willingness_to_pay,
			wtp_score: cell.metrics.wtp_score,
			evidence_count: cell.evidence.count,
			person_count: cell.evidence.person_count,
			sample_quote: cell.evidence.sample_verbatims[0] || null,
		}))

		// Return all cells for full matrix rendering
		const allCells = matrix.cells.map((cell) => ({
			pain: cell.pain_theme_name,
			pain_id: cell.pain_theme_id,
			user_group: cell.user_group.name,
			impact_score: Math.round(cell.metrics.impact_score * 100) / 100,
			frequency: Math.round(cell.metrics.frequency * 100),
			intensity: cell.metrics.intensity,
			intensity_score: cell.metrics.intensity_score,
			wtp: cell.metrics.willingness_to_pay,
			wtp_score: cell.metrics.wtp_score,
			evidence_count: cell.evidence.count,
			person_count: cell.evidence.person_count,
			sample_quote: cell.evidence.sample_verbatims[0] || null,
		}))

		return Response.json(
			{
				success: true,
				projectId,
				summary: matrix.summary,
				pain_themes: matrix.pain_themes.map((p) => ({
					id: p.id,
					name: p.name,
					evidence_count: p.evidence_count,
				})),
				user_groups: matrix.user_groups.map((g) => ({
					type: g.type,
					name: g.name,
					member_count: g.member_count,
				})),
				cells: allCells, // Full matrix for heat map
				top_cells: topCells, // Top 10 for quick view
				full_matrix_available: true,
			},
			{ status: 200 }
		)
	} catch (error) {
		consola.error("[test-pain-matrix] Error:", error)
		return Response.json(
			{
				error: "Failed to generate pain matrix",
				details: error instanceof Error ? error.message : JSON.stringify(error),
				stack: error instanceof Error ? error.stack : undefined,
			},
			{ status: 500 }
		)
	}
}
