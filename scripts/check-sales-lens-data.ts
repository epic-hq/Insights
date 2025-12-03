import { createSupabaseAdminClient } from "~/lib/supabase/client.server"

async function checkSalesLensData() {
	const supabase = createSupabaseAdminClient()

	// Get the latest sales lens summary
	const { data: summaries, error: summariesError } = await supabase
		.from("sales_lens_summaries")
		.select("id, framework, computed_at, interview_id, metadata")
		.order("computed_at", { ascending: false })
		.limit(3)

	if (summariesError) {
		console.error("Error fetching summaries:", summariesError)
		return
	}

	if (!summaries || summaries.length === 0) {
		console.log("❌ No sales lens summaries found")
		return
	}

	console.log(`\n✅ Found ${summaries.length} sales lens summaries\n`)

	for (const summary of summaries) {
		console.log("=".repeat(60))
		console.log(`Framework: ${summary.framework}`)
		console.log(`Interview ID: ${summary.interview_id}`)
		console.log(`Computed: ${summary.computed_at}`)
		console.log("Metadata:", JSON.stringify(summary.metadata, null, 2))

		// Get slots for this summary
		const { data: slots } = await supabase
			.from("sales_lens_slots")
			.select("slot, label, description, text_value, status, confidence, evidence_refs")
			.eq("summary_id", summary.id)
			.order("position", { ascending: true })

		console.log(`\n📊 Slots (${slots?.length || 0}):`)
		if (slots && slots.length > 0) {
			for (const slot of slots) {
				console.log(`  • ${slot.slot} (${slot.label || "no label"}):`)
				console.log(`    ${slot.description || slot.text_value || "No value"}`)
				if (slot.confidence) console.log(`    Confidence: ${(slot.confidence * 100).toFixed(0)}%`)
				const evidenceRefs = Array.isArray(slot.evidence_refs) ? slot.evidence_refs : []
				if (evidenceRefs.length > 0) {
					console.log(`    Evidence: ${evidenceRefs.length} references`)
				}
			}
		} else {
			console.log("  No slots found")
		}

		// Get stakeholders
		const { data: stakeholders } = await supabase
			.from("sales_lens_stakeholders")
			.select("display_name, role, influence, labels")
			.eq("summary_id", summary.id)

		console.log(`\n👥 Stakeholders (${stakeholders?.length || 0}):`)
		if (stakeholders && stakeholders.length > 0) {
			for (const sh of stakeholders) {
				console.log(`  • ${sh.display_name} (${sh.role || "no role"})`)
				console.log(`    Influence: ${sh.influence}, Labels: ${sh.labels?.join(", ") || "none"}`)
			}
		} else {
			console.log("  No stakeholders found")
		}

		console.log("\n")
	}
}

checkSalesLensData()
	.then(() => {
		console.log("✅ Done")
		process.exit(0)
	})
	.catch((error) => {
		console.error("❌ Error:", error)
		process.exit(1)
	})
