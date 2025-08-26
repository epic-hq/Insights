/**
 * API route to backfill missing people for interviews
 * This addresses the issue where some interviews don't have associated person records
 */

import type { ActionFunctionArgs } from "react-router"
import { getServerClient } from "~/lib/supabase/server"
import { backfillMissingPeople, getInterviewPeopleStats } from "~/utils/backfillPeople.server"

export async function action({ request }: ActionFunctionArgs) {
	try {
		// User already authenticated by middleware, get from context instead of making API call
		const user = await getAuthenticatedUser(request)
		const _supabase = getServerClient(request)

		if (!user) {
			return Response.json({ error: "User not authenticated" }, { status: 401 })
		}

		// Extract account ID from user context (no additional API calls needed)
		const accountId = user.sub || user.id

		if (!accountId) {
			return Response.json({ error: "Account ID not found in user claims" }, { status: 400 })
		}

		const formData = await request.formData()
		const action = formData.get("action")?.toString()
		const dryRun = formData.get("dryRun") === "true"

		if (action === "stats") {
			// Get statistics about interviews and people
			const stats = await getInterviewPeopleStats(request, accountId)
			return Response.json({
				success: true,
				stats,
			})
		}

		if (action === "backfill") {
			// Run the backfill process
			const result = await backfillMissingPeople(request, {
				accountId,
				dryRun,
			})

			return Response.json({
				success: true,
				result,
				message: dryRun
					? `Dry run completed: Would create ${result.peopleCreated} people and ${result.linksCreated} links`
					: `Backfill completed: Created ${result.peopleCreated} people and ${result.linksCreated} links`,
			})
		}

		return Response.json({ error: "Invalid action. Use 'stats' or 'backfill'" }, { status: 400 })
	} catch (error) {
		return Response.json(
			{
				error: error instanceof Error ? error.message : "Unknown error occurred",
			},
			{ status: 500 }
		)
	}
}
