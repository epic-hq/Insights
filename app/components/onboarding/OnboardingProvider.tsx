/**
 * OnboardingProvider - Context provider for onboarding state
 *
 * Wraps the app and shows the onboarding walkthrough modal for new users.
 * Also provides onboarding data context for AI personalization.
 */

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { buildOnboardingContext, type OnboardingStatus, useOnboardingStatus } from "~/hooks/useOnboardingStatus";
import { type OnboardingData, OnboardingWalkthrough } from "./OnboardingWalkthrough";

interface OnboardingContextValue {
	/** Current onboarding status */
	status: OnboardingStatus;
	/** AI context string built from onboarding data */
	aiContext: string;
	/** Manually show the onboarding modal */
	showOnboarding: () => void;
	/** Hide the onboarding modal */
	hideOnboarding: () => void;
	/** Mark onboarding as completed */
	markCompleted: (data: OnboardingData) => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

interface OnboardingProviderProps {
	children: React.ReactNode;
	/** Whether to auto-show modal for new users (default: true) */
	autoShow?: boolean;
}

export function OnboardingProvider({ children, autoShow = true }: OnboardingProviderProps) {
	const status = useOnboardingStatus();
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [localCompleted, setLocalCompleted] = useState(false);

	// Build AI context from onboarding data
	const aiContext = buildOnboardingContext(status);

	// Auto-show modal for new users (with delay to let page load)
	useEffect(() => {
		if (autoShow && status.shouldShowOnboarding && !localCompleted) {
			// Small delay to avoid modal flash on fast page loads
			const timer = setTimeout(() => {
				setIsModalOpen(true);
			}, 1000);
			return () => clearTimeout(timer);
		}
	}, [autoShow, status.shouldShowOnboarding, localCompleted]);

	const showOnboarding = useCallback(() => {
		setIsModalOpen(true);
	}, []);

	const hideOnboarding = useCallback(() => {
		setIsModalOpen(false);
	}, []);

	const markCompleted = useCallback((data: OnboardingData) => {
		setLocalCompleted(true);
		// Don't close modal here - let the walkthrough show confetti/completion step first.
		// The walkthrough's "continue" button will call onOpenChange(false) when ready.
	}, []);

	const value: OnboardingContextValue = {
		status: localCompleted ? { ...status, completed: true, shouldShowOnboarding: false } : status,
		aiContext,
		showOnboarding,
		hideOnboarding,
		markCompleted,
	};

	return (
		<OnboardingContext.Provider value={value}>
			{children}
			<OnboardingWalkthrough
				open={isModalOpen}
				onOpenChange={setIsModalOpen}
				onComplete={markCompleted}
				initialData={{
					jobFunction: status.jobFunction,
					primaryUseCase: status.primaryUseCase,
					companySize: status.companySize,
				}}
			/>
		</OnboardingContext.Provider>
	);
}

/**
 * Hook to access onboarding context
 */
export function useOnboarding(): OnboardingContextValue {
	const context = useContext(OnboardingContext);
	if (!context) {
		// Return a fallback if used outside provider
		return {
			status: {
				isLoading: true,
				completed: false,
				jobFunction: "",
				primaryUseCase: "",
				teamSize: "",
				goals: "",
				shouldShowOnboarding: false,
			},
			aiContext: "",
			showOnboarding: () => {},
			hideOnboarding: () => {},
			markCompleted: () => {},
		};
	}
	return context;
}

export default OnboardingProvider;
