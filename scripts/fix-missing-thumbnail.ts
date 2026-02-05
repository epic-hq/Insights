/**
 * One-off script to fix an interview missing thumbnail_url
 *
 * Usage: npx tsx scripts/fix-missing-thumbnail.ts <interviewId>
 */

import "dotenv/config"
import { createClient } from "@supabase/supabase-js"
import { tasks } from "@trigger.dev/sdk/v3"

const interviewId = process.argv[2]

if (!interviewId) {
	console.error("Usage: npx tsx scripts/fix-missing-thumbnail.ts <interviewId>")
	process.exit(1)
}

async function main() {
	const supabaseUrl = process.env.SUPABASE_URL
	const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

	if (!supabaseUrl || !supabaseKey) {
		console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
		process.exit(1)
	}

	const supabase = createClient(supabaseUrl, supabaseKey)

	// Fetch the interview
	const { data: interview, error } = await supabase
		.from("interviews")
		.select("id, media_url, file_extension, thumbnail_url, account_id")
		.eq("id", interviewId)
		.single()

	if (error || !interview) {
		console.error("Interview not found:", error)
		process.exit(1)
	}

	console.log("Found interview:", {
		id: interview.id,
		media_url: interview.media_url,
		file_extension: interview.file_extension,
		thumbnail_url: interview.thumbnail_url,
	})

	if (!interview.media_url) {
		console.error("Interview has no media_url - cannot generate thumbnail")
		process.exit(1)
	}

	// Derive file extension from media_url if not set
	let fileExtension = interview.file_extension
	if (!fileExtension && interview.media_url.includes(".")) {
		fileExtension = interview.media_url.split(".").pop()?.toLowerCase()
		console.log("Derived file_extension from media_url:", fileExtension)

		// Update the interview with the file extension
		const { error: updateError } = await supabase
			.from("interviews")
			.update({ file_extension: fileExtension })
			.eq("id", interviewId)

		if (updateError) {
			console.error("Failed to update file_extension:", updateError)
			process.exit(1)
		}
		console.log("Updated interview file_extension to:", fileExtension)
	}

	// Check if it's a video file
	const videoExtensions = ["mp4", "mov", "avi", "mkv", "webm", "m4v"]
	const isVideo = fileExtension && videoExtensions.includes(fileExtension.toLowerCase())

	if (!isVideo) {
		console.log("Not a video file (extension:", fileExtension, ") - no thumbnail needed")
		process.exit(0)
	}

	// Trigger thumbnail generation
	console.log("Triggering thumbnail generation...")

	try {
		const handle = await tasks.trigger("generate-thumbnail", {
			mediaKey: interview.media_url,
			interviewId: interview.id,
			timestampSec: 1,
			accountId: interview.account_id,
		})

		console.log("Thumbnail generation triggered successfully!")
		console.log("Task run ID:", handle.id)
	} catch (triggerError) {
		console.error("Failed to trigger thumbnail generation:", triggerError)
		process.exit(1)
	}
}

main().catch(console.error)
