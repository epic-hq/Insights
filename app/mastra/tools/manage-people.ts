import { createTool } from "@mastra/core/tools"
import type { SupabaseClient } from "@supabase/supabase-js"
import consola from "consola"
import { z } from "zod"
import { supabaseAdmin } from "~/lib/supabase/client.server"
import type { Database } from "~/types"

const toolInputSchema = z.object({
	action: z.enum(["get", "list", "delete"]),
	personId: z.string().optional().describe("Required for get and delete actions"),
	accountId: z.string().optional(),
	projectId: z.string().optional(),
	nameSearch: z.string().optional().describe("Optional case-insensitive name search for list"),
	limit: z.number().int().min(1).max(200).optional().describe("Max rows for list (default 50)"),
	dryRun: z.boolean().optional().describe("For delete: return what would be deleted without mutating"),
	force: z.boolean().optional().describe("For delete: proceed even if linked records exist"),
	confirmName: z
		.string()
		.optional()
		.describe("For delete (non-dryRun): must match the person's current name exactly (case-insensitive)"),
})

type ToolInput = z.infer<typeof toolInputSchema>

type PersonListRow = Pick<
	Database["public"]["Tables"]["people"]["Row"],
	"id" | "name" | "title" | "company" | "primary_email" | "segment" | "project_id" | "account_id"
>

const toolOutputSchema = z.object({
	success: z.boolean(),
	message: z.string(),
	person: z
		.object({
			id: z.string(),
			name: z.string().nullable(),
			title: z.string().nullable(),
			company: z.string().nullable(),
			primary_email: z.string().nullable(),
			segment: z.string().nullable(),
		})
		.nullable()
		.optional(),
	linkedInterviews: z
		.array(
			z.object({
				id: z.string(),
				title: z.string().nullable(),
			})
		)
		.optional(),
	people: z
		.array(
			z.object({
				id: z.string(),
				name: z.string().nullable(),
				title: z.string().nullable(),
				company: z.string().nullable(),
				primary_email: z.string().nullable(),
				segment: z.string().nullable(),
			})
		)
		.optional(),
	linkedCounts: z
		.object({
			interview_people: z.number(),
			project_people: z.number(),
			people_organizations: z.number(),
			people_personas: z.number(),
		})
		.optional(),
	dryRun: z.boolean().optional(),
})

async function countLinks(db: SupabaseClient<Database>, person_id: string) {
	const [interview_people_res, project_people_res, people_organizations_res, people_personas_res] = await Promise.all([
		db.from("interview_people").select("id", { count: "exact", head: true }).eq("person_id", person_id),
		db.from("project_people").select("id", { count: "exact", head: true }).eq("person_id", person_id),
		db.from("people_organizations").select("id", { count: "exact", head: true }).eq("person_id", person_id),
		db.from("people_personas").select("person_id", { count: "exact", head: true }).eq("person_id", person_id),
	])

	return {
		interview_people: interview_people_res.count ?? 0,
		project_people: project_people_res.count ?? 0,
		people_organizations: people_organizations_res.count ?? 0,
		people_personas: people_personas_res.count ?? 0,
	}
}

