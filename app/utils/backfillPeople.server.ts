/**
 * Utility to backfill missing people for existing interviews
 * This addresses the issue where some interviews don't have associated person records
 */

import consola from "consola";
import { getServerClient } from "~/lib/supabase/client.server";
import type { InterviewPeopleInsert, PeopleInsert } from "~/types";

type DatabaseClient = ReturnType<typeof getServerClient>["client"];

interface BackfillOptions {
	accountId: string;
	dryRun?: boolean;
}

interface BackfillResult {
	totalInterviews: number;
	interviewsWithoutPeople: number;
	peopleCreated: number;
	linksCreated: number;
	errors: string[];
}

/**
 * Parse a full name into firstname and lastname
 * Returns { firstname, lastname } with lastname being null for single-word names
 */
function parseFullName(fullName: string): { firstname: string; lastname: string | null } {
	const trimmed = fullName.trim();
	if (!trimmed) return { firstname: "", lastname: null };

	const parts = trimmed.split(/\s+/);
	if (parts.length === 1) {
		return { firstname: parts[0], lastname: null };
	}

	// firstname is the first part, lastname is everything else joined
	return {
		firstname: parts[0],
		lastname: parts.slice(1).join(" "),
	};
}

/**
 * Generate a smart fallback name for a person based on interview data
 */
function generateFallbackPersonName(interview: any): string {
	// Try participant pseudonym first
	if (interview.participant_pseudonym?.trim()) {
		return interview.participant_pseudonym.trim();
	}

	// Try to extract from title
	if (interview.title && !interview.title.includes("Interview -")) {
		const cleanTitle = interview.title
			.replace(/^Interview\s*-?\s*/i, "") // Remove "Interview -" prefix
			.replace(/\d{4}-\d{2}-\d{2}/, "") // Remove dates
			.trim();

		if (cleanTitle.length > 0) {
			return `Participant (${cleanTitle})`;
		}
	}

	// Use interview date or ID as fallback
	const date = interview.interview_date || interview.created_at?.split("T")[0];
	if (date) {
		return `Participant (${date})`;
	}

	// Final fallback
	return `Participant (${interview.id.slice(0, 8)})`;
}

/**
 * Backfill missing people for interviews that don't have person records
 */
