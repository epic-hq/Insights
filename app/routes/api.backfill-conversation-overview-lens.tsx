/**
 * Backfill API: Migrates existing conversation_analysis JSONB data
 * into conversation_lens_analyses as 'conversation-overview' lens rows.
 *
 * POST /api/backfill-conversation-overview-lens
 *   action=stats   → count interviews with JSONB data vs lens rows
 *   action=backfill → copy JSONB analysis data to lens table (dryRun=true for preview)
 */

import type { ActionFunctionArgs } from "react-router";
import { CONVERSATION_OVERVIEW_TEMPLATE_KEY } from "~/lib/conversation-analyses/upsertConversationOverviewLens.server";
import { createSupabaseAdminClient, getAuthenticatedUser } from "~/lib/supabase/client.server";

export async function action({ request }: ActionFunctionArgs) {
	try {
		const { user } = await getAuthenticatedUser(request);
		if (!user) {
			return Response.json({ error: "Not authenticated" }, { status: 401 });
		}

		const formData = await request.formData();
		const actionType = formData.get("action")?.toString();
		const dryRun = formData.get("dryRun") === "true";
		const db = createSupabaseAdminClient();

		if (actionType === "stats") {
			return Response.json(await getBackfillStats(db));
		}

		if (actionType === "backfill") {
			return Response.json(await runBackfill(db, dryRun));
		}

		return Response.json({ error: "Invalid action. Use 'stats' or 'backfill'" }, { status: 400 });
	} catch (error) {
		return Response.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
	}
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

async function getBackfillStats(db: ReturnType<typeof createSupabaseAdminClient>) {
	// Interviews that have any conversation_analysis JSONB
	const { count: totalWithJsonb } = await db
		.from("interviews")
		.select("id", { count: "exact", head: true })
		.not("conversation_analysis", "is", null);

	// Interviews that already have a conversation-overview lens row
	const { count: alreadyMigrated } = await db
		.from("conversation_lens_analyses")
		.select("id", { count: "exact", head: true })
		.eq("template_key", CONVERSATION_OVERVIEW_TEMPLATE_KEY);

	return {
		success: true,
		stats: {
			interviews_with_jsonb: totalWithJsonb ?? 0,
			already_migrated: alreadyMigrated ?? 0,
			remaining: (totalWithJsonb ?? 0) - (alreadyMigrated ?? 0),
		},
	};
}

// ---------------------------------------------------------------------------
// Backfill
// ---------------------------------------------------------------------------

async function runBackfill(db: ReturnType<typeof createSupabaseAdminClient>, dryRun: boolean) {
	// Fetch interviews that have conversation_analysis with an overview field
	// (indicates real analysis data, not just workflow state)
	const { data: interviews, error: fetchError } = await db
		.from("interviews")
		.select("id, account_id, project_id, conversation_analysis, updated_at")
		.not("conversation_analysis", "is", null);

	if (fetchError) {
		return { success: false, error: fetchError.message };
	}

	if (!interviews?.length) {
		return { success: true, message: "No interviews with conversation_analysis found", migrated: 0, skipped: 0 };
	}

	// Get existing lens rows to skip
	const { data: existingRows } = await db
		.from("conversation_lens_analyses")
		.select("interview_id")
		.eq("template_key", CONVERSATION_OVERVIEW_TEMPLATE_KEY);

	const alreadyMigrated = new Set((existingRows ?? []).map((r) => r.interview_id));

	const toInsert: Array<{
		interview_id: string;
		template_key: string;
		account_id: string;
		project_id: string | null;
		analysis_data: Record<string, unknown>;
		confidence_score: number;
		auto_detected: boolean;
		status: string;
		processed_at: string;
		processed_by: string | null;
	}> = [];

	let skipped = 0;

	for (const interview of interviews) {
		if (alreadyMigrated.has(interview.id)) {
			skipped++;
			continue;
		}

		const blob = interview.conversation_analysis as Record<string, unknown> | null;
		if (!blob || typeof blob !== "object") {
			skipped++;
			continue;
		}

		// Only migrate if the blob has actual analysis data (overview or key_takeaways)
		if (!blob.overview && !Array.isArray(blob.key_takeaways)) {
			skipped++;
			continue;
		}

		toInsert.push({
			interview_id: interview.id,
			template_key: CONVERSATION_OVERVIEW_TEMPLATE_KEY,
			account_id: interview.account_id,
			project_id: interview.project_id ?? null,
			analysis_data: {
				overview: blob.overview ?? "",
				duration_estimate: blob.duration_estimate ?? null,
				key_takeaways: Array.isArray(blob.key_takeaways) ? blob.key_takeaways : [],
				recommended_next_steps: Array.isArray(blob.recommended_next_steps) ? blob.recommended_next_steps : [],
				open_questions: Array.isArray(blob.open_questions) ? blob.open_questions : [],
				questions: Array.isArray(blob.questions) ? blob.questions : [],
				participant_goals: Array.isArray(blob.participant_goals) ? blob.participant_goals : [],
			},
			confidence_score: 0.85,
			auto_detected: true,
			status: "completed",
			processed_at: interview.updated_at ?? new Date().toISOString(),
			processed_by: null,
		});
	}

	if (dryRun) {
		return {
			success: true,
			dryRun: true,
			message: `Would migrate ${toInsert.length} interviews, skip ${skipped}`,
			migrated: toInsert.length,
			skipped,
			sampleIds: toInsert.slice(0, 5).map((r) => r.interview_id),
		};
	}

	// Batch insert in chunks of 50
	const BATCH_SIZE = 50;
	let totalInserted = 0;
	const errors: string[] = [];

	for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
		const batch = toInsert.slice(i, i + BATCH_SIZE);
		const { error: insertError } = await db
			.from("conversation_lens_analyses")
			.upsert(batch, { onConflict: "interview_id,template_key" });

		if (insertError) {
			errors.push(`Batch ${i / BATCH_SIZE}: ${insertError.message}`);
		} else {
			totalInserted += batch.length;
		}
	}

	return {
		success: errors.length === 0,
		message: `Migrated ${totalInserted} interviews, skipped ${skipped}`,
		migrated: totalInserted,
		skipped,
		errors: errors.length > 0 ? errors : undefined,
	};
}
