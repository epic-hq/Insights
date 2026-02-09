import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const projectId = "6dbcbb68-0662-4ebc-9f84-dd13b8ff758d";

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkICPScores() {
	// Get ICP scores with person details
	const { data: scores, error } = await supabase
		.from("person_scale")
		.select(
			`
      score,
      band,
      confidence,
      source,
      people:person_id (
        name,
        title,
        company
      )
    `
		)
		.eq("kind_slug", "icp_match")
		.eq("project_id", projectId)
		.order("score", { ascending: false })
		.limit(10);

	if (error) {
		console.error("Error fetching scores:", error);
		return;
	}

	console.log("\n📊 Top 10 ICP Scored People:\n");
	console.log("─".repeat(100));

	scores?.forEach((s, i) => {
		const person = s.people as any;
		console.log(`${i + 1}. ${person?.name || "Unknown"}`);
		console.log(`   Title: ${person?.title || "N/A"}`);
		console.log(`   Company: ${(person as any)?.default_organization?.name || "N/A"}`);
		console.log(
			`   Score: ${(s.score * 100).toFixed(1)}% | Band: ${s.band || "NONE"} | Confidence: ${(s.confidence * 100).toFixed(0)}%`
		);
		console.log("─".repeat(100));
	});

	// Get distribution stats
	const { data: stats } = await supabase
		.from("person_scale")
		.select("band")
		.eq("kind_slug", "icp_match")
		.eq("project_id", projectId);

	const distribution = {
		HIGH: stats?.filter((s) => s.band === "HIGH").length || 0,
		MEDIUM: stats?.filter((s) => s.band === "MEDIUM").length || 0,
		LOW: stats?.filter((s) => s.band === "LOW").length || 0,
		NONE: stats?.filter((s) => !s.band).length || 0,
	};

	console.log("\n📈 ICP Match Distribution:");
	console.log(`   HIGH:   ${distribution.HIGH} people`);
	console.log(`   MEDIUM: ${distribution.MEDIUM} people`);
	console.log(`   LOW:    ${distribution.LOW} people`);
	console.log(`   NONE:   ${distribution.NONE} people`);
	console.log(`   TOTAL:  ${stats?.length || 0} people\n`);
}

checkICPScores();