export const managePeopleTool = createTool({
	id: "manage-people",
	description:
		"Deterministic people management: list/get/delete people in the current account+project. Deleting a person deletes the person record and may cascade junction rows (interview_people, project_people, people_organizations, people_personas) but does NOT delete interview records. Returns linkedInterviews so callers can optionally delete interviews separately.",
	inputSchema: toolInputSchema,
	outputSchema: toolOutputSchema,
	execute: async (input, context?) => {
		const supabase = supabaseAdmin as SupabaseClient<Database>
		const {
			action,
			personId,
			accountId: account_override,
			projectId: project_override,
			nameSearch,
			limit,
			dryRun,
			force,
		} = input as ToolInput

		const runtime_account_id = context?.requestContext?.get?.("account_id") as string | undefined
		const runtime_project_id = context?.requestContext?.get?.("project_id") as string | undefined

		const resolved_account_id = account_override || runtime_account_id
		const resolved_project_id = project_override || runtime_project_id

		if (!resolved_account_id || !resolved_project_id) {
			return {
				success: false,
				message: "Account ID and Project ID are required.",
				person: null,
			}
		}

		try {
			if (action === "get") {
				if (!personId) {
					return { success: false, message: "personId is required for get.", person: null }
				}

				const { data: person_row, error } = await supabase
					.from("people")
					.select("id, name, title, company, primary_email, segment, account_id, project_id")
					.eq("id", personId)
					.eq("account_id", resolved_account_id)
					.eq("project_id", resolved_project_id)
					.single()

				if (error || !person_row) {
					return { success: false, message: "Person not found.", person: null }
				}

				return {
					success: true,
					message: "Person retrieved.",
					person: {
						id: person_row.id,
						name: person_row.name,
						title: person_row.title,
						company: person_row.company,
						primary_email: person_row.primary_email,
						segment: person_row.segment,
					},
				}
			}

			if (action === "list") {
				const resolved_limit = limit ?? 50
				let query = supabase
					.from("people")
					.select("id, name, title, company, primary_email, segment")
					.eq("account_id", resolved_account_id)
					.eq("project_id", resolved_project_id)
					.order("updated_at", { ascending: false })
					.limit(resolved_limit)

				const trimmed_search = (nameSearch ?? "").trim()
				if (trimmed_search) {
					query = query.ilike("name", `%${trimmed_search.replace(/[%_]/g, "")}%`)
				}

				const { data: people_rows, error } = await query

				if (error) {
					return {
						success: false,
						message: `Failed to list people: ${error.message}`,
						person: null,
					}
				}

				return {
					success: true,
					message: `Found ${people_rows?.length || 0} people.`,
					people:
						(people_rows as PersonListRow[] | null)?.map((row) => ({
							id: row.id,
							name: row.name,
							title: row.title,
							company: row.company,
							primary_email: row.primary_email,
							segment: row.segment,
						})) ?? [],
				}
			}

			if (action === "delete") {
				if (!personId) {
					return { success: false, message: "personId is required for delete.", person: null }
				}

				const { data: person_row, error: fetch_error } = await supabase
					.from("people")
					.select("id, name, account_id, project_id")
					.eq("id", personId)
					.eq("account_id", resolved_account_id)
					.eq("project_id", resolved_project_id)
					.maybeSingle()

				if (fetch_error || !person_row) {
					return { success: false, message: "Person not found.", person: null }
				}

				const linked_counts = await countLinks(supabase, person_row.id)
				const { data: interview_links } = await supabase
					.from("interview_people")
					.select("interview_id")
					.eq("person_id", person_row.id)
					.eq("project_id", resolved_project_id)

				const linked_interview_ids = Array.from(
					new Set((interview_links ?? []).map((row) => row.interview_id).filter(Boolean))
				) as string[]

				const { data: interview_rows } = linked_interview_ids.length
					? await supabase
						.from("interviews")
						.select("id, title")
						.in("id", linked_interview_ids)
						.eq("account_id", resolved_account_id)
						.eq("project_id", resolved_project_id)
					: { data: [] as { id: string; title: string | null }[] }

				const linked_interviews = (interview_rows ?? []).map((row) => ({ id: row.id, title: row.title }))
				const total_links =
					linked_counts.interview_people +
					linked_counts.project_people +
					linked_counts.people_organizations +
					linked_counts.people_personas

				if (dryRun) {
					return {
						success: true,
						message: `Dry run: would delete the person record ${person_row.name ?? person_row.id} and remove linked rows (interview_people, project_people, people_organizations, people_personas). This does NOT delete interview records.`,
						person: {
							id: person_row.id,
							name: person_row.name,
							title: null,
							company: null,
							primary_email: null,
							segment: null,
						},
						linkedInterviews: linked_interviews,
						linkedCounts: linked_counts,
						dryRun: true,
					}
				}

				const expected_name = (person_row.name ?? "").trim()
				const provided_name = (input as ToolInput).confirmName?.trim() ?? ""

				if (!expected_name || !provided_name || expected_name.toLowerCase() !== provided_name.toLowerCase()) {
					return {
						success: false,
						message: `Refusing to delete person because confirmName did not match the current person name. Expected: "${expected_name || "<missing>"}".`,
						person: {
							id: person_row.id,
							name: person_row.name,
							title: null,
							company: null,
							primary_email: null,
							segment: null,
						},
						linkedCounts: linked_counts,
					}
				}

				if (total_links > 0 && !force) {
					return {
						success: false,
						message:
							"Refusing to delete person because linked records exist. Re-run with force=true to delete and cascade.",
						person: {
							id: person_row.id,
							name: person_row.name,
							title: null,
							company: null,
							primary_email: null,
							segment: null,
						},
						linkedCounts: linked_counts,
					}
				}

				const { error: delete_error } = await supabase
					.from("people")
					.delete()
					.eq("id", person_row.id)
					.eq("account_id", resolved_account_id)
					.eq("project_id", resolved_project_id)

				if (delete_error) {
					return {
						success: false,
						message: `Failed to delete person: ${delete_error.message}`,
						person: {
							id: person_row.id,
							name: person_row.name,
							title: null,
							company: null,
							primary_email: null,
							segment: null,
						},
						linkedInterviews: linked_interviews,
						linkedCounts: linked_counts,
					}
				}

				return {
					success: true,
					message: `Deleted person ${person_row.name ?? person_row.id}. Interview records were NOT deleted.`,
					person: {
						id: person_row.id,
						name: person_row.name,
						title: null,
						company: null,
						primary_email: null,
						segment: null,
					},
					linkedInterviews: linked_interviews,
					linkedCounts: linked_counts,
				}
			}

			return { success: false, message: `Unknown action: ${action}`, person: null }
		} catch (error) {
			consola.error("manage-people: unexpected failure", error)
			return {
				success: false,
				message: error instanceof Error ? error.message : "Failed to manage people.",
				person: null,
			}
		}
	},
})
