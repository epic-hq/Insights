/**
 * Tests for journey map configuration — phase state determination and card completion.
 * Pure function tests, no mocking needed.
 */

import { describe, expect, it } from "vitest";
import { getCompletedCardCount, getPhaseState, getTotalCards, isCardComplete, JOURNEY_PHASES } from "./journey-config";

const emptyJourneyProgress = {
	contextComplete: false,
	promptsComplete: false,
	hasConversations: false,
	hasInsights: false,
};

const fullJourneyProgress = {
	contextComplete: true,
	promptsComplete: true,
	hasConversations: true,
	hasInsights: true,
};

describe("JOURNEY_PHASES config", () => {
	it("should have 4 phases", () => {
		expect(JOURNEY_PHASES).toHaveLength(4);
	});

	it("should have sequential phase numbers", () => {
		const numbers = JOURNEY_PHASES.map((p) => p.number);
		expect(numbers).toEqual([1, 2, 3, 4]);
	});

	it("should have unique phase ids", () => {
		const ids = JOURNEY_PHASES.map((p) => p.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("should have at least one card per phase", () => {
		for (const phase of JOURNEY_PHASES) {
			expect(phase.cards.length).toBeGreaterThan(0);
		}
	});
});

describe("getTotalCards", () => {
	it("should return total count of all cards across phases", () => {
		const total = getTotalCards();
		const manual = JOURNEY_PHASES.reduce((sum, p) => sum + p.cards.length, 0);
		expect(total).toBe(manual);
		expect(total).toBeGreaterThan(0);
	});
});

describe("isCardComplete", () => {
	it("should return false when no completion criteria are met", () => {
		const card = JOURNEY_PHASES[0].cards[0]; // "Context & Goals"
		expect(isCardComplete(card, {}, emptyJourneyProgress)).toBe(false);
	});

	it("should use completionCheck when provided", () => {
		// Phase 1, card 0: Context & Goals
		const card = JOURNEY_PHASES[0].cards[0];
		expect(card.completionCheck).toBeDefined();

		// Requires both contextComplete AND promptsComplete
		expect(isCardComplete(card, {}, { ...emptyJourneyProgress, contextComplete: true })).toBe(false);
		expect(isCardComplete(card, {}, { ...emptyJourneyProgress, promptsComplete: true })).toBe(false);
		expect(
			isCardComplete(
				card,
				{},
				{
					...emptyJourneyProgress,
					contextComplete: true,
					promptsComplete: true,
				}
			)
		).toBe(true);
	});

	it("should use completionKey when provided", () => {
		// Phase 1, card 1: Create a survey → completionKey: "surveyResponses"
		const card = JOURNEY_PHASES[0].cards[1];
		expect(card.completionKey).toBe("surveyResponses");

		expect(isCardComplete(card, {}, emptyJourneyProgress)).toBe(false);
		expect(isCardComplete(card, { surveyResponses: 0 }, emptyJourneyProgress)).toBe(false);
		expect(isCardComplete(card, { surveyResponses: 1 }, emptyJourneyProgress)).toBe(true);
		expect(isCardComplete(card, { surveyResponses: 10 }, emptyJourneyProgress)).toBe(true);
	});

	it("should return false when card has no completion criteria", () => {
		// Create a dummy card with neither completionKey nor completionCheck
		const dummyCard = {
			id: "test",
			title: "Test",
			icon: JOURNEY_PHASES[0].icon,
			cta: "Test",
			getRoute: () => "/test",
		};
		expect(isCardComplete(dummyCard, { test: 5 }, fullJourneyProgress)).toBe(false);
	});
});

describe("getPhaseState", () => {
	it("should return 'active' for the first phase with empty data", () => {
		const state = getPhaseState(0, {}, emptyJourneyProgress);
		expect(state).toBe("active");
	});

	it("should return 'upcoming' for phase 1 when phase 0 is incomplete", () => {
		const state = getPhaseState(1, {}, emptyJourneyProgress);
		expect(state).toBe("upcoming");
	});

	it("should return 'locked' for phase 2+ when phase 0 is incomplete", () => {
		const state2 = getPhaseState(2, {}, emptyJourneyProgress);
		expect(state2).toBe("locked");

		const state3 = getPhaseState(3, {}, emptyJourneyProgress);
		expect(state3).toBe("locked");
	});

	it("should return 'completed' when phase isComplete returns true", () => {
		// Phase 0 (setup) requires: contextComplete, promptsComplete, surveyResponses > 0, people > 0
		const counts = { surveyResponses: 1, people: 3 };
		const jp = {
			...emptyJourneyProgress,
			contextComplete: true,
			promptsComplete: true,
		};
		const state = getPhaseState(0, counts, jp);
		expect(state).toBe("completed");
	});

	it("should return 'active' for first incomplete phase after completed ones", () => {
		// Phase 0 complete, phase 1 incomplete
		const counts = { surveyResponses: 1, people: 3, encounters: 0 };
		const jp = {
			...emptyJourneyProgress,
			contextComplete: true,
			promptsComplete: true,
		};
		const state = getPhaseState(1, counts, jp);
		expect(state).toBe("active");
	});

	it("should handle all phases completed", () => {
		const counts = {
			surveyResponses: 5,
			people: 10,
			encounters: 5,
			themes: 3,
			insights: 2,
			highPriorityTasks: 1,
		};
		const jp = fullJourneyProgress;

		for (let i = 0; i < JOURNEY_PHASES.length; i++) {
			const state = getPhaseState(i, counts, jp);
			expect(state).toBe("completed");
		}
	});
});

describe("getCompletedCardCount", () => {
	it("should return 0 with empty data", () => {
		expect(getCompletedCardCount({}, emptyJourneyProgress)).toBe(0);
	});

	it("should count completed cards across all phases", () => {
		const counts = {
			surveyResponses: 1,
			people: 3,
			encounters: 5,
			content: 2,
			themes: 1,
		};
		const jp = {
			...emptyJourneyProgress,
			contextComplete: true,
			promptsComplete: true,
		};

		const completed = getCompletedCardCount(counts, jp);
		expect(completed).toBeGreaterThan(0);
		expect(completed).toBeLessThanOrEqual(getTotalCards());
	});

	it("should max out at total card count", () => {
		// Provide data that should complete every possible card
		const counts = {
			surveyResponses: 10,
			people: 10,
			encounters: 10,
			content: 10,
			themes: 10,
			insights: 10,
			highPriorityTasks: 10,
		};
		const jp = fullJourneyProgress;

		const completed = getCompletedCardCount(counts, jp);
		// Not all cards can be completed (e.g., "Share a finding" always returns false)
		expect(completed).toBeLessThanOrEqual(getTotalCards());
		expect(completed).toBeGreaterThan(0);
	});
});

describe("Phase isComplete functions", () => {
	it("Phase 1 (setup): requires context, prompts, surveys, and people", () => {
		const phase = JOURNEY_PHASES[0];

		expect(phase.isComplete({}, emptyJourneyProgress)).toBe(false);
		expect(
			phase.isComplete(
				{ surveyResponses: 1, people: 1 },
				{
					...emptyJourneyProgress,
					contextComplete: true,
					promptsComplete: true,
				}
			)
		).toBe(true);
		// Missing people
		expect(
			phase.isComplete(
				{ surveyResponses: 1 },
				{
					...emptyJourneyProgress,
					contextComplete: true,
					promptsComplete: true,
				}
			)
		).toBe(false);
		// Missing survey responses
		expect(
			phase.isComplete(
				{ people: 1 },
				{
					...emptyJourneyProgress,
					contextComplete: true,
					promptsComplete: true,
				}
			)
		).toBe(false);
	});

	it("Phase 2 (gather): requires 3+ encounters", () => {
		const phase = JOURNEY_PHASES[1];

		expect(phase.isComplete({}, emptyJourneyProgress)).toBe(false);
		expect(phase.isComplete({ encounters: 2 }, emptyJourneyProgress)).toBe(false);
		expect(phase.isComplete({ encounters: 3 }, emptyJourneyProgress)).toBe(true);
		expect(phase.isComplete({ encounters: 10 }, emptyJourneyProgress)).toBe(true);
	});

	it("Phase 3 (patterns): requires themes and insights", () => {
		const phase = JOURNEY_PHASES[2];

		expect(phase.isComplete({}, emptyJourneyProgress)).toBe(false);
		expect(phase.isComplete({ themes: 1 }, emptyJourneyProgress)).toBe(false);
		expect(phase.isComplete({ insights: 1 }, emptyJourneyProgress)).toBe(false);
		expect(phase.isComplete({ themes: 1, insights: 1 }, emptyJourneyProgress)).toBe(true);
	});

	it("Phase 4 (action): requires high priority tasks", () => {
		const phase = JOURNEY_PHASES[3];

		expect(phase.isComplete({}, emptyJourneyProgress)).toBe(false);
		expect(phase.isComplete({ highPriorityTasks: 0 }, emptyJourneyProgress)).toBe(false);
		expect(phase.isComplete({ highPriorityTasks: 1 }, emptyJourneyProgress)).toBe(true);
	});
});
