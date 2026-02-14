/**
 * useOnboardingStatus - Hook to check and manage onboarding walkthrough status
 *
 * Checks if the user has completed the onboarding walkthrough
 * and provides data for personalizing the AI experience.
 */

import { useRouteLoaderData } from "react-router";

export interface OnboardingStatus {
	/** Whether onboarding data has loaded */
	isLoading: boolean;
	/** Whether the walkthrough has been completed */
	completed: boolean;
	/** User's job function/role */
	jobFunction: string;
	/** Primary use case selected */
	primaryUseCase: string;
	/** Company size category (startup, smb, mid-market, enterprise) */
	companySize: string;
	/** Whether to show the onboarding modal */
	shouldShowOnboarding: boolean;
}

interface ProtectedLayoutData {
	user_settings?: {
		/** Boolean column on user_settings table */
		onboarding_completed?: boolean;
		onboarding_steps?: {
			walkthrough?: {
				completed?: boolean;
				job_function?: string;
				primary_use_case?: string;
				company_size?: string;
			};
		};
		metadata?: {
			onboarding?: {
				job_function?: string;
				primary_use_case?: string;
				company_size?: string;
			};
		};
	} | null;
}

/**
 * Hook to get onboarding status from route loader data
 * Avoids extra API calls by using data already loaded in _ProtectedLayout
 */
export function useOnboardingStatus(): OnboardingStatus {
	const protectedData = useRouteLoaderData("routes/_ProtectedLayout") as ProtectedLayoutData | null;

	const onboardingSteps = protectedData?.user_settings?.onboarding_steps;
	const walkthrough = onboardingSteps?.walkthrough;
	const metadata = protectedData?.user_settings?.metadata?.onboarding;

	// Check both the boolean column and the JSONB walkthrough data
	const completed = protectedData?.user_settings?.onboarding_completed || walkthrough?.completed || false;
	const jobFunction = walkthrough?.job_function || metadata?.job_function || "";
	const primaryUseCase = walkthrough?.primary_use_case || metadata?.primary_use_case || "";
	const companySize = walkthrough?.company_size || metadata?.company_size || "";

	// Show onboarding if not completed and we have data loaded
	const shouldShowOnboarding = protectedData !== null && !completed;

	return {
		isLoading: protectedData === null,
		completed,
		jobFunction,
		primaryUseCase,
		companySize,
		shouldShowOnboarding,
	};
}

/**
 * Build AI context string from onboarding data
 * This can be passed to the AI chat system context
 */
export function buildOnboardingContext(status: OnboardingStatus): string {
	if (!status.completed) {
		return "";
	}

	const parts: string[] = [];

	if (status.jobFunction) {
		// Map to friendly descriptions for AI context
		const roleMap: Record<string, string> = {
			engineering: "engineering professional",
			product: "product manager",
			design: "designer",
			marketing: "marketing professional",
			sales: "sales professional",
			"customer-success": "customer success professional",
			operations: "operations professional",
			finance: "finance professional",
			hr: "HR/people professional",
			legal: "legal professional",
			data: "data & analytics professional",
			research: "researcher",
			executive: "executive/leader",
		};
		parts.push(`User Role: ${roleMap[status.jobFunction] || status.jobFunction}`);
	}

	if (status.primaryUseCase) {
		const useCaseMap: Record<string, string> = {
			surveys: "collecting feedback via surveys",
			customer_discovery: "customer discovery and validation",
			sales_intelligence: "sales intelligence and deal tracking",
			user_research: "user research and synthesis",
			competitive_intel: "competitive intelligence",
			customer_success: "customer success and feedback tracking",
		};
		parts.push(`Primary Goal: ${useCaseMap[status.primaryUseCase] || status.primaryUseCase}`);
	}

	if (status.companySize) {
		const sizeMap: Record<string, string> = {
			startup: "startup (1-50 employees)",
			smb: "SMB (51-500 employees)",
			"mid-market": "mid-market company (501-5,000 employees)",
			enterprise: "enterprise (5,000+ employees)",
		};
		parts.push(`Company Size: ${sizeMap[status.companySize] || status.companySize}`);
	}

	if (parts.length === 0) {
		return "";
	}

	return `User Profile:\n${parts.join("\n")}`;
}

export default useOnboardingStatus;
