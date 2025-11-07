import { createClient } from "@supabase/supabase-js"
import consola from "consola"
import type { Database } from "~/types"

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
	throw new Error("Missing Supabase environment variables")
}

const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey)

async function debugBantQuery() {
	consola.info("Checking BANT data...")

	// Get all opportunities
	const { data: allOpps } = await supabase.from("opportunities").select("id, title, project_id").limit(10)
	consola.info(`Total opportunities: ${allOpps?.length || 0}`)

	// Get all sales_lens_summaries
	const { data: allSummaries } = await supabase
		.from("sales_lens_summaries")
		.select("id, opportunity_id, framework")
		.limit(10)
	consola.info(`Total sales_lens_summaries: ${allSummaries?.length || 0}`)
	consola.info("Framework values:", allSummaries?.map((s) => s.framework))

	// Try the same query as generateBantMatrix
	if (allOpps && allOpps.length > 0) {
		const projectId = allOpps[0].project_id
		const { data: opportunities, error } = await supabase
			.from("opportunities")
			.select(
				`
        id,
        title,
        amount,
        stage,
        close_date,
        sales_lens_summaries!inner(
          id,
          framework,
          sales_lens_slots(slot, numeric_value, text_value, confidence),
          sales_lens_stakeholders(influence, labels)
        )
      `
			)
			.eq("project_id", projectId)
			.eq("sales_lens_summaries.framework", "BANT_GPCT")

		if (error) {
			consola.error("Query error:", error)
		} else {
			consola.info(`Opportunities with BANT_GPCT framework: ${opportunities?.length || 0}`)
			if (opportunities && opportunities.length > 0) {
				consola.info("Sample:", JSON.stringify(opportunities[0], null, 2))
			}
		}

		// Try without framework filter
		const { data: opportunitiesNoFilter, error: errorNoFilter } = await supabase
			.from("opportunities")
			.select(
				`
        id,
        title,
        sales_lens_summaries(
          id,
          framework
        )
      `
			)
			.eq("project_id", projectId)

		if (errorNoFilter) {
			consola.error("Query error (no filter):", errorNoFilter)
		} else {
			consola.info(`Opportunities (no filter): ${opportunitiesNoFilter?.length || 0}`)
			opportunitiesNoFilter?.forEach((opp) => {
				consola.info(`- ${opp.title}: summaries=${opp.sales_lens_summaries?.length || 0}`)
			})
		}
	}
}

debugBantQuery()
	.then(() => {
		consola.success("Done")
		process.exit(0)
	})
	.catch((error) => {
		consola.error("Error:", error)
		process.exit(1)
	})
