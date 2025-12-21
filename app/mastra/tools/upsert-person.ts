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

function normalizeOrganizationName(value: string | null | undefined): string {
	return (value ?? "").trim()
}

async function ensureOrganizationByName(
	supabase: SupabaseClient<Database>,
	{
		accountId,
		projectId,
		name,
	}: {
		accountId: string
		projectId: string
		name: string
	}
): Promise<{ id: string; name: string; created: boolean }> {
	const trimmed = normalizeOrganizationName(name)
	if (!trimmed) {
		throw new Error("Organization name is required")
	}

	const { data: existing, error: existingError } = await supabase
		.from("organizations")
		.select("id, name")
		.eq("account_id", accountId)
		.eq("project_id", projectId)
		.ilike("name", trimmed)
		.order("updated_at", { ascending: false })
		.limit(1)

	if (existingError) {
		throw new Error(`Failed to find organization "${trimmed}": ${existingError.message}`)
	}

	if (existing && existing.length > 0) {
		return { id: existing[0].id, name: existing[0].name, created: false }
	}

	const insertPayload: Database["public"]["Tables"]["organizations"]["Insert"] = {
		account_id: accountId,
		project_id: projectId,
		name: trimmed,
	}

	const { data: inserted, error: insertError } = await supabase
		.from("organizations")
		.insert(insertPayload)
		.select("id, name")
		.single()

	if (insertError || !inserted) {
		throw new Error(`Failed to create organization "${trimmed}": ${insertError?.message ?? "unknown error"}`)
	}

	return { id: inserted.id, name: inserted.name, created: true }
}

async function upsertPersonOrganizationLink(
	supabase: SupabaseClient<Database>,
	{
		accountId,
		projectId,
		personId,
		organizationId,
		role,
		isPrimary,
	}: {
		accountId: string
		projectId: string
		personId: string
		organizationId: string
		role?: string | null
		isPrimary: boolean
	}
) {
	const payload: Database["public"]["Tables"]["people_organizations"]["Insert"] = {
		account_id: accountId,
		project_id: projectId,
		person_id: personId,
		organization_id: organizationId,
		role: role ?? null,
		is_primary: isPrimary,
		relationship_status: null,
		notes: null,
	}

	const { error } = await supabase
		.from("people_organizations")
		.upsert(payload, { onConflict: "person_id,organization_id" })

	if (error) {
		throw new Error(`Failed to link person to organization: ${error.message}`)
	}
}

export const upsertPersonTool = createTool({
	id: "upsert-person",
	description:
		"Create or update a person's basic information including contact details (email, phone), demographics, and title. If company is provided, this tool will ensure an organization record exists and link the person to it.",
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
	execute: async (input, context?) => {
		const supabase = supabaseAdmin as SupabaseClient<Database>
		const runtimeProjectId = context?.requestContext?.get?.("project_id")
		const runtimeAccountId = context?.requestContext?.get?.("account_id")

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
		} = (input as any) || {}

		const projectId = (runtimeProjectId as string) || null
		const accountId = (runtimeAccountId as string) || null

		consola.debug("upsert-person: execute start", {
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
			if (company !== undefined) {
				const normalized_company = normalizeOrganizationName(company)
				updateData.company = normalized_company ? normalized_company : null
			}
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

			type PersonResultRow = {
				id: string
				name: string | null
				title: string | null
				company: string | null
				primary_email: string | null
				primary_phone: string | null
			}

			let result: PersonResultRow
			let organization_linked: { id: string; name: string; created: boolean } | null = null
			let organization_link_error: string | null = null

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

			if (company !== undefined) {
				const normalized_company = normalizeOrganizationName(company)
				if (!normalized_company) {
					try {
						const { error: clearError } = await supabase
							.from("people")
							.update({ default_organization_id: null })
							.eq("id", result.id)
							.eq("account_id", accountId)
							.eq("project_id", projectId)

						if (clearError) {
							throw clearError
						}
					} catch (error) {
						organization_link_error = error instanceof Error ? error.message : "Failed to clear organization link"
						consola.warn("upsert-person: failed to clear default organization", error)
					}
				} else {
					try {
						organization_linked = await ensureOrganizationByName(supabase, {
							accountId,
							projectId,
							name: normalized_company,
						})

						await upsertPersonOrganizationLink(supabase, {
							accountId,
							projectId,
							personId: result.id,
							organizationId: organization_linked.id,
							role: (role ?? title ?? null) as string | null,
							isPrimary: true,
						})

						const { error: defaultOrgError } = await supabase
							.from("people")
							.update({ default_organization_id: organization_linked.id })
							.eq("id", result.id)
							.eq("account_id", accountId)
							.eq("project_id", projectId)

						if (defaultOrgError) {
							throw defaultOrgError
						}
					} catch (error) {
						organization_link_error = error instanceof Error ? error.message : "Failed to link organization"
						consola.warn("upsert-person: failed to ensure/link organization", error)
					}
				}
			}

			const base_message = personId
				? `Successfully updated ${result.name || "person"}`
				: `Successfully created ${result.name || "new person"}`

			const org_message = organization_linked
				? ` Linked to organization "${organization_linked.name}"${organization_linked.created ? " (created)" : ""}.`
				: organization_link_error
					? ` Note: organization link failed (${organization_link_error}).`
					: ""

			return {
				success: true,
				message: `${base_message}.${org_message}`,
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
