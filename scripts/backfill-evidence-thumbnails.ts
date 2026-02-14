/**
 * One-off script to backfill per-evidence video thumbnails for existing interviews.
 * Finds all video interviews that have evidence with anchors, and triggers
 * the generate-evidence-thumbnails task for each via the Trigger.dev REST API.
 *
 * Usage: npx tsx scripts/backfill-evidence-thumbnails.ts
 *        npx tsx scripts/backfill-evidence-thumbnails.ts --dry-run
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const triggerKey = process.env.TRIGGER_SECRET_KEY!;

if (!supabaseUrl || !supabaseKey) {
	console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
	process.exit(1);
}
if (!triggerKey) {
	console.error("Missing TRIGGER_SECRET_KEY");
	process.exit(1);
}

const dryRun = process.argv.includes("--dry-run");
const supabase = createClient(supabaseUrl, supabaseKey);

const VIDEO_EXTENSIONS = ["mp4", "mov", "avi", "mkv", "m4v", "webm"];

// Trigger.dev API base — dev keys use cloud.trigger.dev
const TRIGGER_API = process.env.TRIGGER_API_URL || "https://cloud.trigger.dev";

async function triggerTask(interviewId: string) {
	const res = await fetch(`${TRIGGER_API}/api/v1/tasks/generate-evidence-thumbnails/trigger`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${triggerKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			payload: { interviewId },
		}),
	});

	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Trigger API ${res.status}: ${text}`);
	}
	return res.json();
}

async function main() {
	console.log(dryRun ? "=== DRY RUN ===" : "=== BACKFILL ===");

	// Find interviews that have video media
	const { data: interviews, error } = await supabase
		.from("interviews")
		.select("id, file_extension, media_url")
		.not("media_url", "is", null)
		.in("file_extension", VIDEO_EXTENSIONS);

	if (error) {
		console.error("Failed to fetch interviews:", error.message);
		process.exit(1);
	}

	console.log(`Found ${interviews.length} video interviews with media keys`);

	let triggered = 0;
	for (const interview of interviews) {
		// Check if this interview has evidence with anchors that lack thumbnails
		const { count } = await supabase
			.from("evidence")
			.select("id", { count: "exact", head: true })
			.eq("interview_id", interview.id)
			.not("anchors", "eq", "[]")
			.is("thumbnail_url", null);

		if (!count || count === 0) {
			console.log(`  skip ${interview.id} — no evidence needing thumbnails`);
			continue;
		}

		console.log(`  ${dryRun ? "would trigger" : "triggering"} ${interview.id} — ${count} evidence items`);

		if (!dryRun) {
			try {
				await triggerTask(interview.id);
				triggered++;
			} catch (err) {
				console.error(`  FAILED ${interview.id}:`, err);
			}
		} else {
			triggered++;
		}
	}

	console.log(`\nDone. ${dryRun ? "Would trigger" : "Triggered"} ${triggered}/${interviews.length} interviews.`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
