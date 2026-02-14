/**
 * Step completion logic for project setup
 *
 * Determines which steps are complete based on section data.
 * Used to show progress in the step rail.
 */

import type { ProjectSectionData, SetupStep } from "../stores/project-setup-store";

interface StepCompletionStatus {
	define: boolean;
	design: boolean;
	collect: boolean;
	synthesize: boolean;
	prioritize: boolean;
}

/**
 * Determine completion status for each step
 *
 * A step is considered complete when its required fields have meaningful values.
 */
export function getStepCompletion(sections: ProjectSectionData): StepCompletionStatus {
	return {
		// Define: Research goal AND at least one decision question OR unknown
		define: Boolean(
			sections.research_goal?.trim() && (sections.decision_questions?.length > 0 || sections.unknowns?.length > 0)
		),

		// Design: Has interview prompts/questions ready
		// This will be determined by interview_prompts count
		design: false, // TODO: Check interview_prompts table

		// Collect: Has at least one response/interview
		collect: false, // TODO: Check interviews count

		// Synthesize: Lenses have been applied with results
		synthesize: false, // TODO: Check lens_summaries

		// Prioritize: Insights have been reviewed/prioritized
		prioritize: false, // TODO: Check insight prioritization
	};
}

/**
 * Get list of completed step IDs
 */
export function getCompletedSteps(sections: ProjectSectionData): SetupStep[] {
	const completion = getStepCompletion(sections);
	return (Object.entries(completion) as [SetupStep, boolean][])
		.filter(([, isComplete]) => isComplete)
		.map(([step]) => step);
}

/**
 * Calculate overall progress percentage
 */
export function getProgressPercentage(sections: ProjectSectionData): number {
	const completion = getStepCompletion(sections);
	const completedCount = Object.values(completion).filter(Boolean).length;
	return Math.round((completedCount / 5) * 100);
}

/**
 * Get the first incomplete step
 * Useful for auto-navigating to the next step to complete
 */
export function getNextIncompleteStep(sections: ProjectSectionData): SetupStep | null {
	const completion = getStepCompletion(sections);
	const steps: SetupStep[] = ["define", "design", "collect", "synthesize", "prioritize"];

	for (const step of steps) {
		if (!completion[step]) {
			return step;
		}
	}

	return null; // All steps complete
}

/**
 * Check if a specific step has required fields filled
 */
export function isStepReady(sections: ProjectSectionData, step: SetupStep): boolean {
	const completion = getStepCompletion(sections);
	return completion[step];
}

/**
 * Get detailed field status for a step
 * Useful for showing which fields are missing
 */
export function getStepFieldStatus(sections: ProjectSectionData, step: SetupStep) {
	switch (step) {
		case "define":
			return {
				research_goal: Boolean(sections.research_goal?.trim()),
				decision_questions: sections.decision_questions?.length > 0,
				assumptions: sections.assumptions?.length > 0,
				unknowns: sections.unknowns?.length > 0,
			};

		case "design":
			return {
				// Interview questions/prompts ready
				// TODO: Check interview_prompts count
			};

		case "collect":
			return {
				// Response/interview count
				// TODO: Check interviews table
			};

		case "synthesize":
			return {
				// Lens analysis status
				// TODO: Check lens_summaries
			};

		case "prioritize":
			return {
				// Insight prioritization status
				// TODO: Check insights table for priority field
			};

		default:
			return {};
	}
}
