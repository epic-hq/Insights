/**
 * Script to regenerate themes for existing interviews
 *
 * This script re-runs the theme generation step for interviews that have:
 * - Successfully extracted evidence
 * - Old themes with missing statement/inclusion_criteria
 *
 * Usage:
 *   npx tsx scripts/reprocess-themes.ts [project-id] [--limit 10] [--dry-run]
 * npx tsx scripts/reprocess-themes.ts 6dbcbb68-0662-4ebc-9f84-dd13b8ff758d
 */

import consola from "consola";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";
import type { Database } from "~/types";
import { analyzeThemesAndPersonaCore } from "~/utils/processInterview.server";

type InterviewStatus = Database["public"]["Enums"]["interview_status"];
const eligibleStatuses: readonly InterviewStatus[] = ["ready", "tagged", "processing", "transcribed"] as const;

type TranscriptFormattedPayload = {
	full_transcript?: string | null;
	text?: string | null;
	transcript?: string | null;
};

type InterviewRecord = Pick<
	Database["public"]["Tables"]["interviews"]["Row"],
	| "id"
	| "account_id"
	| "project_id"
	| "title"
	| "media_url"
	| "status"
	| "duration_sec"
	| "transcript_formatted"
	| "transcript"
	| "updated_at"
> & { transcript_data?: Record<string, unknown> };

interface ScriptOptions {
	projectId?: string;
	limit?: number;
	dryRun?: boolean;
	onlyMissingThemes?: boolean;
}

async function reprocessThemes(options: ScriptOptions = {}) {
	const supabase = createSupabaseAdminClient();

	// Parse command line args
	const args = process.argv.slice(2);
	const projectId = options.projectId || args.find((a) => !a.startsWith("--"));
	const limit = options.limit || Number.parseInt(args.find((a) => a.startsWith("--limit"))?.split("=")[1] || "10", 10);
	const dryRun = options.dryRun || args.includes("--dry-run");
	const onlyMissing = options.onlyMissingThemes || args.includes("--only-missing");

	consola.info("🔄 Starting theme reprocessing", { projectId, limit, dryRun, onlyMissing });

	// Get interviews that need reprocessing
	let query = supabase
		.from("interviews")
		.select("id, account_id, project_id, title, media_url, status, duration_sec, transcript_formatted, transcript")
		.in("status", eligibleStatuses)
		.not("transcript_formatted", "is", null)
		.order("created_at", { ascending: false });

	if (projectId) {
		query = query.eq("project_id", projectId);
	}

	if (limit) {
		query = query.limit(limit);
	}

	const { data: interviews, error: interviewsError } = await query;

	if (interviewsError) {
		consola.error("Failed to fetch interviews:", interviewsError);
		process.exit(1);
	}

	if (!interviews?.length) {
		consola.warn("No interviews found to reprocess");
		return;
	}

	consola.info(`Found ${interviews.length} interviews to process`);

	// Process each interview
	for (const interview of interviews) {
		const interviewId = interview.id;
		const accountId = interview.account_id;
		const projectId = interview.project_id;

		if (!accountId || !projectId) {
			consola.warn(`Skipping interview ${interviewId} - missing account_id or project_id`);
			continue;
		}

		consola.start(`Processing interview: ${interview.title || interviewId}`);

		// Check if interview has evidence
		const { data: evidence, error: evidenceError } = await supabase
			.from("evidence")
			.select("id")
			.eq("interview_id", interviewId)
			.limit(1);

		if (evidenceError || !evidence?.length) {
			consola.warn(`  ⚠️  No evidence found for interview ${interviewId}, skipping`);
			continue;
		}

		if (dryRun) {
			consola.info(`  [DRY RUN] Would reprocess interview ${interviewId}`);
			continue;
		}

		// Get evidence for this interview
		const { data: evidenceUnits, error: evidenceUnitsError } = await supabase
			.from("evidence")
			.select("*")
			.eq("interview_id", interviewId);

		if (evidenceUnitsError || !evidenceUnits?.length) {
			consola.warn(`  ⚠️  Failed to load evidence units: ${evidenceUnitsError?.message}`);
			continue;
		}

		// Get interview people for metadata
		const { data: interviewPeople, error: peopleError } = await supabase
			.from("interview_people")
			.select("person_id, role, people:person_id(id, name, firstname, lastname, segment, description)")
			.eq("interview_id", interviewId)
			.limit(1)
			.single();

		const primaryPersonId = interviewPeople?.person_id || null;
		const primaryPerson = Array.isArray(interviewPeople?.people)
			? interviewPeople.people[0]
			: interviewPeople?.people || null;

		// Load existing themes so we can delete or decide whether reprocessing is necessary
		const { data: existingThemes, error: existingThemesError } = await supabase
			.from("themes")
			.select("id, statement, inclusion_criteria")
			.eq("interview_id", interviewId);

		if (existingThemesError) {
			consola.warn(`  ⚠️  Failed to load existing themes: ${existingThemesError.message}`);
			continue;
		}

		// Build evidence result payload
		const evidenceResult = {
			personData: { id: primaryPersonId || "" },
			primaryPersonName: primaryPerson?.name || null,
			primaryPersonRole: interviewPeople?.role || null,
			primaryPersonDescription: primaryPerson?.description || null,
			primaryPersonOrganization: (primaryPerson as any)?.default_organization?.name || null,
			primaryPersonSegments: primaryPerson?.segment ? [primaryPerson.segment] : [],
			insertedEvidenceIds: evidenceUnits.map((e) => e.id),
			evidenceUnits: evidenceUnits as any[], // Cast to match expected type
			evidenceFacetKinds: evidenceUnits.map(() => []) as string[][],
		};

		// Build metadata
		const metadata = {
			accountId,
			projectId,
			interviewTitle: interview.title || undefined,
		};

		// Get full transcript from transcript_formatted (new) or legacy transcript fields
		const transcriptFormatted = interview.transcript_formatted as any;
		const legacyTranscriptData = (interview as any).transcript_data as any;
		const fullTranscript =
			typeof transcriptFormatted?.full_transcript === "string"
				? transcriptFormatted.full_transcript
				: typeof legacyTranscriptData?.text === "string"
					? legacyTranscriptData.text
					: typeof legacyTranscriptData?.transcript === "string"
						? legacyTranscriptData.transcript
						: typeof interview.transcript === "string"
							? interview.transcript
							: "";

		if (!fullTranscript) {
			consola.warn("  ⚠️  No transcript found in transcript_data");
			continue;
		}

		try {
			// Delete existing themes for this interview to avoid duplicates
			if (existingThemes?.length) {
				consola.info(`  🗑️  Deleting ${existingThemes.length} existing themes`);
				await supabase.from("themes").delete().eq("interview_id", interviewId);
			}

			// Re-run theme generation
			consola.info("  🎯 Running theme generation...");
			const result = await analyzeThemesAndPersonaCore({
				db: supabase,
				metadata,
				interviewRecord: interview as any,
				fullTranscript,
				evidenceResult,
			});

			consola.success(`  ✅ Created ${result.storedInsights.length} themes for interview ${interviewId}`);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			consola.error(`  ❌ Failed to reprocess interview ${interviewId}: ${message}`);
		}
	}

	consola.success("🎉 Theme reprocessing complete!");
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
	reprocessThemes().catch((error) => {
		consola.error("Fatal error:", error);
		process.exit(1);
	});
}

export { reprocessThemes };
