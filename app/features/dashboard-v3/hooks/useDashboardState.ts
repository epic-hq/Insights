/**
 * useDashboardState - Hook to compute dashboard state
 *
 * Returns the current dashboard state (empty/processing/active)
 * based on project data availability.
 */

import { useMemo } from "react";
import type { DashboardState } from "../components/DashboardShell";

export interface UseDashboardStateOptions {
	conversationCount: number;
	processingCount: number;
	hasGoals: boolean;
}

export interface UseDashboardStateResult {
	/** Current dashboard state */
	state: DashboardState;
	/** Whether sidebar should be visible */
	showSidebar: boolean;
	/** Whether onboarding tasks should be shown */
	showOnboarding: boolean;
	/** Whether processing indicator should be shown */
	showProcessing: boolean;
}

/**
 * Computes dashboard state and derived visibility flags
 */
export function useDashboardState({
	conversationCount,
	processingCount,
	hasGoals,
}: UseDashboardStateOptions): UseDashboardStateResult {
	return useMemo(() => {
		// Determine state
		let state: DashboardState = "active";

		if (conversationCount === 0 && processingCount === 0) {
			state = "empty";
		} else if (processingCount > 0) {
			state = "processing";
		}

		// Derive visibility flags
		const showSidebar = state !== "empty" || hasGoals;
		const showOnboarding = state === "empty";
		const showProcessing = state === "processing";

		return {
			state,
			showSidebar,
			showOnboarding,
			showProcessing,
		};
	}, [conversationCount, processingCount, hasGoals]);
}

export default useDashboardState;
