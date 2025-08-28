import { useCallback, useEffect, useRef, useState } from "react"
import consola from "consola"

interface UseAutoSaveOptions {
	projectId: string
	debounceMs?: number
	onSaveStart?: () => void
	onSaveComplete?: () => void
	onSaveError?: (error: unknown) => void
}

export function useAutoSave({
	projectId,
	debounceMs = 1000,
	onSaveStart,
	onSaveComplete,
	onSaveError,
}: UseAutoSaveOptions) {
	const timeoutRef = useRef<NodeJS.Timeout | undefined>()
	const [isSaving, setIsSaving] = useState(false)
	// Keep latest projectId to avoid stale closures inside timeouts
	const projectIdRef = useRef<string>(projectId)
	if (projectIdRef.current !== projectId) {
		projectIdRef.current = projectId
	}

	// Buffer the last queued save so we can flush it immediately once projectId exists
	const lastQueuedRef = useRef<{ kind: string; data: unknown } | null>(null)

	// Stable saver that always reads the latest projectId via ref
	const saveSectionWithLatest = useCallback(
		async (sectionKind: string, sectionData: unknown) => {
			const latestProjectId = projectIdRef.current
			if (!latestProjectId) {
				return // silent skip until we have a projectId
			}
			try {
				consola.log(`🔄 Starting auto-save for ${sectionKind} with data:`, sectionData)
				setIsSaving(true)
				onSaveStart?.()

				const formData = new FormData()
				formData.append("action", "save-section")
				formData.append("projectId", latestProjectId)
				formData.append("sectionKind", sectionKind)
				formData.append("sectionData", JSON.stringify(sectionData))

				consola.log(`📤 Sending request to /api/save-project-goals for ${sectionKind}`)
				const response = await fetch("/api/save-project-goals", {
					method: "POST",
					body: formData,
					credentials: 'include'
				})

				consola.log(`📥 Response status: ${response.status}`)
				const result = await response.json()
				consola.log(`📋 Response data:`, result)

				if (result.success) {
					setIsSaving(false)
					onSaveComplete?.()
					consola.log(`✅ Auto-saved ${sectionKind} section successfully`)
				} else {
					throw new Error(result.error || "Save failed")
				}
			} catch (error) {
				setIsSaving(false)
				consola.error(`❌ Failed to auto-save ${sectionKind}:`, error)
				onSaveError?.(error)
			}
		},
		[onSaveStart, onSaveComplete, onSaveError]
	)

	const debouncedSave = useCallback(
		(sectionKind: string, sectionData: unknown) => {
			// Clear existing timeout
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current)
			}
			// Record last queued intent (used if projectId arrives before timeout fires)
			lastQueuedRef.current = { kind: sectionKind, data: sectionData }
			// Set new timeout
			timeoutRef.current = setTimeout(() => {
				saveSectionWithLatest(sectionKind, sectionData)
				lastQueuedRef.current = null
			}, debounceMs)
		},
		[saveSectionWithLatest, debounceMs]
	)

	// If projectId becomes available while we have a queued save, flush immediately (in effect)
	useEffect(() => {
		if (projectId && lastQueuedRef.current) {
			if (timeoutRef.current) clearTimeout(timeoutRef.current)
			const { kind, data } = lastQueuedRef.current
			lastQueuedRef.current = null
			void saveSectionWithLatest(kind, data)
		}
	}, [projectId, saveSectionWithLatest])

	const saveTargetOrgs = useCallback(
		(target_orgs: string[]) => {
			if (target_orgs.length > 0) {
				saveSectionWithLatest("target_orgs", target_orgs)
			}
		},
		[saveSectionWithLatest]
	)

	const saveTargetRoles = useCallback(
		(target_roles: string[]) => {
			if (target_roles.length > 0) {
				saveSectionWithLatest("target_roles", target_roles)
			}
		},
		[saveSectionWithLatest]
	)

	// Generic save function for any project section
	const saveProjectSection = useCallback(
		(sectionKind: string, sectionData: unknown, debounced = false) => {
			if (debounced) {
				debouncedSave(sectionKind, sectionData)
			} else {
				saveSectionWithLatest(sectionKind, sectionData)
			}
		},
		[saveSectionWithLatest, debouncedSave]
	)

	const saveResearchGoal = useCallback(
		(research_goal: string, research_goal_details: string, debounced = true) => {
			if (research_goal.trim()) {
				saveProjectSection(
					"research_goal",
					{ research_goal, research_goal_details },
					debounced,
				)
			}
		},
		[saveProjectSection]
	)

	const saveAssumptions = useCallback(
		(assumptions: string[]) => {
			if (assumptions.length > 0) {
				saveProjectSection("assumptions", assumptions)
			}
		},
		[saveProjectSection]
	)

	const saveUnknowns = useCallback(
		(unknowns: string[]) => {
			if (unknowns.length > 0) {
				saveProjectSection("unknowns", unknowns)
			}
		},
		[saveProjectSection]
	)

	const saveCustomInstructions = useCallback(
		(custom_instructions: string) => {
			if (custom_instructions.trim()) {
				saveProjectSection("custom_instructions", custom_instructions, true)
			}
		},
		[saveProjectSection]
	)

	return {
		saveTargetOrgs,
		saveTargetRoles,
		saveResearchGoal,
		saveAssumptions,
		saveUnknowns,
		saveCustomInstructions,
		saveProjectSection,
		isSaving,
	}
}

