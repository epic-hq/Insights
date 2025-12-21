import { createTool } from "@mastra/core/tools"
import type { SupabaseClient } from "@supabase/supabase-js"
import consola from "consola"
import { z } from "zod"
import { supabaseAdmin } from "~/lib/supabase/client.server"
import type { Database } from "~/types"

const toolInputSchema = z.object({
	action: z.enum(["get", "list", "delete"]),
	interviewId: z.string().optional().describe("Required for get and delete actions"),
	accountId: z.string().optional(),
	projectId: z.string().optional(),
	titleSearch: z.string().optional().describe("Optional case-insensitive title search for list"),
	limit: z.number().int().min(1).max(200).optional().describe("Max rows for list (default 50)"),
	dryRun: z.boolean().optional().describe("For delete: return what would be deleted without mutating"),
	force: z.boolean().optional().describe("For delete: proceed even if linked records exist"),
	confirmTitle: z
		.string()
		.optional()
		.describe("For delete (non-dryRun): must match the interview's current title exactly (case-insensitive)"),
})

type ToolInput = z.infer<typeof toolInputSchema>

type InterviewListRow = Pick<Database["public"]["Tables"]["interviews"]["Row"], "id" | "title" | "created_at" | "status">

const toolOutputSchema = z.object({
	success: z.boolean(),
	message: z.string(),
	interview: z
		.object({
			id: z.string(),
			title: z.string().nullable(),
			status: z.string().nullable().optional(),
		})
		.nullable()
		.optional(),
	interviews: z
		.array(
			z.object({
				id: z.string(),
				title: z.string().nullable(),
				status: z.string().nullable().optional(),
				created_at: z.string().nullable().optional(),
			})
		)
		.optional(),
	linkedCounts: z
		.object({
			evidence: z.number(),
			interview_people: z.number(),
		})
		.optional(),
	dryRun: z.boolean().optional(),
})

async function countLinks(db: SupabaseClient<Database>, interview_id: string, project_id: string) {
	const [evidence_res, interview_people_res] = await Promise.all([
		db.from("evidence").select("id", { count: "exact", head: true }).eq("interview_id", interview_id).eq("project_id", project_id),
		db
			.from("interview_people")
			.select("id", { count: "exact", head: true })
			.eq("interview_id", interview_id)
			.eq("project_id", project_id),
	])

	return {
		evidence: evidence_res.count ?? 0,
		interview_people: interview_people_res.count ?? 0,
	}
}

export const manageInterviewsTool = createTool({
	id: "manage-interviews",
	description:
		"Deterministic interview management: list/get/delete interviews in the current account+project. This deletes interview records only; it does not delete people unless the database has explicit cascades.",
	inputSchema: toolInputSchema,
	outputSchema: toolOutputSchema,
	execute: async (input, context?) => {
		const supabase = supabaseAdmin as SupabaseClient<Database>
		const {
			action,
			interviewId,
			accountId: account_override,
			projectId: project_override,
			titleSearch,
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
				interview: null,
			}
		}

		try {
			if (action === "get") {
				if (!interviewId) {
					return { success: false, message: "interviewId is required for get.", interview: null }
				}

				const { data: interview_row, error } = await supabase
					.from("interviews")
					.select("id, title, status, account_id, project_id")
					.eq("id", interviewId)
					.eq("account_id", resolved_account_id)
					.eq("project_id", resolved_project_id)
					.single()

				if (error || !interview_row) {
					return { success: false, message: "Interview not found.", interview: null }
				}

				return {
					success: true,
					message: "Interview retrieved.",
					interview: {
						id: interview_row.id,
						title: interview_row.title,
						status: interview_row.status,
					},
				}
			}

			if (action === "list") {
				const resolved_limit = limit ?? 50
				let query = supabase
					.from("interviews")
					.select("id, title, status, created_at")
					.eq("account_id", resolved_account_id)
					.eq("project_id", resolved_project_id)
					.order("updated_at", { ascending: false })
					.limit(resolved_limit)

				const trimmed_search = (titleSearch ?? "").trim()
				if (trimmed_search) {
					query = query.ilike("title", `%${trimmed_search.replace(/[%_]/g, "")}%`)
				}

				const { data: interview_rows, error } = await query

				if (error) {
					return {
						success: false,
						message: `Failed to list interviews: ${error.message}`,
						interview: null,
					}
				}

				return {
					success: true,
					message: `Found ${interview_rows?.length || 0} interviews.`,
					interviews:
						(interview_rows as InterviewListRow[] | null)?.map((row) => ({
							id: row.id,
							title: row.title,
							status: row.status,
							created_at: row.created_at,
						})) ?? [],
				}
			}

			if (action === "delete") {
				if (!interviewId) {
					return { success: false, message: "interviewId is required for delete.", interview: null }
				}

				const { data: interview_row, error: fetch_error } = await supabase
					.from("interviews")
					.select("id, title, account_id, project_id")
					.eq("id", interviewId)
					.eq("account_id", resolved_account_id)
					.eq("project_id", resolved_project_id)
					.maybeSingle()

				if (fetch_error || !interview_row) {
					return { success: false, message: "Interview not found.", interview: null }
				}

				const linked_counts = await countLinks(supabase, interview_row.id, resolved_project_id)
				const total_links = linked_counts.evidence + linked_counts.interview_people

				if (dryRun) {
					return {
						success: true,
						message: `Dry run: would delete the interview record ${interview_row.title ?? interview_row.id}. Dependent records may be deleted by database FK cascade; verify linkedCounts first.`,
						interview: {
							id: interview_row.id,
							title: interview_row.title,
						},
						linkedCounts: linked_counts,
						dryRun: true,
					}
				}

				const expected_title = (interview_row.title ?? "").trim()
				const provided_title = (input as ToolInput).confirmTitle?.trim() ?? ""

				if (!expected_title || !provided_title || expected_title.toLowerCase() !== provided_title.toLowerCase()) {
					return {
						success: false,
						message: `Refusing to delete interview because confirmTitle did not match the current interview title. Expected: "${expected_title || "<missing>"}".`,
						interview: {
							id: interview_row.id,
							title: interview_row.title,
						},
						linkedCounts: linked_counts,
					}
				}

				if (total_links > 0 && !force) {
					return {
						success: false,
						message:
							"Refusing to delete interview because linked records exist. Re-run with force=true to delete the interview record and rely on database cascades.",
						interview: {
							id: interview_row.id,
							title: interview_row.title,
						},
						linkedCounts: linked_counts,
					}
				}

				const { error: delete_error } = await supabase
					.from("interviews")
					.delete()
					.eq("id", interview_row.id)
					.eq("account_id", resolved_account_id)
					.eq("project_id", resolved_project_id)

				if (delete_error) {
					return {
						success: false,
						message: `Failed to delete interview: ${delete_error.message}`,
						interview: {
							id: interview_row.id,
							title: interview_row.title,
						},
						linkedCounts: linked_counts,
					}
				}

				return {
					success: true,
					message: `Deleted interview ${interview_row.title ?? interview_row.id}.`,
					interview: {
						id: interview_row.id,
						title: interview_row.title,
					},
					linkedCounts: linked_counts,
				}
			}

			return { success: false, message: `Unknown action: ${action}`, interview: null }
		} catch (error) {
			consola.error("manage-interviews: unexpected failure", error)
			return {
				success: false,
				message: error instanceof Error ? error.message : "Failed to manage interviews.",
				interview: null,
			}
		}
	},
})
