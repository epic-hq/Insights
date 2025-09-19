import type { SupabaseClient } from "@supabase/supabase-js"
import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { upsertProjectSection } from "~/features/projects/db"
import { getServerClient } from "~/lib/supabase/server"
import type { Database } from "~/types"

interface ProjectSectionData {
	project_id: string
	kind: string
	content_md: string
	meta: Record<string, unknown>
}

// Generic section formatters
const sectionFormatters = {
	array_numbered: (data: string[], fieldName: string) => ({
		content_md: data.map((item, index) => `${index + 1}. ${item}`).join("\n"),
		meta: { [fieldName]: data },
	}),

	array_spaced: (data: string[], fieldName: string) => ({
		content_md: data.map((item, index) => `${index + 1}. ${item}`).join("\n\n"),
		meta: { [fieldName]: data },
	}),

	goal_with_details: (goal: string, details: string) => ({
		// Store only the user's goal as content_md; keep details in meta
		content_md: goal,
		meta: { research_goal: goal, research_goal_details: details || "" },
	}),

	plain_text: (text: string, fieldName: string) => ({
		content_md: text,
		meta: { [fieldName]: text },
	}),
}

// Data-independent section processor
function processSection(kind: string, data: unknown): Omit<ProjectSectionData, "project_id"> | null {
	consola.log(`🔍 processSection: kind=${kind}, data=`, data, `type=${typeof data}, isArray=${Array.isArray(data)}`)

	switch (kind) {
		case "target_orgs":
		case "target_roles":
		case "decision_questions":
			if (Array.isArray(data)) {
				// Always save arrays, including empty ones to handle deletions
				const formatted = sectionFormatters.array_numbered(data, kind)
				consola.log("✅ Array section formatted:", formatted)
				return { kind, ...formatted }
			}
			consola.log(`❌ Expected array for ${kind}, got ${typeof data}:`, data)
			break

		case "research_goal":
			if (typeof data === "object" && data && "research_goal" in data) {
				const goalData = data as { research_goal: string; research_goal_details?: string }
				if (goalData.research_goal?.trim()) {
					const formatted = sectionFormatters.goal_with_details(
						goalData.research_goal,
						goalData.research_goal_details || ""
					)
					return { kind, ...formatted }
				}
			}
			break

		case "assumptions":
		case "unknowns":
			if (Array.isArray(data)) {
				// Always save arrays, including empty ones to handle deletions
				const formatted = sectionFormatters.array_spaced(data, kind)
				consola.log("✅ Spaced array section formatted:", formatted)
				return { kind, ...formatted }
			}
			consola.log(`❌ Expected array for ${kind}, got ${typeof data}:`, data)
			break

		case "custom_instructions":
			if (typeof data === "string" && data.trim()) {
				const formatted = sectionFormatters.plain_text(data, kind)
				return { kind, ...formatted }
			}
			break

		default:
			// Log unknown section types for debugging
			console.log(`Unknown section type: ${kind}, data:`, data)
			break
	}

	return null
}

// Save individual section
async function saveSingleSection(
	supabase: SupabaseClient,
	projectId: string,
	sectionKind: string,
	sectionData: string
) {
	consola.log("📝 saveSingleSection called:", { projectId, sectionKind, sectionData })

	let parsedData: unknown
	try {
		parsedData = JSON.parse(sectionData)
		consola.log("✅ JSON parsing successful:", parsedData)
	} catch (error) {
		consola.log("❌ JSON parsing failed, using raw data:", error)
		parsedData = sectionData
	}

	consola.log("🔄 Calling processSection with:", {
		sectionKind,
		parsedData,
		dataType: typeof parsedData,
		isArray: Array.isArray(parsedData),
	})
	const processedSection = processSection(sectionKind, parsedData)

	if (!processedSection) {
		consola.error(`❌ processSection returned null for ${sectionKind}, data:`, parsedData)
		return {
			error: `No valid data for section: ${sectionKind}. Data type: ${typeof parsedData}, isArray: ${Array.isArray(parsedData)}`,
		}
	}

	consola.log("✅ processSection success:", processedSection)

	const result = await upsertProjectSection({
		supabase,
		data: {
			project_id: projectId,
			...processedSection,
			meta: processedSection.meta as Database["public"]["Tables"]["project_sections"]["Insert"]["meta"],
		},
	})

	consola.log("💾 upsertProjectSection result:", result)
	return result
}

