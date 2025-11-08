import consola from "consola"
import type { SupabaseClient } from "~/types"

/**
 * BANT Matrix cell showing opportunities by Budget and Authority
 */
export type BantMatrixCell = {
	budget_bucket: string
	authority_level: string
	metrics: {
		opportunity_count: number
		total_value: number // Sum of opportunity amounts
		avg_deal_size: number
		confidence_avg: number // Average BANT confidence
	}
	sample_opportunities: Array<{
		id: string
		title: string
		amount: number | null
		stage: string | null
		close_date: string | null
	}>
}

/**
 * Complete BANT matrix for Sales Lens
 */
export type BantMatrix = {
	cells: BantMatrixCell[]
	budget_buckets: string[]
	authority_levels: string[]
	summary: {
		total_opportunities: number
		total_value: number
		cells_with_data: number
	}
}

const BUDGET_BUCKETS = ["Unknown", "<$10K", "$10-50K", "$50-100K", "$100-250K", "$250K-1M", ">$1M"]

const AUTHORITY_LEVELS = ["Unknown", "Low", "Medium", "High", "Executive"]

/**
 * Map stakeholder influence to authority level
 */
function mapInfluenceToAuthority(influence: string | null): string {
	if (!influence) return "Unknown"
	switch (influence) {
		case "low":
			return "Low"
		case "medium":
			return "Medium"
		case "high":
			return "High"
		default:
			return "Unknown"
	}
}

/**
 * Map budget amount to bucket
 */
function mapBudgetToBucket(budget: number | null): string {
	if (!budget || budget === 0) return "Unknown"
	if (budget < 10000) return "<$10K"
	if (budget < 50000) return "$10-50K"
	if (budget < 100000) return "$50-100K"
	if (budget < 250000) return "$100-250K"
	if (budget < 1000000) return "$250K-1M"
	return ">$1M"
}

/**
 * Generate Budget × Authority matrix from opportunities and sales lens data
 */
export async function generateBantMatrix(opts: { supabase: SupabaseClient; projectId: string }): Promise<BantMatrix> {
	const { supabase, projectId } = opts

	consola.info(`[generateBantMatrix] Starting for project ${projectId}`)

	// Get all opportunities for project with their sales lens summaries
	// Using left join (no !inner) so opportunities without BANT data still appear
	const { data: opportunities, error: oppError } = await supabase
		.from("opportunities")
		.select(
			`
			id,
			title,
			amount,
			stage,
			close_date,
			sales_lens_summaries(
				id,
				framework,
				sales_lens_slots(slot, numeric_value, text_value, confidence),
				sales_lens_stakeholders(influence, labels)
			)
		`
		)
		.eq("project_id", projectId)

	if (oppError) {
		consola.error("Error fetching opportunities:", oppError)
		throw oppError
	}

	consola.info(`Found ${opportunities?.length || 0} opportunities with BANT data`)

	// Initialize all cells
	const cellMap = new Map<string, BantMatrixCell>()
	for (const budget of BUDGET_BUCKETS) {
		for (const authority of AUTHORITY_LEVELS) {
			const key = `${budget}|${authority}`
			cellMap.set(key, {
				budget_bucket: budget,
				authority_level: authority,
				metrics: {
					opportunity_count: 0,
					total_value: 0,
					avg_deal_size: 0,
					confidence_avg: 0,
				},
				sample_opportunities: [],
			})
		}
	}

	// Process each opportunity
	let totalValue = 0
	let totalOpps = 0

	for (const opp of opportunities || []) {
		// Find BANT_GPCT summary if it exists
		const bantSummary = opp.sales_lens_summaries?.find((s: any) => s.framework === "BANT_GPCT")

		let budgetValue: number | null = null
		let budgetBucket = "Unknown"
		let authorityLevel = "Unknown"
		let avgConfidence = 0

		if (bantSummary) {
			// Extract budget from slots or opportunity amount
			const budgetSlot = bantSummary.sales_lens_slots?.find((s: any) => s.slot === "budget")
			budgetValue = opp.amount ?? budgetSlot?.numeric_value ?? null
			budgetBucket = mapBudgetToBucket(budgetValue)

			// Extract authority from stakeholders
			const stakeholders = bantSummary.sales_lens_stakeholders || []
			const economicBuyer = stakeholders.find((s: any) => s.labels?.includes("economic_buyer"))
			const authorityInfluence = economicBuyer?.influence ?? stakeholders[0]?.influence ?? null
			authorityLevel = mapInfluenceToAuthority(authorityInfluence)

			// Get overall BANT confidence (average of all slots)
			const slots = bantSummary.sales_lens_slots || []
			avgConfidence =
				slots.length > 0 ? slots.reduce((sum: number, s: any) => sum + (s.confidence || 0), 0) / slots.length : 0
		} else {
			// No BANT data - use opportunity amount if available
			budgetValue = opp.amount
			budgetBucket = mapBudgetToBucket(budgetValue)
		}

		// Update cell
		const key = `${budgetBucket}|${authorityLevel}`
		const cell = cellMap.get(key)
		if (cell) {
			cell.metrics.opportunity_count++
			cell.metrics.total_value += budgetValue || 0
			cell.metrics.confidence_avg =
				(cell.metrics.confidence_avg * (cell.metrics.opportunity_count - 1) + avgConfidence) /
				cell.metrics.opportunity_count

			// Add to samples (max 3)
			if (cell.sample_opportunities.length < 3) {
				cell.sample_opportunities.push({
					id: opp.id,
					title: opp.title,
					amount: opp.amount,
					stage: opp.stage,
					close_date: opp.close_date,
				})
			}

			totalValue += budgetValue || 0
			totalOpps++
		}
	}

	// Calculate averages
	for (const cell of cellMap.values()) {
		if (cell.metrics.opportunity_count > 0) {
			cell.metrics.avg_deal_size = cell.metrics.total_value / cell.metrics.opportunity_count
		}
	}

	const cells = Array.from(cellMap.values())
	const cellsWithData = cells.filter((c) => c.metrics.opportunity_count > 0).length

	consola.success(
		`[generateBantMatrix] Generated ${cells.length} cells, ${cellsWithData} with data, ${totalOpps} opportunities`
	)

	return {
		cells,
		budget_buckets: BUDGET_BUCKETS,
		authority_levels: AUTHORITY_LEVELS,
		summary: {
			total_opportunities: totalOpps,
			total_value: totalValue,
			cells_with_data: cellsWithData,
		},
	}
}
