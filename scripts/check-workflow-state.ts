import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

const interviewId = "77021927-1968-4752-af77-ac735ded44cd";

async function checkWorkflowState() {
	// Note: analysis_jobs table was removed in migration 20251202150000_consolidate_analysis_jobs.sql
	// Workflow state is now stored in interviews.conversation_analysis JSONB column
	console.log("\n=== NOTE ===");
	console.log("The analysis_jobs table was consolidated into interviews.conversation_analysis");
	console.log("Workflow state is now stored in the conversation_analysis JSONB column\n");

	const { data: interview } = await supabase.from("interviews").select("*").eq("id", interviewId).single();

	console.log("\n=== FULL INTERVIEW RECORD ===");
	if (interview) {
		console.log("Account ID:", interview.account_id);
		console.log("Project ID:", interview.project_id);
		console.log("Status:", interview.status);
		console.log("\n=== CONVERSATION ANALYSIS ===");
		console.log(JSON.stringify(interview.conversation_analysis, null, 2));
		console.log("\n=== PROCESSING METADATA ===");
		console.log(JSON.stringify(interview.processing_metadata, null, 2));
		console.log("\n=== MEDIA INFO ===");
		console.log("Has media_url:", !!interview.media_url);
		console.log("Media URL:", interview.media_url?.substring(0, 100));
	}
}

checkWorkflowState();
