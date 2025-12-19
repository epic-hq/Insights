/**
 * Fix stuck interview by updating status to "ready"
 *
 * Usage: TRIGGER_SECRET_KEY=... npx tsx scripts/fix-stuck-interview.ts <interview-id>
 */

import { createClient } from "@supabase/supabase-js"

const interviewId = process.argv[2]

if (!interviewId) {
	console.error("Usage: npx tsx scripts/fix-stuck-interview.ts <interview-id>")
	process.exit(1)
}

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
	console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
	process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function fixInterview() {
	console.log(`Fixing interview: ${interviewId}`)

	// Get current state
	const { data: interview, error: fetchError } = await supabase
		.from("interviews")
		.select("id, title, status, transcript, lens_visibility")
		.eq("id", interviewId)
		.single()

	if (fetchError || !interview) {
		console.error("Failed to fetch interview:", fetchError)
		process.exit(1)
	}

	console.log("Current state:", {
		title: interview.title,
		status: interview.status,
		hasTranscript: !!interview.transcript,
		lensVisibility: interview.lens_visibility,
	})

	if (interview.status === "ready") {
		console.log("Interview is already ready!")
		return
	}

	// Update to ready
	const { data: updated, error: updateError } = await supabase
		.from("interviews")
		.update({
			status: "ready",
			updated_at: new Date().toISOString(),
		})
		.eq("id", interviewId)
		.select("id, status")
		.single()

	if (updateError) {
		console.error("Failed to update:", updateError)
		process.exit(1)
	}

	if (!updated || updated.status !== "ready") {
		console.error("Update did not persist! Current status:", updated?.status)
		process.exit(1)
	}

	console.log("✅ Verified status updated to 'ready'")

	// Optionally update lens_visibility to allow lens application
	if (interview.lens_visibility === "private") {
		const { error: visError } = await supabase
			.from("interviews")
			.update({ lens_visibility: "account" })
			.eq("id", interviewId)

		if (visError) {
			console.warn("Warning: Failed to update lens_visibility:", visError)
		} else {
			console.log("✅ Updated lens_visibility to 'account' (enables lens application)")
		}
	}

	console.log("\nDone! Refresh the page to see the transcript.")
}

fixInterview()
