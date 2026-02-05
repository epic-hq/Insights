/**
 * Project Setup Module
 *
 * Unified setup experience with real-time sync between chat and form modes.
 *
 * Usage:
 * ```tsx
 * import {
 *   ProjectSetupProvider,
 *   useProjectSetup,
 *   SetupStepRail,
 *   SetupModeToggle,
 *   SyncStatusIndicator,
 * } from '~/features/projects/setup'
 *
 * function SetupPage({ projectId }) {
 *   return (
 *     <ProjectSetupProvider projectId={projectId}>
 *       <div className="flex">
 *         <SetupStepRail />
 *         <main>
 *           <SetupModeToggle mode={mode} onModeChange={setMode} />
 *           <SyncStatusIndicator />
 *           {mode === 'chat' ? <ChatComponent /> : <FormComponent />}
 *         </main>
 *       </div>
 *     </ProjectSetupProvider>
 *   )
 * }
 * ```
 */

export {
	type SetupMode,
	SetupModeToggle,
	SetupModeToggleCompact,
} from "../components/SetupModeToggle"
// UI Components
export {
	SetupStepIndicatorCompact,
	SetupStepRail,
} from "../components/SetupStepRail"
export {
	SyncStatusDot,
	SyncStatusIndicator,
	SyncStatusWithTime,
} from "../components/SyncStatusIndicator"
// Context and hooks
export {
	ProjectSetupProvider,
	useProjectSections,
	useProjectSetup,
} from "../contexts/project-setup-context"
// Sync hook
export { useProjectSetupSync } from "../hooks/useProjectSetupSync"
// Store
export {
	type ProjectSectionData,
	type SetupStep,
	type SyncStatus,
	selectSections,
	selectStepState,
	selectSyncState,
	useProjectSetupStore,
} from "../stores/project-setup-store"

// Utilities
export {
	getCompletedSteps,
	getNextIncompleteStep,
	getProgressPercentage,
	getStepCompletion,
	getStepFieldStatus,
	isStepReady,
} from "../utils/step-completion"
