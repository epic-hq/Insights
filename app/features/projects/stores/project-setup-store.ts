/**
 * Zustand store for project setup state
 *
 * Manages the shared state between chat and form modes during project setup.
 * Uses subscribeWithSelector for fine-grained reactivity.
 */

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

/**
 * Section data that can be edited in project setup
 * Matches the structure in project_sections table
 */
export interface ProjectSectionData {
	customer_problem: string;
	target_orgs: string[];
	target_roles: string[];
	offerings: string[];
	competitors: string[];
	research_goal: string;
	research_goal_details: string;
	decision_questions: string[];
	assumptions: string[];
	unknowns: string[];
	custom_instructions: string;
}

/** Sync status for the setup data */
export type SyncStatus = "synced" | "saving" | "offline" | "error";

/** Steps in the project setup journey */
export type SetupStep = "define" | "design" | "collect" | "synthesize" | "prioritize";

interface ProjectSetupState {
	// Core data
	sections: ProjectSectionData;
	projectId: string | null;

	// Sync status
	syncStatus: SyncStatus;
	lastSyncedAt: Date | null;
	pendingChanges: Set<string>;

	// Progress tracking
	currentStep: SetupStep;
	completedSteps: SetupStep[];

	// Actions - Data
	updateSection: <K extends keyof ProjectSectionData>(
		key: K,
		value: ProjectSectionData[K],
		options?: { skipSync?: boolean }
	) => void;
	setSections: (sections: Partial<ProjectSectionData>) => void;
	setProjectId: (projectId: string) => void;

	// Actions - Sync
	setSyncStatus: (status: SyncStatus) => void;
	markSynced: () => void;
	addPendingChange: (kind: string) => void;
	removePendingChange: (kind: string) => void;

	// Actions - Navigation
	setCurrentStep: (step: SetupStep) => void;
	markStepComplete: (step: SetupStep) => void;

	// Actions - Reset
	reset: () => void;
}

const DEFAULT_SECTIONS: ProjectSectionData = {
	customer_problem: "",
	target_orgs: [],
	target_roles: [],
	offerings: [],
	competitors: [],
	research_goal: "",
	research_goal_details: "",
	decision_questions: [],
	assumptions: [],
	unknowns: [],
	custom_instructions: "",
};

export const useProjectSetupStore = create<ProjectSetupState>()(
	subscribeWithSelector((set, get) => ({
		// Initial state
		sections: { ...DEFAULT_SECTIONS },
		projectId: null,
		syncStatus: "synced",
		lastSyncedAt: null,
		pendingChanges: new Set(),
		currentStep: "define",
		completedSteps: [],

		// Update a single section field
		updateSection: (key, value, options) => {
			set((state) => ({
				sections: { ...state.sections, [key]: value },
				syncStatus: options?.skipSync ? state.syncStatus : "saving",
			}));

			if (!options?.skipSync) {
				get().addPendingChange(key);
			}
		},

		// Bulk update sections (used by realtime sync)
		setSections: (sections) => {
			set((state) => ({
				sections: { ...state.sections, ...sections },
			}));
		},

		setProjectId: (projectId) => {
			set({ projectId });
		},

		// Sync status management
		setSyncStatus: (status) => set({ syncStatus: status }),

		markSynced: () =>
			set({
				syncStatus: "synced",
				lastSyncedAt: new Date(),
			}),

		addPendingChange: (kind) => {
			set((state) => ({
				pendingChanges: new Set(state.pendingChanges).add(kind),
			}));
		},

		removePendingChange: (kind) => {
			set((state) => {
				const updated = new Set(state.pendingChanges);
				updated.delete(kind);
				return {
					pendingChanges: updated,
					syncStatus: updated.size === 0 ? "synced" : state.syncStatus,
				};
			});
		},

		// Step navigation
		setCurrentStep: (step) => set({ currentStep: step }),

		markStepComplete: (step) => {
			set((state) => ({
				completedSteps: state.completedSteps.includes(step) ? state.completedSteps : [...state.completedSteps, step],
			}));
		},

		// Reset to initial state
		reset: () =>
			set({
				sections: { ...DEFAULT_SECTIONS },
				projectId: null,
				syncStatus: "synced",
				lastSyncedAt: null,
				pendingChanges: new Set(),
				currentStep: "define",
				completedSteps: [],
			}),
	}))
);

/**
 * Selector for getting just the sections data
 * Use this to minimize re-renders when only sections change
 */
export const selectSections = (state: ProjectSetupState) => state.sections;

/**
 * Selector for sync-related state
 */
export const selectSyncState = (state: ProjectSetupState) => ({
	syncStatus: state.syncStatus,
	lastSyncedAt: state.lastSyncedAt,
	pendingChanges: state.pendingChanges,
});

/**
 * Selector for step navigation state
 */
export const selectStepState = (state: ProjectSetupState) => ({
	currentStep: state.currentStep,
	completedSteps: state.completedSteps,
});
