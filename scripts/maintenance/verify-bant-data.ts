import { createClient } from "@supabase/supabase-js"
import consola from "consola"

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
	throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function verifyBantData() {
	const projectId = "6d3594bd-04d5-48dc-8a37-14d609b3e1ad"

	consola.info("Verifying BANT lens data...")

	// Check opportunities
	const { data: opportunities, error: oppError } = await supabase
		.from("opportunities")
		.select("id, title, amount, stage")
		.eq("project_id", projectId)

	if (oppError) {
		consola.error("Error fetching opportunities:", oppError)
		return
	}

	consola.success(`✅ Found ${opportunities?.length || 0} opportunities`)

	// Check BANT summaries
	const { data: summaries, error: summaryError } = await supabase
		.from("sales_lens_summaries")
		.select(
			`
      id,
      opportunity_id,
      interview_id,
      framework
    `
		)
		.eq("project_id", projectId)
		.eq("framework", "BANT_GPCT")

	if (summaryError) {
		consola.error("Error fetching summaries:", summaryError)
		return
	}

	consola.success(`✅ Found ${summaries?.length || 0} BANT summaries`)

	// Check slots
	const { data: slots, error: slotsError } = await supabase
		.from("sales_lens_slots")
		.select("id, summary_id, slot, text_value, numeric_value")
		.in("summary_id", summaries?.map((s) => s.id) || [])

	if (slotsError) {
		consola.error("Error fetching slots:", slotsError)
		return
	}

	consola.success(`✅ Found ${slots?.length || 0} BANT slots`)

	// Show breakdown by slot type
	const slotBreakdown = slots?.reduce(
		(acc, slot) => {
			acc[slot.slot] = (acc[slot.slot] || 0) + 1
			return acc
		},
		{} as Record<string, number>
	)

	consola.info("Slot breakdown:", slotBreakdown)

	// Check stakeholders
	const { data: stakeholders, error: stakeholdersError } = await supabase
		.from("sales_lens_stakeholders")
		.select("id, summary_id, display_name, influence, labels")
		.in("summary_id", summaries?.map((s) => s.id) || [])

	if (stakeholdersError) {
		consola.error("Error fetching stakeholders:", stakeholdersError)
		return
	}

	consola.success(`✅ Found ${stakeholders?.length || 0} stakeholders`)

	consola.box(`
BANT Lens Data Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━
Opportunities: ${opportunities?.length || 0}
BANT Summaries: ${summaries?.length || 0}
BANT Slots: ${slots?.length || 0}
Stakeholders: ${stakeholders?.length || 0}

Ready to view at:
/a/<account-id>/${projectId}/bant-lens
  `)
}

verifyBantData()
