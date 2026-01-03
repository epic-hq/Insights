/**
 * useJourneyProgress - Track onboarding journey progress
 *
 * Determines completion status for:
 * - Context: research_goal is set in project_context
 * - Prompts: interview_prompts exist for the project
 * - Conversations: interviews exist
 * - Insights: insights with evidence exist
 *
 * Used by JourneySidebarGroup to show progress during onboarding.
 */

import { useEffect, useState } from "react"
import { createClient } from "~/lib/supabase/client"

export interface JourneyProgress {
	contextComplete: boolean
	promptsComplete: boolean
	hasConversations: boolean
	hasInsights: boolean
}

export function useJourneyProgress(projectId?: string) {
	const [progress, setProgress] = useState<JourneyProgress>({
		contextComplete: false,
		promptsComplete: false,
		hasConversations: false,
		hasInsights: false,
	})
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		if (!projectId) {
			setProgress({
				contextComplete: false,
				promptsComplete: false,
				hasConversations: false,
				hasInsights: false,
			})
			setLoading(false)
			return
		}

		let isCancelled = false

		;(async () => {
			setLoading(true)
			try {
				const supabase = createClient()

				const [contextResult, promptsResult, interviewsResult, insightsResult] = await Promise.all([
					// Check if project_context has research_goal
					supabase
						.from("project_context")
						.select("merged")
						.eq("project_id", projectId)
						.single(),

					// Check if interview_prompts exist
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
				])

				if (!isCancelled) {
					// Context is complete if research_goal exists and is non-empty
					const merged = contextResult.data?.merged as Record<string, unknown> | null
					const researchGoal = merged?.research_goal
					const contextComplete = typeof researchGoal === "string" && researchGoal.trim().length > 0

					setProgress({
						contextComplete,
						promptsComplete: (promptsResult.count ?? 0) > 0,
						hasConversations: (interviewsResult.count ?? 0) > 0,
						hasInsights: (insightsResult.data?.length ?? 0) > 0,
					})
				}
			} catch (error) {
				console.error("[useJourneyProgress] Error fetching progress:", error)
				if (!isCancelled) {
					setProgress({
						contextComplete: false,
						promptsComplete: false,
						hasConversations: false,
						hasInsights: false,
					})
				}
			} finally {
				if (!isCancelled) {
					setLoading(false)
				}
			}
		})()

		return () => {
			isCancelled = true
		}
	}, [projectId])

	// Derived completion states
	const planComplete = progress.contextComplete && progress.promptsComplete
	const collectComplete = progress.hasConversations
	const allComplete = planComplete && collectComplete && progress.hasInsights

	return {
		progress,
		planComplete,
		collectComplete,
		allComplete,
		loading,
	}
}
