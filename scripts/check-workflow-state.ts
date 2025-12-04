import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

const interviewId = "77021927-1968-4752-af77-ac735ded44cd"

async function checkWorkflowState() {
	// Find the analysis job for this interview
	const { data: jobs, error: jobsError } = await supabase
		.from("analysis_jobs")
		.select("*")
		.eq("interview_id", interviewId)
		.order("created_at", { ascending: false })

	console.log("\n=== ANALYSIS JOBS ===")
	if (jobsError) {
		console.error("Error fetching jobs:", jobsError)
	} else if (!jobs || jobs.length === 0) {
		console.log("No analysis jobs found - this confirms we don't use analysis_jobs table!")
	} else {
		console.log(`Found ${jobs.length} job(s):`)
		jobs.forEach(job => {
			console.log(JSON.stringify(job, null, 2))
		})
	}

	// Check if there's workflow state stored somewhere
	// Maybe in interview metadata or processing_metadata?
	const { data: interview } = await supabase
		.from("interviews")
		.select("*")
		.eq("id", interviewId)
		.single()

	console.log("\n=== FULL INTERVIEW RECORD ===")
	if (interview) {
		console.log("Account ID:", interview.account_id)
		console.log("Project ID:", interview.project_id)
		console.log("Status:", interview.status)
		console.log("Processing Metadata:", JSON.stringify(interview.processing_metadata, null, 2))
		console.log("Has media_url:", !!interview.media_url)
		console.log("Media URL:", interview.media_url?.substring(0, 100))
	}
}

checkWorkflowState()
