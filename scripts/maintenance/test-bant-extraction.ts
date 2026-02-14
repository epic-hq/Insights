import { createClient } from "@supabase/supabase-js";
import consola from "consola";
import { buildInitialSalesLensExtraction } from "~/utils/salesLens.server";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
	throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testBantExtraction() {
	consola.info("Testing BANT extraction with real data...");

	// Get a recent interview with observations/notes
	const { data: interviews, error } = await supabase
		.from("interviews")
		.select("id, title, interview_date, observations_and_notes, high_impact_themes")
		.not("observations_and_notes", "is", null)
		.order("created_at", { ascending: false })
		.limit(5);

	if (error) {
		consola.error("Error fetching interviews:", error);
		return;
	}

	if (!interviews || interviews.length === 0) {
		consola.warn("No interviews found with observations");
		return;
	}

	consola.success(`Found ${interviews.length} interviews to test`);

	for (const interview of interviews) {
		consola.box(`Testing Interview: ${interview.title || interview.id}`);
		consola.info(`Date: ${interview.interview_date}`);
		consola.info(`Notes preview: ${interview.observations_and_notes?.slice(0, 200)}...`);
		consola.info(`Themes: ${JSON.stringify(interview.high_impact_themes)}`);

		try {
			const extraction = await buildInitialSalesLensExtraction(supabase, interview.id);

			const bantFramework = extraction.frameworks.find((f) => f.name === "BANT_GPCT");

			if (!bantFramework) {
				consola.error("BANT framework not found in extraction");
				continue;
			}

			consola.success(`BANT Slots extracted: ${bantFramework.slots.length}`);

			for (const slot of bantFramework.slots) {
				consola.info(`\n  📌 ${slot.slot.toUpperCase()}`);
				consola.info(`     Summary: ${slot.summary || "N/A"}`);
				consola.info(`     Text: ${slot.textValue || "N/A"}`);
				consola.info(`     Numeric: ${slot.numericValue ?? "N/A"}`);
				consola.info(`     Date: ${slot.dateValue || "N/A"}`);
				consola.info(`     Confidence: ${slot.confidence}`);
				consola.info(`     Owner: ${slot.ownerPersonId || slot.ownerPersonKey || "N/A"}`);
				consola.info(`     Evidence: ${slot.evidence.length} items`);
			}

			consola.info(`\n  👥 Stakeholders: ${extraction.entities.stakeholders.length}`);
			for (const stakeholder of extraction.entities.stakeholders) {
				consola.info(`     - ${stakeholder.displayName} (${stakeholder.influence}) ${stakeholder.labels.join(", ")}`);
			}

			consola.success(`✅ Extraction complete for ${interview.title || interview.id}`);
		} catch (err) {
			consola.error(`Failed to extract BANT for ${interview.id}:`, err);
		}

		consola.log(`\n${"─".repeat(80)}\n`);
	}

	consola.success("BANT extraction test complete!");
}

testBantExtraction();