async function markProjectSetupVisited(supabase: SupabaseClient, userId: string, projectId: string) {
	try {
		const { data: settings } = await supabase
			.from("user_settings")
			.select("onboarding_steps")
			.eq("user_id", userId)
			.single()

		const steps = (settings?.onboarding_steps as Record<string, any>) || {}
		const setupByProject = (steps.project_setup as Record<string, any>) || {}
		const current = setupByProject[projectId] || {}

		const nextSteps = {
			...steps,
			project_setup: {
				...setupByProject,
				[projectId]: {
					...current,
					visited: true,
					visited_at: new Date().toISOString(),
				},
			},
		}

		await supabase
			.from("user_settings")
			.update({
				onboarding_steps: nextSteps as Database["public"]["Tables"]["user_settings"]["Update"]["onboarding_steps"],
			})
			.eq("user_id", userId)
	} catch (e) {
		// Non-fatal: don't block saves if this fails
		consola.warn("Failed to mark project setup visited:", e)
	}
}

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 })
	}

	try {
		const { client: supabase } = getServerClient(request)

		// Get user from supabase auth
		const {
			data: { user },
			error: authError,
		} = await supabase.auth.getUser()

		if (authError || !user) {
			return Response.json({ error: "Authentication required" }, { status: 401 })
		}

		const formData = await request.formData()
		const action = formData.get("action") as string
		const projectId = formData.get("projectId") as string

		// Debug: Log all form data
		consola.log("Received form data:")
		for (const [key, value] of formData.entries()) {
			consola.log(`  ${key}: ${typeof value === "string" ? value.substring(0, 100) : value}`)
		}

		if (!projectId) {
			return Response.json({ error: "Project ID is required" }, { status: 400 })
		}

		consola.log(`Processing ${action || "save-project-goals"} for project ${projectId}`)

		// Handle different actions
		switch (action) {
			case "save-section": {
				const sectionKind = formData.get("sectionKind") as string
				const sectionData = formData.get("sectionData") as string

				consola.log("🔽 Received save-section request:", {
					sectionKind,
					sectionData,
					projectId,
					sectionDataType: typeof sectionData,
					sectionDataLength: sectionData?.length,
				})

				if (!sectionKind || sectionData === null) {
					return Response.json({ error: "Missing section kind or data" }, { status: 400 })
				}

				consola.log(`Saving single section: ${sectionKind}`)
				const result = await saveSingleSection(supabase, projectId, sectionKind, sectionData)

				if ("error" in result) {
					const { error } = result as { error?: string | null }
					if (error) {
						return Response.json({ error }, { status: 400 })
					}
				}

				// Mark that the user has visited project setup for this project (per-project flag)
				await markProjectSetupVisited(supabase, user.id, projectId)

				return Response.json({ success: true, data: result })
			}
			default: {
				// Extract all form data dynamically with safe parsing
				const safeParseArray = (value: string | null): string[] => {
					if (!value) return []
					try {
						const parsed = JSON.parse(value)
						return Array.isArray(parsed) ? parsed : []
					} catch {
						return []
					}
				}

				const formFields = {
					target_orgs: safeParseArray(formData.get("target_orgs") as string),
					target_roles: safeParseArray(formData.get("target_roles") as string),
					research_goal: {
						research_goal: (formData.get("research_goal") as string) || "",
						research_goal_details: (formData.get("research_goal_details") as string) || "",
					},
					assumptions: safeParseArray(formData.get("assumptions") as string),
					unknowns: safeParseArray(formData.get("unknowns") as string),
					custom_instructions: (formData.get("custom_instructions") as string) || "",
				}

				consola.log("Parsed form fields:", formFields)

				// Process all sections using the generic processor
				const sectionsToSave: ProjectSectionData[] = []

				for (const [kind, data] of Object.entries(formFields)) {
					const processedSection = processSection(kind, data)
					if (processedSection) {
						sectionsToSave.push({
							project_id: projectId,
							...processedSection,
						})
					}
				}

				// Save all sections
				const results = []
				for (const section of sectionsToSave) {
					try {
						consola.log(`Saving section ${section.kind}:`, section)
						const result = await upsertProjectSection({
							supabase,
							data: {
								...section,
								meta: section.meta as Database["public"]["Tables"]["project_sections"]["Insert"]["meta"],
							},
						})

						if ("error" in result && result.error) {
							consola.error(`Failed to save section ${section.kind}:`, result.error)
							return Response.json({ error: `Failed to save ${section.kind}: ${result.error}` }, { status: 400 })
						}

						results.push(result)
					} catch (error) {
						consola.error(`Exception saving section ${section.kind}:`, error)
						return Response.json({ error: `Exception saving ${section.kind}: ${error}` }, { status: 500 })
					}
				}

				consola.log(`Successfully saved ${results.length} project sections for project ${projectId}`)

				// Mark that the user has visited project setup for this project (per-project flag)
				await markProjectSetupVisited(supabase, user.id, projectId)

				return Response.json({
					success: true,
					sectionsCount: results.length,
					projectId,
				})
			}
		}
	} catch (error) {
		consola.error("Failed to save project goals:", error)
		return Response.json(
			{
				error: error instanceof Error ? error.message : "Failed to save project goals",
			},
			{ status: 500 }
		)
	}
}
