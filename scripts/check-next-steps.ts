/**
 * Quick script to check next steps in sales_lens_slots table
 */

import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function main() {
	const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

	// Get recent sales lens summaries
	const { data: summaries, error: summariesError } = await supabase
		.from("sales_lens_summaries")
		.select("id, framework, interview_id, computed_at")
		.order("computed_at", { ascending: false })
		.limit(5)

	if (summariesError) {
		console.error("Error fetching summaries:", summariesError)
		return
	}

	console.log(`\n📊 Found ${summaries?.length || 0} recent sales lens summaries:\n`)

	for (const summary of summaries || []) {
		console.log(`Summary: ${summary.id}`)
		console.log(`  Framework: ${summary.framework}`)
		console.log(`  Interview: ${summary.interview_id}`)
		console.log(`  Computed: ${summary.computed_at}`)

		// Get all slots for this summary
		const { data: slots, error: slotsError } = await supabase
			.from("sales_lens_slots")
			.select("id, slot, label, description, text_value, date_value, status, confidence")
			.eq("summary_id", summary.id)
			.order("position", { ascending: true })

		if (slotsError) {
			console.error("  Error fetching slots:", slotsError)
			continue
		}

		const nextStepSlots = slots?.filter((s) => s.slot.startsWith("next_step")) || []
		const otherSlots = slots?.filter((s) => !s.slot.startsWith("next_step")) || []

		console.log(`  Total slots: ${slots?.length || 0}`)
		console.log(`  Other slots: ${otherSlots.length}`)
		console.log(`  Next step slots: ${nextStepSlots.length}`)

		if (nextStepSlots.length > 0) {
			console.log("\n  📋 Next Steps:")
			for (const step of nextStepSlots) {
				console.log(`    - ${step.slot}: ${step.label || "(no label)"}`)
				console.log(`      Description: ${step.description || "(no description)"}`)
				console.log(`      Owner: ${step.text_value || "(no owner)"}`)
				console.log(`      Due: ${step.date_value || "(no date)"}`)
				console.log(`      Status: ${step.status || "(no status)"}`)
				console.log(`      Confidence: ${step.confidence || 0}`)
			}
		} else {
			console.log("  ⚠️  No next step slots found!")
		}

		// Check key_takeaways in interview
		const { data: interview, error: interviewError } = await supabase
			.from("interviews")
			.select("id, title, key_takeaways")
			.eq("id", summary.interview_id)
			.single()

		if (interviewError) {
			console.log(`\n  ⚠️  Error fetching interview: ${interviewError.message}`)
		} else if (interview) {
			if (interview.key_takeaways) {
				console.log(`\n  💡 Key Takeaways (${interview.key_takeaways.length} chars):`)
				console.log(`     ${interview.key_takeaways.substring(0, 200)}${interview.key_takeaways.length > 200 ? "..." : ""}`)
			} else {
				console.log("\n  ⚠️  Key takeaways: NOT GENERATED")
			}
		}

		console.log("\n" + "=".repeat(80) + "\n")
	}
}

main()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error("Script failed:", err)
		process.exit(1)
	})
