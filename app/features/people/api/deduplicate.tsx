/**
 * API endpoint for people deduplication
 *
 * POST: Find and optionally merge duplicate people records
 *
 * Request body:
 * - action: "find" | "merge" | "auto-merge"
 * - dryRun: boolean (default: true)
 * - primaryId: string (required for "merge" action)
 * - duplicateIds: string[] (required for "merge" action)
 */

import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { getServerClient } from "~/lib/supabase/client.server"
import { autoMergeDuplicates, findDuplicates, mergePeople } from "../deduplicate"

export async function action({ request, params }: ActionFunctionArgs) {
	const { client: supabase } = getServerClient(request)
	const accountId = params.accountId
	const projectId = params.projectId

	if (!accountId || !projectId) {
		return Response.json({ error: "Account ID and Project ID are required" }, { status: 400 })
	}

	try {
		const body = await request.json()
		const { action: actionType, dryRun = true } = body

		switch (actionType) {
			case "find": {
				const result = await findDuplicates({
					supabase,
					accountId,
					projectId,
				})

				return Response.json({
					success: result.success,
					duplicateGroups: result.duplicateGroups.map((group) => ({
						key: group.key,
						reason: group.reason,
						people: group.people.map((p) => ({
							id: p.id,
							name: p.name,
							primary_email: p.primary_email,
							linkedin_url: p.linkedin_url,
							company: p.company,
							title: p.title,
							created_at: p.created_at,
						})),
					})),
					errors: result.errors,
				})
			}

			case "merge": {
				const { primaryId, duplicateIds } = body

				if (!primaryId || !Array.isArray(duplicateIds) || duplicateIds.length === 0) {
					return Response.json(
						{
							error: "primaryId and duplicateIds are required for merge action",
						},
						{ status: 400 }
					)
				}

				const result = await mergePeople({
					supabase,
					accountId,
					projectId,
					primaryId,
					duplicateIds,
					dryRun,
				})

				return Response.json(result)
			}

			case "auto-merge": {
				const result = await autoMergeDuplicates({
					supabase,
					accountId,
					projectId,
					dryRun,
				})

				return Response.json(result)
			}

			default:
				return Response.json(
					{
						error: `Unknown action: ${actionType}. Valid actions: find, merge, auto-merge`,
					},
					{ status: 400 }
				)
		}
	} catch (error) {
		consola.error("Deduplicate API error:", error)
		return Response.json({ error: `Failed to process request: ${String(error)}` }, { status: 500 })
	}
}
