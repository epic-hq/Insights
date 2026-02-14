/**
 * useJourneyProgress - Track onboarding journey progress
 *
 * Determines completion status for:
 * - Context: research_goal is set in project_sections
 * - Prompts: interview_prompts exist for the project
 * - Conversations: interviews exist
 * - Insights: insights with evidence exist
 *
 * Also provides detailed field counts for progress indicators.
 * Used by JourneySidebarGroup to show progress during onboarding.
 */

import { useEffect, useState } from "react";
import { createClient } from "~/lib/supabase/client";

// Context fields we track for progress with human-readable labels
const CONTEXT_FIELDS = [
	{ key: "research_goal", label: "Research Goal" },
	{ key: "target_roles", label: "Target Roles" },
	{ key: "target_orgs", label: "Target Orgs" },
	{ key: "assumptions", label: "Assumptions" },
	{ key: "unknowns", label: "Unknowns" },
] as const;

export interface FieldStatus {
	key: string;
	label: string;
	filled: boolean;
}

export interface JourneyProgress {
	contextComplete: boolean;
	promptsComplete: boolean;
	hasConversations: boolean;
	hasInsights: boolean;
	// Detailed counts for progress indicators
	contextFieldsFilled: number;
	contextFieldsTotal: number;
	contextFields: FieldStatus[];
	promptsCount: number;
}

// Default field statuses (all empty)
const defaultContextFields: FieldStatus[] = CONTEXT_FIELDS.map((f) => ({
	key: f.key,
	label: f.label,
	filled: false,
}));

export function useJourneyProgress(projectId?: string) {
	const [progress, setProgress] = useState<JourneyProgress>({
		contextComplete: false,
		promptsComplete: false,
		hasConversations: false,
		hasInsights: false,
		contextFieldsFilled: 0,
		contextFieldsTotal: CONTEXT_FIELDS.length,
		contextFields: defaultContextFields,
		promptsCount: 0,
	});
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (!projectId) {
			setProgress({
				contextComplete: false,
				promptsComplete: false,
				hasConversations: false,
				hasInsights: false,
				contextFieldsFilled: 0,
				contextFieldsTotal: CONTEXT_FIELDS.length,
				contextFields: defaultContextFields,
				promptsCount: 0,
			});
			setLoading(false);
			return;
		}

		let isCancelled = false;

		(async () => {
			setLoading(true);
			try {
				const supabase = createClient();

				const fieldKeys = CONTEXT_FIELDS.map((f) => f.key);

				const [sectionsResult, promptsResult, interviewsResult, insightsResult] = await Promise.all([
					// Get all context-related project_sections
					supabase
						.from("project_sections")
						.select("kind, meta")
						.eq("project_id", projectId)
						.in("kind", fieldKeys),

					// Get count of interview_prompts
					supabase
						.from("interview_prompts")
						.select("id", { count: "exact", head: true })
						.eq("project_id", projectId),

					// Check if interviews exist
					supabase
						.from("interviews")
						.select("id", { count: "exact", head: true })
						.eq("project_id", projectId),

					// Check if insights with evidence exist
					supabase
						.from("theme_evidence")
						.select("theme_id")
						.eq("project_id", projectId)
						.limit(1),
				]);

				if (!isCancelled) {
					// Build field status array with filled/unfilled status
					const sections = sectionsResult.data || [];
					const contextFields: FieldStatus[] = [];
					let filledFields = 0;

					for (const fieldDef of CONTEXT_FIELDS) {
						const section = sections.find((s) => s.kind === fieldDef.key);
						let filled = false;

						if (section) {
							const meta = section.meta as Record<string, unknown> | null;
							const value = meta?.[fieldDef.key];

							// Check if field has a meaningful value
							if (typeof value === "string" && value.trim().length > 0) {
								filled = true;
								filledFields++;
							} else if (Array.isArray(value) && value.length > 0) {
								filled = true;
								filledFields++;
							}
						}

						contextFields.push({
							key: fieldDef.key,
							label: fieldDef.label,
							filled,
						});
					}

					// Context is complete if research_goal exists (minimum requirement)
					const researchGoalSection = sections.find((s) => s.kind === "research_goal");
					const meta = researchGoalSection?.meta as Record<string, unknown> | null;
					const researchGoal = meta?.research_goal;
					const contextComplete = typeof researchGoal === "string" && researchGoal.trim().length > 0;

					const promptsCount = promptsResult.count ?? 0;

					setProgress({
						contextComplete,
						promptsComplete: promptsCount > 0,
						hasConversations: (interviewsResult.count ?? 0) > 0,
						hasInsights: (insightsResult.data?.length ?? 0) > 0,
						contextFieldsFilled: filledFields,
						contextFieldsTotal: CONTEXT_FIELDS.length,
						contextFields,
						promptsCount,
					});
				}
			} catch (error) {
				console.error("[useJourneyProgress] Error fetching progress:", error);
				if (!isCancelled) {
					setProgress({
						contextComplete: false,
						promptsComplete: false,
						hasConversations: false,
						hasInsights: false,
						contextFieldsFilled: 0,
						contextFieldsTotal: CONTEXT_FIELDS.length,
						contextFields: defaultContextFields,
						promptsCount: 0,
					});
				}
			} finally {
				if (!isCancelled) {
					setLoading(false);
				}
			}
		})();

		return () => {
			isCancelled = true;
		};
	}, [projectId]);

	// Derived completion states
	const planComplete = progress.contextComplete && progress.promptsComplete;
	const collectComplete = progress.hasConversations;
	const allComplete = planComplete && collectComplete && progress.hasInsights;

	return {
		progress,
		planComplete,
		collectComplete,
		allComplete,
		loading,
	};
}
