import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

const interviewId = "77021927-1968-4752-af77-ac735ded44cd";

async function checkConversationAnalysis() {
	const { data, error } = await supabase
		.from("interviews")
		.select("conversation_analysis, processing_metadata")
		.eq("id", interviewId)
		.single();

	console.log("\n=== CONVERSATION ANALYSIS ===");
	if (error) {
		console.error("Error:", error);
	} else if (!data) {
		console.log("No data found");
	} else {
		console.log("conversation_analysis:", JSON.stringify(data.conversation_analysis, null, 2));
		console.log("\nprocessing_metadata:", JSON.stringify(data.processing_metadata, null, 2));
	}
}

checkConversationAnalysis();
