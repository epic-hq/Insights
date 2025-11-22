import type { SupabaseClient } from "@supabase/supabase-js"
import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { upsertProjectSection } from "~/features/projects/db"
import { getSectionConfig } from "~/features/projects/section-config"
import { getServerClient } from "~/lib/supabase/client.server"
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

	plain_text: (text: string, fieldName: string) => ({
		content_md: text,
		meta: { [fieldName]: text },
	}),
}

// Data-independent section processor
function processSection(kind: string, data: unknown): Omit<ProjectSectionData, "project_id"> | null {
	consola.log(`🔍 processSection: kind=${kind}, data=`, data, `type=${typeof data}, isArray=${Array.isArray(data)}`)

	// Special case for settings (not in PROJECT_SECTIONS config)
	if (kind === "settings") {
		if (typeof data === "object" && data) {
			return {
				kind,
				content_md: JSON.stringify(data),
				meta: data as Record<string, unknown>,
			}
		}
		return null
	}

	// Get section configuration
	const config = getSectionConfig(kind)
	if (!config) {
		consola.log(`❌ Unknown section type: ${kind}`)
		return null
	}

	// Handle based on type
	if (config.type === "string[]") {
		if (!Array.isArray(data)) {
			consola.log(`❌ Expected array for ${kind}, got ${typeof data}:`, data)
			return null
		}
		// Always save arrays, including empty ones to handle deletions
		const formatter =
			config.arrayFormatter === "spaced" ? sectionFormatters.array_spaced : sectionFormatters.array_numbered
		const formatted = formatter(data, kind)
		consola.log(`✅ Array section formatted (${config.arrayFormatter}):`, formatted)
		return { kind, ...formatted }
	}

	if (config.type === "string") {
		if (typeof data !== "string") {
			consola.log(`❌ Expected string for ${kind}, got ${typeof data}:`, data)
			return null
		}
		// Allow empty strings if configured
		if (data.trim() || config.allowEmpty) {
			const formatted = sectionFormatters.plain_text(data, kind)
			return { kind, ...formatted }
		}
		return null
	}

	consola.log(`❌ Unhandled section type for ${kind}:`, config.type)
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

	// For settings, merge with existing settings to avoid overwriting
	if (sectionKind === "settings" && typeof parsedData === "object" && parsedData) {
		const { data: existingSection } = await supabase
			.from("project_sections")
			.select("meta")
			.eq("project_id", projectId)
			.eq("kind", "settings")
			.single()

		if (existingSection?.meta) {
			const existingMeta = existingSection.meta as Record<string, unknown>
			parsedData = { ...existingMeta, ...parsedData }
			consola.log("🔀 Merged settings with existing:", parsedData)
		}
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

				if ("error" in result && result.error) {
					// Handle both string errors and Supabase error objects
					const errorMessage =
						typeof result.error === "string" ? result.error : result.error?.message || JSON.stringify(result.error)
					consola.error(`❌ Save failed for ${sectionKind}:`, errorMessage)
					return Response.json({ error: errorMessage }, { status: 400 })
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
					research_goal: (formData.get("research_goal") as string) || "",
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
							const errorMessage =
								typeof result.error === "string" ? result.error : result.error?.message || JSON.stringify(result.error)
							consola.error(`Failed to save section ${section.kind}:`, errorMessage)
							return Response.json({ error: `Failed to save ${section.kind}: ${errorMessage}` }, { status: 400 })
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
