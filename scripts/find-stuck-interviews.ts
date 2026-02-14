#!/usr/bin/env tsx
import { createClient } from "@supabase/supabase-js";
import consola from "consola";
import dotenv from "dotenv";

dotenv.config();

async function findStuckInterviews() {
	const client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

	// Find ALL stuck interviews (processing > 1 hour) across all accounts
	const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
	const { data: interviews, error } = await client
		.from("interviews")
		.select("id, title, account_id, created_at, updated_at, status, media_url, transcript")
		.eq("status", "processing")
		.lt("updated_at", oneHourAgo)
		.order("account_id")
		.order("created_at", { ascending: false });

	if (error) {
		consola.error("Failed to query interviews:", error);
		process.exit(1);
	}

	if (!interviews || interviews.length === 0) {
		consola.success("✅ No stuck interviews found!");
		process.exit(0);
	}

	// Get account names
	const accountIds = [...new Set(interviews.map((i) => i.account_id))];
	const { data: accounts } = await client.from("accounts").select("id, name").in("id", accountIds);

	const accountMap = new Map(accounts?.map((a) => [a.id, a.name]) || []);

	consola.info(`\nFound ${interviews.length} stuck interview(s) across ${accountIds.length} account(s)\n`);

	// Group by account
	const byAccount = interviews.reduce(
		(acc, i) => {
			if (!acc[i.account_id]) acc[i.account_id] = [];
			acc[i.account_id].push(i);
			return acc;
		},
		{} as Record<string, typeof interviews>
	);

	// Display grouped by account
	Object.entries(byAccount).forEach(([accountId, accountInterviews]) => {
		const accountName = accountMap.get(accountId) || "Unknown";
		consola.box({
			title: `${accountName} (${accountId})`,
			message: `${accountInterviews.length} stuck interview(s)`,
		});

		accountInterviews.forEach((i) => {
			const hasMedia = i.media_url && i.media_url.length > 0;
			const hasTranscript = i.transcript && i.transcript.length > 0;
			consola.log(`\n  ${i.title || "Untitled"}`);
			consola.log(`  ID: ${i.id}`);
			consola.log(`  Media: ${hasMedia ? "YES" : "NO"} | Transcript: ${hasTranscript ? "YES" : "NO"}`);
			consola.log(`  Created: ${i.created_at}`);
			consola.log(`  Updated: ${i.updated_at}`);
		});
		consola.log("\n");
	});

	// Generate repair commands
	consola.box({
		title: "🛠️  Repair Commands",
		message: "Run these commands to repair all stuck interviews:\n",
	});

	interviews.forEach((i) => {
		consola.log(`curl -X POST http://localhost:4280/api/reprocess-interview -F "interviewId=${i.id}"`);
	});
	consola.log("\n");
}

findStuckInterviews().catch(console.error);
