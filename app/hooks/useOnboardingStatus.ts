/**
 * useOnboardingStatus - Hook to check and manage onboarding walkthrough status
 *
 * Checks if the user has completed the onboarding walkthrough
 * and provides data for personalizing the AI experience.
 */

import { useEffect, useState } from "react"
import { useFetcher, useRouteLoaderData } from "react-router"

export interface OnboardingStatus {
	/** Whether onboarding data has loaded */
	isLoading: boolean
	/** Whether the walkthrough has been completed */
	completed: boolean
	/** User's job function/role */
	jobFunction: string
	/** Primary use case selected */
	primaryUseCase: string
	/** Team size */
	teamSize: string
	/** User's stated goals */
	goals: string
	/** Whether to show the onboarding modal */
	shouldShowOnboarding: boolean
}

interface ProtectedLayoutData {
	user_settings?: {
		onboarding_steps?: {
			walkthrough?: {
				completed?: boolean
				job_function?: string
				primary_use_case?: string
				team_size?: string
				goals?: string
			}
		}
		metadata?: {
			onboarding?: {
				job_function?: string
				primary_use_case?: string
				team_size?: string
				goals?: string
			}
		}
	} | null
}

/**
 * Hook to get onboarding status from route loader data
 * Avoids extra API calls by using data already loaded in _ProtectedLayout
 */
export function useOnboardingStatus(): OnboardingStatus {
	const protectedData = useRouteLoaderData("routes/_ProtectedLayout") as ProtectedLayoutData | null

	const onboardingSteps = protectedData?.user_settings?.onboarding_steps
	const walkthrough = onboardingSteps?.walkthrough
	const metadata = protectedData?.user_settings?.metadata?.onboarding

	// Use walkthrough data or metadata as fallback
	const completed = walkthrough?.completed || false
	const jobFunction = walkthrough?.job_function || metadata?.job_function || ""
	const primaryUseCase = walkthrough?.primary_use_case || metadata?.primary_use_case || ""
	const teamSize = walkthrough?.team_size || metadata?.team_size || ""
	const goals = walkthrough?.goals || metadata?.goals || ""

	// Show onboarding if not completed and we have data loaded
	const shouldShowOnboarding = protectedData !== null && !completed

	return {
		isLoading: protectedData === null,
		completed,
		jobFunction,
		primaryUseCase,
		teamSize,
		goals,
		shouldShowOnboarding,
	}
}

/**
 * Build AI context string from onboarding data
 * This can be passed to the AI chat system context
 */
export function buildOnboardingContext(status: OnboardingStatus): string {
	if (!status.completed) {
		return ""
	}

	const parts: string[] = []

	if (status.jobFunction) {
		const roleMap: Record<string, string> = {
			founder: "founder/CEO",
			product: "product manager",
			sales: "sales professional",
			research: "UX researcher",
			marketing: "marketing professional",
			other: "professional",
		}
		parts.push(`User Role: ${roleMap[status.jobFunction] || status.jobFunction}`)
	}

	if (status.primaryUseCase) {
		const useCaseMap: Record<string, string> = {
			customer_discovery: "customer discovery and validation",
			sales_intelligence: "sales intelligence and deal tracking",
			user_research: "user research and synthesis",
			competitive_intel: "competitive intelligence",
			customer_success: "customer success and feedback tracking",
		}
		parts.push(`Primary Goal: ${useCaseMap[status.primaryUseCase] || status.primaryUseCase}`)
	}

	if (status.teamSize) {
		const teamMap: Record<string, string> = {
			solo: "working solo",
			small: "small team (2-5)",
			medium: "medium team (6-20)",
			large: "large team (20+)",
		}
		parts.push(`Team: ${teamMap[status.teamSize] || status.teamSize}`)
	}

	if (status.goals) {
		parts.push(`Stated Goals: ${status.goals}`)
	}

	if (parts.length === 0) {
		return ""
	}

	return `User Profile:\n${parts.join("\n")}`
}

export default useOnboardingStatus
