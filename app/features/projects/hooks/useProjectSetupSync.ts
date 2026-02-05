/**
 * Real-time sync hook for project setup
 *
 * Subscribes to Supabase realtime changes for project_sections
 * and keeps the Zustand store in sync. Also provides a save function
 * for local changes.
 */

import type { RealtimeChannel } from "@supabase/supabase-js"
import consola from "consola"
import { useCallback, useEffect, useRef } from "react"
import { createClient } from "~/lib/supabase/client"
import { type ProjectSectionData, useProjectSetupStore } from "../stores/project-setup-store"

interface UseProjectSetupSyncOptions {
	projectId: string
	enabled?: boolean
}

/** Database row shape for project_sections */
interface ProjectSectionRow {
	id: string
	project_id: string
	kind: string
	content_md: string | null
	meta: Record<string, unknown> | null
	created_at: string
	updated_at: string
}

/** Valid section kinds that map to our store */
const VALID_SECTION_KINDS = new Set<keyof ProjectSectionData>([
	"customer_problem",
	"target_orgs",
	"target_roles",
	"offerings",
	"competitors",
	"research_goal",
	"research_goal_details",
	"decision_questions",
	"assumptions",
	"unknowns",
	"custom_instructions",
])

/**
 * Hook that syncs project sections with Supabase realtime
 *
 * - Subscribes to INSERT/UPDATE/DELETE on project_sections for this project
 * - Updates Zustand store when remote changes arrive
 * - Provides saveSection function for local changes
 */
export function useProjectSetupSync({ projectId, enabled = true }: UseProjectSetupSyncOptions) {
	const supabase = createClient()
	const channelRef = useRef<RealtimeChannel | null>(null)

	const { setSections, setSyncStatus, markSynced, removePendingChange, setProjectId } = useProjectSetupStore()

	// Set project ID in store
	useEffect(() => {
		if (projectId) {
			setProjectId(projectId)
		}
	}, [projectId, setProjectId])

	/**
	 * Parse a section row from the database into store format
	 * Extracts the typed value from meta, falling back to content_md
	 */
	const parseSectionRow = useCallback((row: ProjectSectionRow): { kind: string; value: unknown } | null => {
		const kind = row.kind

		// Skip unknown section kinds
		if (!VALID_SECTION_KINDS.has(kind as keyof ProjectSectionData)) {
			return null
		}

		const meta = row.meta || {}

		// For array fields, look in meta first
		if (
			[
				"target_orgs",
				"target_roles",
				"offerings",
				"competitors",
				"decision_questions",
				"assumptions",
				"unknowns",
			].includes(kind)
		) {
			const arrayValue = meta[kind]
			if (Array.isArray(arrayValue)) {
				return { kind, value: arrayValue }
			}
			// Fallback: parse from content_md if it looks like a numbered list
			if (row.content_md) {
				const items = row.content_md
					.split("\n")
					.map((line) => line.replace(/^\d+\.\s*/, "").trim())
					.filter(Boolean)
				return { kind, value: items }
			}
			return { kind, value: [] }
		}

		// For string fields
		const stringValue = meta[kind] ?? row.content_md ?? ""
		return {
			kind,
			value: typeof stringValue === "string" ? stringValue : String(stringValue),
		}
	}, [])

	// Load initial data on mount
	useEffect(() => {
		if (!enabled || !projectId) return

		async function loadInitialData() {
			try {
				const { data, error } = await supabase
					.from("project_sections")
					.select("id, project_id, kind, content_md, meta, created_at, updated_at")
					.eq("project_id", projectId)

				if (error) {
					consola.error("Failed to load project sections:", error)
					setSyncStatus("error")
					return
				}

				if (data && data.length > 0) {
					const sectionsUpdate: Partial<ProjectSectionData> = {}

					for (const row of data) {
						const parsed = parseSectionRow(row as ProjectSectionRow)
						if (parsed && VALID_SECTION_KINDS.has(parsed.kind as keyof ProjectSectionData)) {
							sectionsUpdate[parsed.kind as keyof ProjectSectionData] = parsed.value as never
						}
					}

					setSections(sectionsUpdate)
					consola.debug("Loaded project sections:", Object.keys(sectionsUpdate))
				}

				markSynced()
			} catch (error) {
				consola.error("Error loading project sections:", error)
				setSyncStatus("error")
			}
		}

		loadInitialData()
	}, [projectId, enabled, supabase, parseSectionRow, setSections, markSynced, setSyncStatus])

	// Subscribe to realtime changes
	useEffect(() => {
		if (!enabled || !projectId) return

		const channel = supabase
			.channel(`project_sections:${projectId}`)
			.on(
				"postgres_changes",
				{
					event: "*", // INSERT, UPDATE, DELETE
					schema: "public",
					table: "project_sections",
					filter: `project_id=eq.${projectId}`,
				},
				(payload) => {
					consola.debug("Realtime update:", payload.eventType, payload)

					if (payload.eventType === "DELETE") {
						// Handle deletion - reset to default value
						const oldRow = payload.old as Partial<ProjectSectionRow>
						const kind = oldRow?.kind

						if (kind && VALID_SECTION_KINDS.has(kind as keyof ProjectSectionData)) {
							// Determine default value based on type
							const isArrayField = [
								"target_orgs",
								"target_roles",
								"offerings",
								"competitors",
								"decision_questions",
								"assumptions",
								"unknowns",
							].includes(kind)
							setSections({ [kind]: isArrayField ? [] : "" })
						}
						return
					}

					// INSERT or UPDATE
					const row = payload.new as ProjectSectionRow
					const parsed = parseSectionRow(row)

					if (parsed && VALID_SECTION_KINDS.has(parsed.kind as keyof ProjectSectionData)) {
						setSections({ [parsed.kind]: parsed.value })
						removePendingChange(parsed.kind)
						consola.debug("Updated section from realtime:", parsed.kind)
					}

					markSynced()
				}
			)
			.subscribe((status) => {
				consola.debug("Realtime subscription status:", status)
				if (status === "SUBSCRIBED") {
					setSyncStatus("synced")
				} else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
					setSyncStatus("offline")
				}
			})

		channelRef.current = channel

		return () => {
			if (channelRef.current) {
				supabase.removeChannel(channelRef.current)
				channelRef.current = null
			}
		}
	}, [projectId, enabled, supabase, parseSectionRow, setSections, markSynced, setSyncStatus, removePendingChange])

	/**
	 * Save a section to the server
	 * Uses the existing save-project-goals API endpoint
	 */
	const saveSection = useCallback(
		async (kind: string, data: unknown) => {
			if (!projectId) {
				consola.warn("Cannot save section: no project ID")
				return { success: false, error: "No project ID" }
			}

			setSyncStatus("saving")

			try {
				const formData = new FormData()
				formData.append("action", "save-section")
				formData.append("projectId", projectId)
				formData.append("sectionKind", kind)
				formData.append("sectionData", JSON.stringify(data))

				const response = await fetch("/api/save-project-goals", {
					method: "POST",
					body: formData,
					credentials: "include",
				})

				const result = await response.json()

				if (result.success) {
					removePendingChange(kind)
					markSynced()
					consola.debug("Saved section:", kind)
				} else {
					setSyncStatus("error")
					consola.error("Failed to save section:", result)
				}

				return result
			} catch (error) {
				setSyncStatus("error")
				consola.error("Save error:", error)
				return { success: false, error: String(error) }
			}
		},
		[projectId, setSyncStatus, markSynced, removePendingChange]
	)

	return { saveSection }
}
