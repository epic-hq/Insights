#!/usr/bin/env tsx

/**
 * Repair Script for Stuck Interviews
 *
 * Fixes interviews stuck in "processing" state due to the analysis_jobs table removal.
 * Triggers the v2 orchestrator to complete processing.
 *
 * Usage:
 *   # Single interview
 *   npx tsx scripts/repair-stuck-interviews.ts <interview-id>
 *
 *   # All stuck interviews (processing > 1 hour)
 *   npx tsx scripts/repair-stuck-interviews.ts --all
 *
 *   # Dry run (preview what would be repaired)
 *   npx tsx scripts/repair-stuck-interviews.ts --all --dry-run
 */

import { createClient } from "@supabase/supabase-js";
import consola from "consola";
import dotenv from "dotenv";

// Load .env file
dotenv.config();

interface RepairOptions {
	interviewId?: string;
	all?: boolean;
	dryRun?: boolean;
}

async function repairStuckInterview(interviewId: string, dryRun = false) {
	const supabaseUrl = process.env.SUPABASE_URL;
	const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

	if (!supabaseUrl || !supabaseServiceKey) {
		consola.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
		process.exit(1);
	}

	const client = createClient(supabaseUrl, supabaseServiceKey);

	// Get interview details
	const { data: interview, error: interviewError } = await client
		.from("interviews")
		.select("*")
		.eq("id", interviewId)
		.single();

	if (interviewError || !interview) {
		consola.error(`❌ Interview ${interviewId} not found:`, interviewError);
		return { success: false, interviewId, error: "Interview not found" };
	}

	consola.info(`📋 Interview: ${interview.title || "Untitled"} (${interview.id})`);
	consola.info(`   Status: ${interview.status}`);
	consola.info(`   Has media: ${!!interview.media_url}`);
	consola.info(`   Has transcript: ${!!interview.transcript}`);
	consola.info(`   Created: ${interview.created_at}`);
	consola.info(`   Updated: ${interview.updated_at}`);

	// Check if interview has media OR transcript
	const hasTranscript = interview.transcript && interview.transcript.length > 0;
	const hasMedia = interview.media_url && interview.media_url.length > 0;

	if (!hasTranscript && !hasMedia) {
		consola.warn("⚠️  Interview has neither transcript nor media - cannot repair");
		return {
			success: false,
			interviewId,
			error: "No transcript or media available",
		};
	}

	if (!hasTranscript && hasMedia) {
		consola.info("📝 Interview has media but no transcript - orchestrator will transcribe from media");
	}

	if (dryRun) {
		consola.info(`🔍 [DRY RUN] Would trigger orchestrator for ${interviewId}`);
		consola.info("   Command: npx trigger.dev@latest dev --trigger-url https://trigger.upsight.ai");
		return { success: true, interviewId, dryRun: true };
	}

	// Show simple API call instructions using existing endpoint
	consola.box({
		title: `🛠️  Repair Interview: ${interviewId}`,
		message: `
This will trigger the v2 orchestrator to process the interview.
${!hasTranscript && hasMedia ? "The orchestrator will transcribe the media file before processing." : ""}
    `.trim(),
	});

	consola.info("\n📋 Command to run:\n");
	consola.log(`curl -X POST http://localhost:4280/api/reprocess-interview -F "interviewId=${interviewId}"`);

	consola.info("\n🔍 What this does:\n");
	consola.log("1. Sets interview status to 'processing'");
	consola.log("2. Triggers the v2 orchestrator");
	if (!hasTranscript && hasMedia) {
		consola.log("3. Transcribes the media from R2");
		consola.log("4. Extracts evidence");
		consola.log("5. Generates insights");
		consola.log("6. Updates status to 'ready'");
	} else {
		consola.log("3. Extracts evidence from transcript");
		consola.log("4. Generates insights");
		consola.log("5. Updates status to 'ready'");
	}

	consola.info("\n💡 Tip: Make sure your dev server is running (npm run dev)\n");

	return { success: true, interviewId, manual: true };
}

