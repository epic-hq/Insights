import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { upsertProjectSection } from "~/features/projects/db"
import { getServerClient } from "~/lib/supabase/server"
import type { SupabaseClient } from "@supabase/supabase-js"

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
		meta: { [fieldName]: data, count: data.length }
	}),
	
	array_spaced: (data: string[], fieldName: string) => ({
		content_md: data.map((item, index) => `${index + 1}. ${item}`).join("\n\n"),
		meta: { [fieldName]: data, count: data.length }
	}),
	
	goal_with_details: (goal: string, details: string) => ({
		content_md: `# ${goal}\n\n${details || ""}`,
		meta: { research_goal: goal, research_goal_details: details || "" }
	}),
	
	plain_text: (text: string, fieldName: string) => ({
		content_md: text,
		meta: { [fieldName]: text }
	})
}

// Data-independent section processor
function processSection(kind: string, data: unknown): Omit<ProjectSectionData, 'project_id'> | null {
	const baseTimestamp = { lastUpdated: new Date().toISOString() }
	
	switch (kind) {
		case "target_orgs":
		case "target_roles":
			if (Array.isArray(data) && data.length > 0) {
				const formatted = sectionFormatters.array_numbered(data, kind)
				return { kind, ...formatted, meta: { ...formatted.meta, ...baseTimestamp } }
			}
			break
			
		case "research_goal":
			if (typeof data === 'object' && data && 'research_goal' in data) {
				const goalData = data as { research_goal: string; research_goal_details?: string }
				if (goalData.research_goal?.trim()) {
					const formatted = sectionFormatters.goal_with_details(goalData.research_goal, goalData.research_goal_details || "")
					return { kind, ...formatted, meta: { ...formatted.meta, ...baseTimestamp } }
				}
			}
			break
			
		case "assumptions":
		case "unknowns":
			if (Array.isArray(data) && data.length > 0) {
				const formatted = sectionFormatters.array_spaced(data, kind)
				return { kind, ...formatted, meta: { ...formatted.meta, ...baseTimestamp } }
			}
			break
			
		case "custom_instructions":
			if (typeof data === 'string' && data.trim()) {
				const formatted = sectionFormatters.plain_text(data, kind)
				return { kind, ...formatted, meta: { ...formatted.meta, ...baseTimestamp } }
			}
			break
	}
	
	return null
}

// Save individual section
async function saveSingleSection(supabase: SupabaseClient, projectId: string, sectionKind: string, sectionData: string) {
	let parsedData: unknown
	try {
		parsedData = JSON.parse(sectionData)
	} catch {
		parsedData = sectionData
	}

	const processedSection = processSection(sectionKind, parsedData)
	if (!processedSection) {
		return { error: `No valid data for section: ${sectionKind}` }
	}

	return await upsertProjectSection({
		supabase,
		data: {
			project_id: projectId,
			...processedSection,
			meta: processedSection.meta as Record<string, unknown>,
		},
	})
}

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 })
	}

	try {
		const { client: supabase } = getServerClient(request)
		
		// Get user from supabase auth
		const { data: { user }, error: authError } = await supabase.auth.getUser()
		
		if (authError || !user) {
			return Response.json({ error: "Authentication required" }, { status: 401 })
		}
		
		const formData = await request.formData()
		const action = formData.get("action") as string
		const projectId = formData.get("projectId") as string

		if (!projectId) {
			return Response.json({ error: "Project ID is required" }, { status: 400 })
		}

		consola.log(`Processing ${action || 'save-project-goals'} for project ${projectId}`)

		// Handle different actions
		switch (action) {
			case "save-section": {
				const sectionKind = formData.get("sectionKind") as string
				const sectionData = formData.get("sectionData") as string
				
				if (!sectionKind || sectionData === null) {
					return Response.json({ error: "Missing section kind or data" }, { status: 400 })
				}

				consola.log(`Saving single section: ${sectionKind}`)
				const result = await saveSingleSection(supabase, projectId, sectionKind, sectionData)
				
				if ('error' in result) {
					const { error } = result as { error?: string | null }
					if (error) {
						return Response.json({ error }, { status: 400 })
					}
				}
				
				return Response.json({ success: true, data: result })
			}
			
			case "save-project-goals":
			default: {
				// Extract all form data dynamically
				const formFields = {
					target_orgs: JSON.parse(formData.get("target_orgs") as string || "[]"),
					target_roles: JSON.parse(formData.get("target_roles") as string || "[]"),
					research_goal: {
						research_goal: formData.get("research_goal") as string,
						research_goal_details: formData.get("research_goal_details") as string
					},
					assumptions: JSON.parse(formData.get("assumptions") as string || "[]"),
					unknowns: JSON.parse(formData.get("unknowns") as string || "[]"),
					custom_instructions: formData.get("custom_instructions") as string
				}

				// Process all sections using the generic processor
				const sectionsToSave: ProjectSectionData[] = []
				
				for (const [kind, data] of Object.entries(formFields)) {
					const processedSection = processSection(kind, data)
					if (processedSection) {
						sectionsToSave.push({
							project_id: projectId,
							...processedSection
						})
					}
				}

				// Save all sections
				const results = []
				for (const section of sectionsToSave) {
					const result = await upsertProjectSection({
						supabase,
						data: {
							...section,
							meta: section.meta as Record<string, unknown>
						},
					})
					results.push(result)
				}

				consola.log(`Successfully saved ${results.length} project sections for project ${projectId}`)

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
