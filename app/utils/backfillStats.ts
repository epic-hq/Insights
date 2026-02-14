/**
 * Pure functions for calculating backfill statistics
 * No external dependencies - easy to test
 */

export interface Interview {
	id: string;
	title?: string | null;
	participant_pseudonym?: string | null;
	segment?: string | null;
	interview_date?: string | null;
	created_at: string;
}

export interface InterviewPeopleLink {
	interview_id: string;
	person_id: string;
}

export interface Person {
	id: string;
	name: string;
	account_id: string;
}

interface BackfillStats {
	totalInterviews: number;
	totalPeople: number;
	interviewsWithPeople: number;
	interviewsWithoutPeople: number;
	duplicatePeople: number;
}

interface BackfillResult {
	totalInterviews: number;
	interviewsWithoutPeople: number;
	peopleCreated: number;
	linksCreated: number;
	errors: string[];
}

/**
 * Calculate statistics about interviews and people relationships
 */
export function calculateBackfillStats(
	interviews: Interview[],
	people: Person[],
	links: InterviewPeopleLink[]
): BackfillStats {
	const totalInterviews = interviews.length;
	const totalPeople = people.length;

	// Count unique interviews that have people linked
	const linkedInterviewIds = new Set(links.map((link) => link.interview_id));
	const interviewsWithPeople = linkedInterviewIds.size;
	const interviewsWithoutPeople = totalInterviews - interviewsWithPeople;

	// Count duplicate people (same name)
	const nameCount = new Map<string, number>();
	people.forEach((person) => {
		const count = nameCount.get(person.name) || 0;
		nameCount.set(person.name, count + 1);
	});
	const duplicatePeople = Array.from(nameCount.values()).filter((count) => count > 1).length;

	return {
		totalInterviews,
		totalPeople,
		interviewsWithPeople,
		interviewsWithoutPeople,
		duplicatePeople,
	};
}

/**
 * Identify interviews that need people created
 */
export function identifyInterviewsWithoutPeople(interviews: Interview[], links: InterviewPeopleLink[]): Interview[] {
	const linkedInterviewIds = new Set(links.map((link) => link.interview_id));
	return interviews.filter((interview) => !linkedInterviewIds.has(interview.id));
}

/**
 * Group interviews by potential duplicate people
 * Useful for identifying interviews that might refer to the same person
 */
export function groupInterviewsByPotentialPerson(interviews: Interview[]): Map<string, Interview[]> {
	const groups = new Map<string, Interview[]>();

	interviews.forEach((interview) => {
		// Use pseudonym as the grouping key if available
		const key = interview.participant_pseudonym?.trim() || interview.segment || "unknown";

		if (!groups.has(key)) {
			groups.set(key, []);
		}
		groups.get(key)?.push(interview);
	});

	return groups;
}

/**
 * Calculate the priority score for creating a person from an interview
 * Higher score = higher priority
 */
export function calculatePersonCreationPriority(interview: Interview): number {
	let score = 0;

	// Has pseudonym = highest priority
	if (interview.participant_pseudonym?.trim()) score += 100;

	// Has meaningful title
	if (interview.title && !interview.title.includes("Interview -")) score += 50;

	// Has segment information
	if (interview.segment) score += 25;

	// Has interview date
	if (interview.interview_date) score += 10;

	// Newer interviews get slight priority
	const daysSinceCreation = (Date.now() - new Date(interview.created_at).getTime()) / (1000 * 60 * 60 * 24);
	if (daysSinceCreation < 7) score += 5;

	return score;
}

/**
 * Sort interviews by priority for person creation
 */
export function prioritizeInterviewsForPersonCreation(interviews: Interview[]): Interview[] {
	return [...interviews].sort((a, b) => calculatePersonCreationPriority(b) - calculatePersonCreationPriority(a));
}

/**
 * Validate that a backfill operation would be safe
 */
export function validateBackfillOperation(
	interviews: Interview[],
	existingLinks: InterviewPeopleLink[]
): { isValid: boolean; warnings: string[] } {
	const warnings: string[] = [];

	// Check for potential data integrity issues
	const interviewsWithoutPeople = identifyInterviewsWithoutPeople(interviews, existingLinks);

	if (interviewsWithoutPeople.length === 0) {
		warnings.push("No interviews need backfilling - all interviews already have people");
	}

	if (interviewsWithoutPeople.length > 100) {
		warnings.push(`Large backfill operation: ${interviewsWithoutPeople.length} interviews need people`);
	}

	// Check for interviews with missing critical data
	const interviewsWithoutDates = interviewsWithoutPeople.filter((i) => !i.interview_date && !i.created_at);
	if (interviewsWithoutDates.length > 0) {
		warnings.push(`${interviewsWithoutDates.length} interviews have no date information`);
	}

	const interviewsWithoutAnyIdentifier = interviewsWithoutPeople.filter(
		(i) => !i.participant_pseudonym && !i.title && !i.segment
	);
	if (interviewsWithoutAnyIdentifier.length > 0) {
		warnings.push(`${interviewsWithoutAnyIdentifier.length} interviews have no identifying information`);
	}

	return {
		isValid: true, // We can always proceed, but with warnings
		warnings,
	};
}

/**
 * Estimate the impact of a backfill operation
 */
export function estimateBackfillImpact(
	interviews: Interview[],
	existingLinks: InterviewPeopleLink[]
): {
	interviewsToProcess: number;
	estimatedPeopleToCreate: number;
	estimatedLinksToCreate: number;
	potentialDuplicates: number;
} {
	const interviewsWithoutPeople = identifyInterviewsWithoutPeople(interviews, existingLinks);
	const groups = groupInterviewsByPotentialPerson(interviewsWithoutPeople);

	// Estimate one person per group (potential deduplication)
	const estimatedPeopleToCreate = groups.size;
	const estimatedLinksToCreate = interviewsWithoutPeople.length;

	// Count groups with multiple interviews (potential duplicates)
	const potentialDuplicates = Array.from(groups.values()).filter((group) => group.length > 1).length;

	return {
		interviewsToProcess: interviewsWithoutPeople.length,
		estimatedPeopleToCreate,
		estimatedLinksToCreate,
		potentialDuplicates,
	};
}
