/**
 * Unit tests for pure backfill statistics functions
 * No mocks needed - testing business logic directly
 */

import { describe, expect, it } from "vitest";
import {
	calculateBackfillStats,
	calculatePersonCreationPriority,
	estimateBackfillImpact,
	groupInterviewsByPotentialPerson,
	type Interview,
	type InterviewPeopleLink,
	identifyInterviewsWithoutPeople,
	type Person,
	prioritizeInterviewsForPersonCreation,
	validateBackfillOperation,
} from "./backfillStats";

describe("Backfill Statistics Logic", () => {
	const mockInterviews: Interview[] = [
		{
			id: "interview-1",
			title: "Customer Discovery Session",
			participant_pseudonym: "Sarah Chen",
			segment: "enterprise",
			interview_date: "2025-01-20",
			created_at: "2025-01-20T14:30:00Z",
		},
		{
			id: "interview-2",
			title: "Interview - 2025-01-21",
			participant_pseudonym: null,
			segment: "consumer",
			interview_date: "2025-01-21",
			created_at: "2025-01-21T09:15:00Z",
		},
		{
			id: "interview-3",
			title: "Product Feedback Call",
			participant_pseudonym: null,
			segment: null,
			interview_date: null,
			created_at: "2025-01-22T16:45:00Z",
		},
		{
			id: "interview-4",
			title: null,
			participant_pseudonym: "Sarah Chen", // Same as interview-1
			segment: null,
			interview_date: null,
			created_at: "2025-01-23T11:20:00Z",
		},
	];

	const mockPeople: Person[] = [
		{ id: "person-1", name: "Sarah Chen", account_id: "account-123" },
		{ id: "person-2", name: "John Doe", account_id: "account-123" },
		{ id: "person-3", name: "Sarah Chen", account_id: "account-123" }, // Duplicate
	];

	const mockLinks: InterviewPeopleLink[] = [{ interview_id: "interview-1", person_id: "person-1" }];

	describe("calculateBackfillStats", () => {
		it("should calculate correct statistics", () => {
			const stats = calculateBackfillStats(mockInterviews, mockPeople, mockLinks);

			expect(stats).toEqual({
				totalInterviews: 4,
				totalPeople: 3,
				interviewsWithPeople: 1, // Only interview-1 is linked
				interviewsWithoutPeople: 3,
				duplicatePeople: 1, // "Sarah Chen" appears twice
			});
		});

		it("should handle empty arrays", () => {
			const stats = calculateBackfillStats([], [], []);

			expect(stats).toEqual({
				totalInterviews: 0,
				totalPeople: 0,
				interviewsWithPeople: 0,
				interviewsWithoutPeople: 0,
				duplicatePeople: 0,
			});
		});

		it("should handle duplicate links correctly", () => {
			const duplicateLinks: InterviewPeopleLink[] = [
				{ interview_id: "interview-1", person_id: "person-1" },
				{ interview_id: "interview-1", person_id: "person-2" }, // Same interview, different person
				{ interview_id: "interview-1", person_id: "person-1" }, // Duplicate
			];

			const stats = calculateBackfillStats(mockInterviews, mockPeople, duplicateLinks);
			expect(stats.interviewsWithPeople).toBe(1); // Should count interview-1 only once
		});
	});

	describe("identifyInterviewsWithoutPeople", () => {
		it("should identify interviews without people links", () => {
			const result = identifyInterviewsWithoutPeople(mockInterviews, mockLinks);

			expect(result).toHaveLength(3);
			expect(result.map((i) => i.id)).toEqual(["interview-2", "interview-3", "interview-4"]);
		});

		it("should return empty array when all interviews have people", () => {
			const allLinked: InterviewPeopleLink[] = [
				{ interview_id: "interview-1", person_id: "person-1" },
				{ interview_id: "interview-2", person_id: "person-2" },
				{ interview_id: "interview-3", person_id: "person-3" },
				{ interview_id: "interview-4", person_id: "person-1" },
			];

			const result = identifyInterviewsWithoutPeople(mockInterviews, allLinked);
			expect(result).toHaveLength(0);
		});

		it("should return all interviews when no links exist", () => {
			const result = identifyInterviewsWithoutPeople(mockInterviews, []);
			expect(result).toHaveLength(4);
		});
	});

	describe("groupInterviewsByPotentialPerson", () => {
		it("should group by participant pseudonym", () => {
			const groups = groupInterviewsByPotentialPerson(mockInterviews);

			expect(groups.get("Sarah Chen")).toHaveLength(2);
			expect(groups.get("Sarah Chen")?.map((i) => i.id)).toEqual(["interview-1", "interview-4"]);
			expect(groups.get("consumer")).toHaveLength(1);
			expect(groups.get("unknown")).toHaveLength(1);
		});

		it("should handle interviews with no identifying information", () => {
			const interviews: Interview[] = [
				{
					id: "interview-1",
					title: null,
					participant_pseudonym: null,
					segment: null,
					interview_date: null,
					created_at: "2025-01-20T14:30:00Z",
				},
			];

			const groups = groupInterviewsByPotentialPerson(interviews);
			expect(groups.get("unknown")).toHaveLength(1);
		});
	});

	describe("calculatePersonCreationPriority", () => {
		it("should give highest priority to interviews with pseudonyms", () => {
			const priority = calculatePersonCreationPriority(mockInterviews[0]); // Has pseudonym
			expect(priority).toBeGreaterThan(100);
		});

		it("should give medium priority to meaningful titles", () => {
			const interview: Interview = {
				id: "interview-1",
				title: "Customer Research Session",
				participant_pseudonym: null,
				segment: "enterprise",
				interview_date: "2025-01-25",
				created_at: "2025-01-25T10:00:00Z",
			};

			const priority = calculatePersonCreationPriority(interview);
			expect(priority).toBe(85); // 50 (title) + 25 (segment) + 10 (date)
		});

		it("should give low priority to generic interviews", () => {
			const interview: Interview = {
				id: "interview-1",
				title: "Interview - Generic",
				participant_pseudonym: null,
				segment: null,
				interview_date: null,
				created_at: "2025-01-01T10:00:00Z", // Old interview
			};

			const priority = calculatePersonCreationPriority(interview);
			expect(priority).toBe(0); // No meaningful data
		});

		it("should give bonus to recent interviews", () => {
			const recentInterview: Interview = {
				id: "interview-1",
				title: null,
				participant_pseudonym: null,
				segment: null,
				interview_date: null,
				created_at: new Date().toISOString(), // Today
			};

			const priority = calculatePersonCreationPriority(recentInterview);
			expect(priority).toBe(5); // Recent bonus
		});
	});

	describe("prioritizeInterviewsForPersonCreation", () => {
		it("should sort interviews by priority", () => {
			const sorted = prioritizeInterviewsForPersonCreation(mockInterviews);

			// First should be interview with pseudonym
			expect(sorted[0].participant_pseudonym).toBe("Sarah Chen");

			// Should maintain original array
			expect(mockInterviews[0].id).toBe("interview-1"); // Original unchanged
		});
	});

	describe("validateBackfillOperation", () => {
		it("should validate normal backfill operation", () => {
			const validation = validateBackfillOperation(mockInterviews, mockLinks);

			expect(validation.isValid).toBe(true);
			expect(validation.warnings).toHaveLength(0);
		});

		it("should warn when no backfill needed", () => {
			const allLinked: InterviewPeopleLink[] = [
				{ interview_id: "interview-1", person_id: "person-1" },
				{ interview_id: "interview-2", person_id: "person-2" },
				{ interview_id: "interview-3", person_id: "person-3" },
				{ interview_id: "interview-4", person_id: "person-1" },
			];

			const validation = validateBackfillOperation(mockInterviews, allLinked);

			expect(validation.isValid).toBe(true);
			expect(validation.warnings).toContain("No interviews need backfilling - all interviews already have people");
		});

		it("should warn about large operations", () => {
			const manyInterviews = Array.from({ length: 150 }, (_, i) => ({
				id: `interview-${i}`,
				title: `Interview ${i}`,
				participant_pseudonym: null,
				segment: null,
				interview_date: "2025-01-25",
				created_at: "2025-01-25T10:00:00Z",
			}));

			const validation = validateBackfillOperation(manyInterviews, []);

			expect(validation.warnings).toContain("Large backfill operation: 150 interviews need people");
		});

		it("should warn about missing data", () => {
			const problematicInterviews: Interview[] = [
				{
					id: "interview-1",
					title: null,
					participant_pseudonym: null,
					segment: null,
					interview_date: null,
					created_at: "", // Missing date
				},
				{
					id: "interview-2",
					title: null,
					participant_pseudonym: null,
					segment: null,
					interview_date: "2025-01-25",
					created_at: "2025-01-25T10:00:00Z",
				},
			];

			const validation = validateBackfillOperation(problematicInterviews, []);

			expect(validation.warnings).toContain("1 interviews have no date information");
			expect(validation.warnings).toContain("2 interviews have no identifying information");
		});
	});

	describe("estimateBackfillImpact", () => {
		it("should estimate backfill impact correctly", () => {
			const impact = estimateBackfillImpact(mockInterviews, mockLinks);

			expect(impact.interviewsToProcess).toBe(3); // 3 interviews without people
			expect(impact.estimatedLinksToCreate).toBe(3); // One link per interview
			expect(impact.estimatedPeopleToCreate).toBe(3); // 3 groups: 'consumer', 'unknown', 'Sarah Chen'
			expect(impact.potentialDuplicates).toBe(0); // Current implementation groups differently
		});

		it("should handle no backfill needed", () => {
			const allLinked: InterviewPeopleLink[] = [
				{ interview_id: "interview-1", person_id: "person-1" },
				{ interview_id: "interview-2", person_id: "person-2" },
				{ interview_id: "interview-3", person_id: "person-3" },
				{ interview_id: "interview-4", person_id: "person-1" },
			];

			const impact = estimateBackfillImpact(mockInterviews, allLinked);

			expect(impact.interviewsToProcess).toBe(0);
			expect(impact.estimatedPeopleToCreate).toBe(0);
			expect(impact.estimatedLinksToCreate).toBe(0);
			expect(impact.potentialDuplicates).toBe(0);
		});

		it("should estimate deduplication opportunities", () => {
			const interviews: Interview[] = [
				{
					id: "i1",
					participant_pseudonym: "John Doe",
					title: null,
					segment: null,
					interview_date: null,
					created_at: "2025-01-20T10:00:00Z",
				},
				{
					id: "i2",
					participant_pseudonym: "John Doe",
					title: null,
					segment: null,
					interview_date: null,
					created_at: "2025-01-21T10:00:00Z",
				},
				{
					id: "i3",
					participant_pseudonym: "Jane Smith",
					title: null,
					segment: null,
					interview_date: null,
					created_at: "2025-01-22T10:00:00Z",
				},
				{
					id: "i4",
					participant_pseudonym: "Jane Smith",
					title: null,
					segment: null,
					interview_date: null,
					created_at: "2025-01-23T10:00:00Z",
				},
				{
					id: "i5",
					participant_pseudonym: null,
					title: null,
					segment: "enterprise",
					interview_date: null,
					created_at: "2025-01-24T10:00:00Z",
				},
			];

			const impact = estimateBackfillImpact(interviews, []);

			expect(impact.interviewsToProcess).toBe(5);
			expect(impact.estimatedPeopleToCreate).toBe(3); // John Doe, Jane Smith, enterprise
			expect(impact.estimatedLinksToCreate).toBe(5);
			expect(impact.potentialDuplicates).toBe(2); // John Doe and Jane Smith groups
		});
	});
});