export async function backfillMissingPeople(request: Request, options: BackfillOptions): Promise<BackfillResult> {
	const { client: db } = getServerClient(request);
	const { accountId, dryRun = false } = options;

	const result: BackfillResult = {
		totalInterviews: 0,
		interviewsWithoutPeople: 0,
		peopleCreated: 0,
		linksCreated: 0,
		errors: [],
	};

	try {
		consola.info(`Starting backfill for account ${accountId} (dry run: ${dryRun})`);

		// 1. Get all interviews for the account
		const { data: interviews, error: interviewsError } = await db
			.from("interviews")
			.select(`
        id,
        title,
        participant_pseudonym,
        segment,
        interview_date,
        created_at
      `)
			.eq("account_id", accountId);

		if (interviewsError) {
			throw new Error(`Failed to fetch interviews: ${interviewsError.message}`);
		}

		result.totalInterviews = interviews?.length || 0;
		consola.info(`Found ${result.totalInterviews} interviews`);

		if (!interviews || interviews.length === 0) {
			return result;
		}

		// 2. Get existing interview-people links
		const { data: existingLinks, error: linksError } = await db
			.from("interview_people")
			.select("interview_id")
			.in(
				"interview_id",
				interviews.map((i) => i.id)
			);

		if (linksError) {
			throw new Error(`Failed to fetch existing links: ${linksError.message}`);
		}

		const linkedInterviewIds = new Set(existingLinks?.map((link) => link.interview_id) || []);

		// 3. Find interviews without people
		const interviewsWithoutPeople = interviews.filter((interview) => !linkedInterviewIds.has(interview.id));

		result.interviewsWithoutPeople = interviewsWithoutPeople.length;
		consola.info(`Found ${result.interviewsWithoutPeople} interviews without people`);

		if (interviewsWithoutPeople.length === 0) {
			consola.info("No interviews need backfilling");
			return result;
		}

		// 4. Create people and links for each interview
		for (const interview of interviewsWithoutPeople) {
			try {
				const personName = generateFallbackPersonName(interview);

				if (dryRun) {
					consola.info(`[DRY RUN] Would create person "${personName}" for interview ${interview.id}`);
					result.peopleCreated++;
					result.linksCreated++;
					continue;
				}

				// Create person record
				const { firstname, lastname } = parseFullName(personName);
				const personData: PeopleInsert = {
					account_id: accountId,
					firstname: firstname || null,
					lastname: lastname || null,
					segment: interview.segment || null,
					description: `Backfilled from interview: ${interview.title || interview.id}`,
				};

				const { data: createdPerson, error: personError } = await db
					.from("people")
					.upsert(personData, { onConflict: "account_id,name_hash" })
					.select("id")
					.single();

				if (personError) {
					const errorMsg = `Failed to create person for interview ${interview.id}: ${personError.message}`;
					result.errors.push(errorMsg);
					consola.error(errorMsg);
					continue;
				}

				if (!createdPerson?.id) {
					const errorMsg = `Person creation succeeded but no ID returned for interview ${interview.id}`;
					result.errors.push(errorMsg);
					consola.error(errorMsg);
					continue;
				}

				// Create interview-people link
				const linkData: InterviewPeopleInsert = {
					interview_id: interview.id,
					person_id: createdPerson.id,
					role: "participant",
				};

				const { error: linkError } = await db.from("interview_people").insert(linkData);

				if (linkError) {
					const errorMsg = `Failed to create link for interview ${interview.id}: ${linkError.message}`;
					result.errors.push(errorMsg);
					consola.error(errorMsg);
					continue;
				}

				result.peopleCreated++;
				result.linksCreated++;

				consola.info(`✓ Created person "${personName}" and linked to interview ${interview.id}`);
			} catch (error) {
				const errorMsg = `Unexpected error processing interview ${interview.id}: ${error instanceof Error ? error.message : "Unknown error"}`;
				result.errors.push(errorMsg);
				consola.error(errorMsg);
			}
		}

		consola.info(
			`Backfill completed: ${result.peopleCreated} people created, ${result.linksCreated} links created, ${result.errors.length} errors`
		);
	} catch (error) {
		const errorMsg = `Backfill failed: ${error instanceof Error ? error.message : "Unknown error"}`;
		result.errors.push(errorMsg);
		consola.error(errorMsg);
	}

	return result;
}

/**
 * Get statistics about interviews and people for an account
 */
export async function getInterviewPeopleStats(
	request: Request,
	accountId: string
): Promise<{
	totalInterviews: number;
	totalPeople: number;
	interviewsWithPeople: number;
	interviewsWithoutPeople: number;
	duplicatePeople: number;
}> {
	const { client: db } = getServerClient(request);

	// Get total interviews
	const { count: totalInterviews } = await db
		.from("interviews")
		.select("*", { count: "exact", head: true })
		.eq("account_id", accountId);

	// Get total people
	const { count: totalPeople } = await db
		.from("people")
		.select("*", { count: "exact", head: true })
		.eq("account_id", accountId);

	// Get interviews with people (via junction table)
	const { data: linkedInterviews } = await db
		.from("interview_people")
		.select("interview_id")
		.in("interview_id", db.from("interviews").select("id").eq("account_id", accountId));

	const interviewsWithPeople = new Set(linkedInterviews?.map((l) => l.interview_id) || []).size;
	const interviewsWithoutPeople = (totalInterviews || 0) - interviewsWithPeople;

	// Check for potential duplicate people (same name)
	const { data: peopleNames } = await db.from("people").select("name").eq("account_id", accountId);

	const nameCount = new Map<string, number>();
	peopleNames?.forEach((person) => {
		const count = nameCount.get(person.name) || 0;
		nameCount.set(person.name, count + 1);
	});

	const duplicatePeople = Array.from(nameCount.values()).filter((count) => count > 1).length;

	return {
		totalInterviews: totalInterviews || 0,
		totalPeople: totalPeople || 0,
		interviewsWithPeople,
		interviewsWithoutPeople,
		duplicatePeople,
	};
}
