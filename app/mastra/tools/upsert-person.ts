import { createTool } from "@mastra/core/tools"
import type { SupabaseClient } from "@supabase/supabase-js"
import consola from "consola"
import { z } from "zod"
import { supabaseAdmin } from "~/lib/supabase/client.server"
import type { Database } from "~/types"

/**
 * Parse a full name into firstname and lastname
 * Returns { firstname, lastname } with lastname being null for single-word names
 */
function parseFullName(fullName: string): { firstname: string; lastname: string | null } {
	const trimmed = fullName.trim()
	if (!trimmed) return { firstname: "", lastname: null }

	const parts = trimmed.split(/\s+/)
	if (parts.length === 1) {
		return { firstname: parts[0], lastname: null }
	}

	// firstname is the first part, lastname is everything else joined
	return {
		firstname: parts[0],
		lastname: parts.slice(1).join(" "),
	}
}

export const upsertPersonTool = createTool({
	id: "upsert-person",
	description:
		"Create or update a person's information including contact details, demographics, and professional info. Use this when the user provides new information about a person.",
	inputSchema: z.object({
		personId: z.string().optional().describe("Person ID if updating an existing person"),
		name: z.string().optional().describe("Full name of the person"),
		title: z.string().optional().describe("Job title"),
		role: z.string().optional().describe("Role or position"),
		company: z.string().optional().describe("Company/organization name"),
		description: z.string().optional().describe("Description or notes about the person"),
		primaryEmail: z.string().optional().describe("Primary email address"),
		primaryPhone: z.string().optional().describe("Primary phone number"),
		location: z.string().optional().describe("Location/address"),
		linkedinUrl: z.string().optional().describe("LinkedIn profile URL"),
		websiteUrl: z.string().optional().describe("Personal website URL"),
		segment: z.string().optional().describe("Customer segment"),
		industry: z.string().optional().describe("Industry"),
		timezone: z.string().optional().describe("Timezone"),
		pronouns: z.string().optional().describe("Preferred pronouns"),
		lifecycleStage: z.string().optional().describe("Lifecycle stage (e.g., lead, customer, etc.)"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
		person: z
			.object({
				id: z.string(),
				name: z.string().nullable(),
				title: z.string().nullable(),
				company: z.string().nullable(),
				primaryEmail: z.string().nullable(),
				primaryPhone: z.string().nullable(),
			})
			.nullable(),
	}),
	execute: async (context, _options) => {
		const supabase = supabaseAdmin as SupabaseClient<Database>
		const runtimeProjectId = context.runtimeContext?.get?.("project_id")
		const runtimeAccountId = context.runtimeContext?.get?.("account_id")

		// biome-ignore lint/suspicious/noExplicitAny: TypeScript inference limitation with Mastra ToolExecutionContext
		const {
			personId,
			name,
			title,
			role,
			company,
			description,
			primaryEmail,
			primaryPhone,
			location,
			linkedinUrl,
			websiteUrl,
			segment,
			industry,
			timezone,
			pronouns,
			lifecycleStage,
		} = (context as any) || {}

		const projectId = (runtimeProjectId as string) || null
		const accountId = (runtimeAccountId as string) || null

		consola.info("upsert-person: execute start", {
			personId,
			projectId,
			accountId,
			hasName: !!name,
		})

		if (!accountId || !projectId) {
			return {
				success: false,
				message: "Missing accountId or projectId in runtime context",
				person: null,
			}
		}

		try {
			// Build the update object with only provided fields
			const updateData: Record<string, string | null> = {}

			if (name !== undefined) {
				const { firstname, lastname } = parseFullName(name)
				updateData.firstname = firstname || null
				updateData.lastname = lastname || null
			}
			if (title !== undefined) updateData.title = title
			if (role !== undefined) updateData.role = role
			if (company !== undefined) updateData.company = company
			if (description !== undefined) updateData.description = description
			if (primaryEmail !== undefined) updateData.primary_email = primaryEmail
			if (primaryPhone !== undefined) updateData.primary_phone = primaryPhone
			if (location !== undefined) updateData.location = location
			if (linkedinUrl !== undefined) updateData.linkedin_url = linkedinUrl
			if (websiteUrl !== undefined) updateData.website_url = websiteUrl
			if (segment !== undefined) updateData.segment = segment
			if (industry !== undefined) updateData.industry = industry
			if (timezone !== undefined) updateData.timezone = timezone
			if (pronouns !== undefined) updateData.pronouns = pronouns
			if (lifecycleStage !== undefined) updateData.lifecycle_stage = lifecycleStage

			if (Object.keys(updateData).length === 0 && !personId) {
				return {
					success: false,
					message: "No person data provided to create or update",
					person: null,
				}
			}

			let result

			if (personId) {
				// Update existing person
				const { data, error } = await supabase
					.from("people")
					.update(updateData)
					.eq("id", personId)
					.eq("account_id", accountId)
					.select("id, name, title, company, primary_email, primary_phone")
					.single()

				if (error) {
					consola.error("upsert-person: error updating person", error)
					throw error
				}

				result = data
			} else {
				// Create new person (must have at least a name)
				if (!name) {
					return {
						success: false,
						message: "Name is required when creating a new person",
						person: null,
					}
				}

				const { data, error } = await supabase
					.from("people")
					.insert({
						...updateData,
						account_id: accountId,
						project_id: projectId,
					})
					.select("id, name, title, company, primary_email, primary_phone")
					.single()

				if (error) {
					consola.error("upsert-person: error creating person", error)
					throw error
				}

				result = data

				// Link person to project via project_people junction table
				const { error: linkError } = await supabase.from("project_people").insert({
					project_id: projectId,
					person_id: result.id,
				})

				if (linkError) {
					consola.warn("upsert-person: error linking person to project", linkError)
					// Don't fail the whole operation if linking fails
				}
			}

			return {
				success: true,
				message: personId
					? `Successfully updated ${result.name || "person"}`
					: `Successfully created ${result.name || "new person"}`,
				person: {
					id: result.id,
					name: result.name,
					title: result.title,
					company: result.company,
					primaryEmail: result.primary_email,
					primaryPhone: result.primary_phone,
				},
			}
		} catch (error) {
			consola.error("upsert-person: unexpected error", error)
			return {
				success: false,
				message: "Failed to create or update person",
				person: null,
			}
		}
	},
})
