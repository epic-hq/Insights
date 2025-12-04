import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

const interviewId = "77021927-1968-4752-af77-ac735ded44cd"

async function checkStuckInterview() {
	// Check interview status
	const { data: interview, error: interviewError } = await supabase
		.from("interviews")
		.select("status, processing_metadata, created_at, updated_at, transcript, transcript_formatted")
		.eq("id", interviewId)
		.single()

	console.log("\n=== INTERVIEW STATUS ===")
	if (interviewError) {
		console.error("Error fetching interview:", interviewError)
	} else {
		console.log(JSON.stringify(interview, null, 2))
		console.log("\n=== PROCESSING METADATA DETAIL ===")
		if (interview.processing_metadata) {
			console.log("Current Step:", interview.processing_metadata.current_step)
			console.log("Progress:", interview.processing_metadata.progress)
			console.log("Status Detail:", interview.processing_metadata.status_detail)
			console.log("Trigger Run ID:", interview.processing_metadata.trigger_run_id)
			console.log("Error:", interview.processing_metadata.error || "None")
			console.log("Failed At:", interview.processing_metadata.failed_at || "Not failed")
		}

		console.log("\n=== TRANSCRIPT DATA ===")
		console.log("Has transcript:", !!interview.transcript)
		console.log("Transcript length:", interview.transcript?.length || 0)
		console.log("Has transcript_formatted:", !!interview.transcript_formatted)
		if (interview.transcript_formatted) {
			const formatted = interview.transcript_formatted as any
			console.log("Transcript language:", formatted.language || formatted.detected_language || "unknown")
			console.log("Transcript words count:", formatted.words?.length || 0)
			console.log("Transcript utterances count:", formatted.utterances?.length || 0)
		}
	}

	// Check evidence
	const { data: evidence, error: evidenceError } = await supabase
		.from("evidence")
		.select("id, created_at")
		.eq("interview_id", interviewId)

	console.log("\n=== EVIDENCE ===")
	if (evidenceError) {
		console.error("Error fetching evidence:", evidenceError)
	} else {
		console.log(`Found ${evidence?.length || 0} evidence items`)
		if (evidence && evidence.length > 0) {
			console.log("First evidence created at:", evidence[0].created_at)
			console.log("Last evidence created at:", evidence[evidence.length - 1].created_at)
		}
	}

	// Check themes
	const { data: themes, error: themesError } = await supabase
		.from("themes")
		.select("id, theme_name, created_at")
		.eq("interview_id", interviewId)

	console.log("\n=== THEMES ===")
	if (themesError) {
		console.error("Error fetching themes:", themesError)
	} else {
		console.log(`Found ${themes?.length || 0} themes`)
		themes?.forEach((t) => console.log(`- ${t.theme_name} (${t.created_at})`))
	}
}

checkStuckInterview()
