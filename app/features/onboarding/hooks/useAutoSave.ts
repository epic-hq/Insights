import consola from "consola";
import { useCallback, useEffect, useRef, useState } from "react";

interface UseAutoSaveOptions {
	projectId: string;
	debounceMs?: number;
	onSaveStart?: () => void;
	onSaveComplete?: () => void;
	onSaveError?: (error: unknown) => void;
}

interface SaveSectionOptions {
	debounced?: boolean;
}

export function useAutoSave({
	projectId,
	debounceMs = 1000,
	onSaveStart,
	onSaveComplete,
	onSaveError,
}: UseAutoSaveOptions) {
	const timeoutRef = useRef<NodeJS.Timeout | undefined>();
	const [isSaving, setIsSaving] = useState(false);
	// Keep latest projectId to avoid stale closures inside timeouts
	const projectIdRef = useRef<string>(projectId);
	if (projectIdRef.current !== projectId) {
		projectIdRef.current = projectId;
	}

	// Buffer the last queued save so we can flush it immediately once projectId exists
	const lastQueuedRef = useRef<{ kind: string; data: unknown } | null>(null);

	// Stable saver that always reads the latest projectId via ref
	const saveSectionWithLatest = useCallback(
		async (sectionKind: string, sectionData: unknown) => {
			const latestProjectId = projectIdRef.current;
			if (!latestProjectId) {
				return; // silent skip until we have a projectId
			}
			try {
				consola.log(`🔄 Starting auto-save for ${sectionKind} with data:`, sectionData);
				consola.log(
					`📋 Data type: ${typeof sectionData}, isArray: ${Array.isArray(sectionData)}, JSON:`,
					JSON.stringify(sectionData)
				);
				setIsSaving(true);
				onSaveStart?.();

				const formData = new FormData();
				formData.append("action", "save-section");
				formData.append("projectId", latestProjectId);
				formData.append("sectionKind", sectionKind);
				formData.append("sectionData", JSON.stringify(sectionData));

				consola.log("📤 FormData being sent:", {
					action: "save-section",
					projectId: latestProjectId,
					sectionKind: sectionKind,
					sectionData: JSON.stringify(sectionData),
				});

				consola.log(`📤 Sending request to /api/save-project-goals for ${sectionKind}`);
				const response = await fetch("/api/save-project-goals", {
					method: "POST",
					body: formData,
					credentials: "include",
				});

				consola.log(`📥 Response status: ${response.status}`);
				const result = await response.json();
				consola.log("📋 Response data:", result);

				if (result.success) {
					setIsSaving(false);
					onSaveComplete?.();
					consola.log(`✅ Auto-saved ${sectionKind} section successfully`);
				} else {
					consola.error(`❌ Auto-save failed for ${sectionKind}:`, result);
					throw new Error(result.error || "Save failed");
				}
			} catch (error) {
				setIsSaving(false);
				consola.error(`❌ Failed to auto-save ${sectionKind}:`, error);
				onSaveError?.(error);
			}
		},
		[onSaveStart, onSaveComplete, onSaveError]
	);

	const debouncedSave = useCallback(
		(sectionKind: string, sectionData: unknown) => {
			// Clear existing timeout
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}
			// Record last queued intent (used if projectId arrives before timeout fires)
			lastQueuedRef.current = { kind: sectionKind, data: sectionData };
			// Set new timeout
			timeoutRef.current = setTimeout(() => {
				void saveSectionWithLatest(sectionKind, sectionData);
				lastQueuedRef.current = null;
			}, debounceMs);
		},
		[saveSectionWithLatest, debounceMs]
	);

	// If projectId becomes available while we have a queued save, flush immediately (in effect)
	useEffect(() => {
		if (projectId && lastQueuedRef.current) {
			if (timeoutRef.current) clearTimeout(timeoutRef.current);
			const { kind, data } = lastQueuedRef.current;
			lastQueuedRef.current = null;
			void saveSectionWithLatest(kind, data);
		}
	}, [projectId, saveSectionWithLatest]);

	// Generic save function for any project section
	const saveSection = useCallback(
		(sectionKind: string, sectionData: unknown, options?: SaveSectionOptions) => {
			const shouldDebounce = options?.debounced ?? false;
			if (shouldDebounce) {
				debouncedSave(sectionKind, sectionData);
			} else {
				void saveSectionWithLatest(sectionKind, sectionData);
			}
		},
		[debouncedSave, saveSectionWithLatest]
	);

	return {
		saveSection,
		isSaving,
	};
}