async function findStuckInterviews(): Promise<string[]> {
	const supabaseUrl = process.env.SUPABASE_URL;
	const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

	if (!supabaseUrl || !supabaseServiceKey) {
		consola.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
		process.exit(1);
	}

	const client = createClient(supabaseUrl, supabaseServiceKey);

	// Find interviews stuck in processing state for > 1 hour
	const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

	const { data: stuckInterviews, error } = await client
		.from("interviews")
		.select("id, title, created_at, updated_at")
		.eq("status", "processing")
		.lt("updated_at", oneHourAgo)
		.order("created_at", { ascending: false });

	if (error) {
		consola.error("❌ Failed to query stuck interviews:", error);
		return [];
	}

	if (!stuckInterviews || stuckInterviews.length === 0) {
		consola.success("✅ No stuck interviews found!");
		return [];
	}

	consola.info(`\n🔍 Found ${stuckInterviews.length} stuck interview(s):\n`);
	stuckInterviews.forEach((interview, i) => {
		consola.log(`  ${i + 1}. ${interview.title || "Untitled"}`);
		consola.log(`     ID: ${interview.id}`);
		consola.log(`     Created: ${interview.created_at}`);
		consola.log(`     Updated: ${interview.updated_at}\n`);
	});

	return stuckInterviews.map((i) => i.id);
}

async function main() {
	const args = process.argv.slice(2);

	const options: RepairOptions = {
		all: args.includes("--all"),
		dryRun: args.includes("--dry-run"),
	};

	// Get interview ID if provided (first non-flag arg)
	const interviewIdArg = args.find((arg) => !arg.startsWith("--"));
	if (interviewIdArg) {
		options.interviewId = interviewIdArg;
	}

	if (!options.interviewId && !options.all) {
		consola.error("❌ Usage: npx tsx scripts/repair-stuck-interviews.ts <interview-id> OR --all");
		consola.info("\nOptions:");
		consola.info("  --all      Repair all stuck interviews (processing > 1 hour)");
		consola.info("  --dry-run  Preview what would be repaired without making changes");
		process.exit(1);
	}

	consola.box({
		title: "🛠️  Repair Stuck Interviews",
		message: options.dryRun
			? "DRY RUN MODE - No changes will be made"
			: "LIVE MODE - Will trigger orchestrator for stuck interviews",
	});

	const results: Array<{
		success: boolean;
		interviewId: string;
		error?: string;
		dryRun?: boolean;
	}> = [];

	if (options.all) {
		const stuckIds = await findStuckInterviews();

		if (stuckIds.length === 0) {
			process.exit(0);
		}

		for (const id of stuckIds) {
			const result = await repairStuckInterview(id, options.dryRun);
			results.push(result);
		}
	} else if (options.interviewId) {
		const result = await repairStuckInterview(options.interviewId, options.dryRun);
		results.push(result);
	}

	// Summary
	consola.info("\n📊 Repair Summary:");
	const successful = results.filter((r) => r.success).length;
	const failed = results.filter((r) => !r.success).length;

	consola.info(`  ✅ Successful: ${successful}`);
	if (failed > 0) {
		consola.warn(`  ❌ Failed: ${failed}`);
		results
			.filter((r) => !r.success)
			.forEach((r) => {
				consola.error(`     - ${r.interviewId}: ${r.error || "Unknown error"}`);
			});
	}

	if (options.dryRun) {
		consola.box({
			title: "🔍 Dry Run Complete",
			message: "Run without --dry-run to actually repair these interviews",
		});
	} else {
		consola.box({
			title: "✅ Repair Complete",
			message: `Repaired ${successful} interview(s). Check Trigger.dev dashboard for progress.`,
		});
	}

	process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
	consola.error("❌ Repair script failed:", error);
	process.exit(1);
});
