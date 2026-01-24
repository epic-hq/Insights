/**
 * React Context for project setup
 *
 * Provides a unified interface for both chat and form modes to access
 * and update project section data with automatic sync to the server.
 */

import consola from "consola";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { useProjectSetupSync } from "../hooks/useProjectSetupSync";
import {
  type ProjectSectionData,
  type SetupStep,
  type SyncStatus,
  useProjectSetupStore,
} from "../stores/project-setup-store";

interface ProjectSetupContextValue {
  // Data
  sections: ProjectSectionData;
  projectId: string;

  // Sync status
  syncStatus: SyncStatus;
  lastSyncedAt: Date | null;

  // Step navigation
  currentStep: SetupStep;
  completedSteps: SetupStep[];

  // Actions
  updateSection: <K extends keyof ProjectSectionData>(
    key: K,
    value: ProjectSectionData[K],
  ) => void;
  setCurrentStep: (step: SetupStep) => void;
  markStepComplete: (step: SetupStep) => void;

  // Direct save (for immediate saves without debounce)
  saveSection: (
    kind: string,
    data: unknown,
  ) => Promise<{ success: boolean; error?: string }>;
}

const ProjectSetupContext = createContext<ProjectSetupContextValue | null>(
  null,
);

interface ProjectSetupProviderProps {
  children: ReactNode;
  projectId: string;
  initialData?: Partial<ProjectSectionData>;
}

/**
 * Provider component for project setup context
 *
 * Wraps children with access to shared project setup state.
 * Handles:
 * - Initial data loading
 * - Realtime sync subscription
 * - Debounced saves on updates
 */
export function ProjectSetupProvider({
  children,
  projectId,
  initialData,
}: ProjectSetupProviderProps) {
  const store = useProjectSetupStore();
  const { saveSection } = useProjectSetupSync({ projectId });

  // Track debounced save timeouts
  const saveTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Track last synced data to avoid infinite loops from reference changes
  const lastSyncedDataRef = useRef<string>("");

  // Initialize and sync with server-provided data
  // This runs on mount AND when initialData content changes (e.g., after revalidation)
  useEffect(() => {
    if (initialData && Object.keys(initialData).length > 0) {
      // Create a stable string representation for comparison
      const dataHash = JSON.stringify(initialData);
      if (dataHash === lastSyncedDataRef.current) {
        return; // Already synced this exact data
      }

      // Filter to only include fields that have actual values
      // This prevents clearing local data with empty server values
      const dataToMerge: Partial<ProjectSectionData> = {};
      for (const [key, value] of Object.entries(initialData)) {
        if (value !== undefined && value !== null) {
          const hasValue = Array.isArray(value)
            ? value.length > 0
            : Boolean(value);
          if (hasValue) {
            dataToMerge[key as keyof ProjectSectionData] =
              value as ProjectSectionData[keyof ProjectSectionData];
          }
        }
      }
      if (Object.keys(dataToMerge).length > 0) {
        lastSyncedDataRef.current = dataHash;
        store.setSections(dataToMerge);
        consola.debug(
          "Synced project setup with server data",
          Object.keys(dataToMerge),
        );
      }
    }
  }, [initialData, store]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      saveTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
      saveTimeoutsRef.current.clear();
    };
  }, []);

  /**
   * Update a section with automatic debounced save
   * - Immediately updates local state (optimistic)
   * - Debounces server save to reduce API calls
   */
  const updateSection = useCallback(
    <K extends keyof ProjectSectionData>(
      key: K,
      value: ProjectSectionData[K],
    ) => {
      // Update local state immediately
      store.updateSection(key, value);

      // Clear existing timeout for this section
      const existingTimeout = saveTimeoutsRef.current.get(key);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      // Set new debounced save
      const timeout = setTimeout(() => {
        saveSection(key, value);
        saveTimeoutsRef.current.delete(key);
      }, 1000); // 1 second debounce

      saveTimeoutsRef.current.set(key, timeout);
    },
    [store, saveSection],
  );

  const value = useMemo<ProjectSetupContextValue>(
    () => ({
      sections: store.sections,
      projectId,
      syncStatus: store.syncStatus,
      lastSyncedAt: store.lastSyncedAt,
      currentStep: store.currentStep,
      completedSteps: store.completedSteps,
      updateSection,
      setCurrentStep: store.setCurrentStep,
      markStepComplete: store.markStepComplete,
      saveSection,
    }),
    [
      store.sections,
      store.syncStatus,
      store.lastSyncedAt,
      store.currentStep,
      store.completedSteps,
      store.setCurrentStep,
      store.markStepComplete,
      projectId,
      updateSection,
      saveSection,
    ],
  );

  return (
    <ProjectSetupContext.Provider value={value}>
      {children}
    </ProjectSetupContext.Provider>
  );
}

/**
 * Hook to access project setup context
 *
 * Must be used within a ProjectSetupProvider
 */
export function useProjectSetup() {
  const context = useContext(ProjectSetupContext);
  if (!context) {
    throw new Error(
      "useProjectSetup must be used within a ProjectSetupProvider",
    );
  }
  return context;
}

/**
 * Hook to access just the sections data
 * Useful for components that only need to read data
 */
export function useProjectSections() {
  const { sections } = useProjectSetup();
  return sections;
}

/**
 * Hook to access sync status
 * Useful for sync indicators
 */
export function useProjectSetupSync2() {
  const { syncStatus, lastSyncedAt } = useProjectSetup();
  return { syncStatus, lastSyncedAt };
}
