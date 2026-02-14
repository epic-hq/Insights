import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);

async function run() {
	// Check if thumbnail_url column exists
	const { data, error } = await sb
		.from("evidence")
		.select("id, thumbnail_url, anchors, interview_id")
		.not("anchors", "eq", "[]")
		.limit(3);

	if (error) {
		console.error("Query error:", error.message);
		return;
	}
	console.log("Sample evidence with anchors:", JSON.stringify(data, null, 2));

	// Count total evidence with non-empty anchors and null thumbnail
	const { count: needsThumb } = await sb
		.from("evidence")
		.select("id", { count: "exact", head: true })
		.not("anchors", "eq", "[]")
		.is("thumbnail_url", null);
	console.log("Evidence needing thumbnails:", needsThumb);

	// Check which interviews have evidence needing thumbnails
	const { data: evWithInterviews } = await sb
		.from("evidence")
		.select("interview_id")
		.not("anchors", "eq", "[]")
		.is("thumbnail_url", null)
		.limit(100);

	const interviewIds = [...new Set((evWithInterviews || []).map((e) => e.interview_id))];
	console.log(`Unique interviews with evidence needing thumbnails: ${interviewIds.length}`);

	// Check if those interviews are video
	if (interviewIds.length > 0) {
		const { data: interviews } = await sb
			.from("interviews")
			.select("id, file_extension, media_url")
			.in("id", interviewIds.slice(0, 10));
		console.log("Interview details:", JSON.stringify(interviews, null, 2));
	}
}

run();
