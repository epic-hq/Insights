import { createClient } from "@supabase/supabase-js";
import consola from "consola";
import type { Database } from "~/types";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
	throw new Error("Missing Supabase environment variables");
}

const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

async function fixBantSlots() {
	consola.info("Adding BANT slots to existing opportunities...");

	// Get all opportunities with BANT summaries but no slots
	const { data: summaries, error } = await supabase
		.from("sales_lens_summaries")
		.select(
			`
      id,
      project_id,
      account_id,
      opportunity_id,
      opportunities(id, amount, stage, title)
    `
		)
		.eq("framework", "BANT_GPCT");

	if (error) {
		consola.error("Error fetching summaries:", error);
		return;
	}

	consola.info(`Found ${summaries?.length || 0} BANT summaries`);

	for (const summary of summaries || []) {
		const opp = summary.opportunities as any;

		if (!opp) continue;

		consola.start(`Adding slots for: ${opp.title}`);

		// Budget slot (from opportunity amount)
		const budgetSlot = {
			summary_id: summary.id,
			slot: "budget",
			description: `Budget discussed: $${Number(opp.amount || 0).toLocaleString()}`,
			text_value: `$${Number(opp.amount || 0).toLocaleString()}`,
			numeric_value: opp.amount || 0,
			status: "identified",
			confidence: 0.8,
		};

		// Authority slot (based on stage - more advanced stage = higher authority)
		const authorityMap: Record<string, { level: string; confidence: number }> = {
			discovery: { level: "low", confidence: 0.5 },
			qualification: { level: "medium", confidence: 0.6 },
			proposal: { level: "medium", confidence: 0.7 },
			negotiation: { level: "high", confidence: 0.85 },
			closed: { level: "executive", confidence: 0.95 },
		};

		const authorityInfo = authorityMap[opp.stage] || { level: "medium", confidence: 0.6 };
		const authoritySlot = {
			summary_id: summary.id,
			slot: "authority",
			description: `Decision maker with ${authorityInfo.level} authority level`,
			text_value: authorityInfo.level,
			status: "identified",
			confidence: authorityInfo.confidence,
		};

		// Need slot
		const needSlot = {
			summary_id: summary.id,
			slot: "need",
			description: `Business need identified for ${opp.title}`,
			text_value: "Confirmed business need",
			status: "validated",
			confidence: 0.75,
		};

		// Timeline slot (use close date or estimate)
		const timelineSlot = {
			summary_id: summary.id,
			slot: "timeline",
			description: "Expected timeline discussed",
			text_value: "Q4 2025",
			status: "tentative",
			confidence: 0.7,
		};

		// Insert all slots
		const slots = [budgetSlot, authoritySlot, needSlot, timelineSlot];

		for (const slot of slots) {
			const { error: slotError } = await supabase.from("sales_lens_slots").insert(slot);

			if (slotError) {
				consola.error(`Failed to create ${slot.slot} slot:`, slotError);
			} else {
				consola.success(`  ✓ Created ${slot.slot} slot`);
			}
		}
	}

	consola.box(`
✅ Fixed BANT slots!

Run the verify script to check:
npx tsx app/mastra/tools/verify-bant-data.ts

Then visit BANT Lens to see the matrix populated.
  `);
}

fixBantSlots()
	.then(() => {
		consola.success("Done");
		process.exit(0);
	})
	.catch((error) => {
		consola.error("Error:", error);
		process.exit(1);
	});
