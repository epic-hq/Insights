import { parseWithZod } from "@conform-to/zod"
import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { data } from "react-router"
import { z } from "zod"
import { PLANS, type PlanId } from "~/config/plans"
import { createTeamAccount } from "~/features/teams/db/accounts"
import { getAuthenticatedUser, getServerClient, supabaseAdmin } from "~/lib/supabase/client.server"

const createTeamSchema = z.object({
	name: z.string().min(1, "Team name is required").max(50, "Team name must be 50 characters or less"),
	slug: z
		.string()
		.min(1, "Slug is required")
		.max(50, "Slug must be 50 characters or less")
		.regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"),
})

export async function action({ request }: ActionFunctionArgs) {
	const { client } = getServerClient(request)
	const { user } = await getAuthenticatedUser(request)

	if (!user) {
		return data({ ok: false, error: "Unauthorized" }, { status: 401 })
	}

	// Check team creation limit based on user's plan
	const teamLimitCheck = await checkTeamCreationLimit(user.sub)
	if (!teamLimitCheck.allowed) {
		return data(
			{
				ok: false,
				error: teamLimitCheck.error,
				upgradeRequired: true,
			},
			{ status: 403 }
		)
	}

	const formData = await request.formData()
	const submission = parseWithZod(formData, { schema: createTeamSchema })

	if (submission.status !== "success") {
		return data(
			{
				ok: false,
				error: "Validation failed",
				fieldErrors: submission.error,
			},
			{ status: 400 }
		)
	}

	const { name, slug } = submission.value

	// Create team account
	const { data: teamData, error } = await createTeamAccount({
		supabase: client,
		name,
		slug,
	})

	if (error) {
		return data(
			{
				ok: false,
				error: error.message || "Failed to create team",
			},
			{ status: 500 }
		)
	}

	// Extract account_id from response
	const responseData = teamData as { account_id?: string; id?: string } | null
	const accountId = responseData?.account_id || responseData?.id

	if (!accountId) {
		return data(
			{
				ok: false,
				error: "Team created but couldn't get account ID",
			},
			{ status: 500 }
		)
	}

	return data({
		ok: true,
		accountId,
		name,
		slug,
	})
}

/**
 * Check if user can create a new team based on their plan limits
 */
async function checkTeamCreationLimit(userId: string): Promise<{ allowed: boolean; error?: string }> {
	try {
		// Get user's accounts (to count existing teams)
		const { data: accounts, error: accountsError } = await supabaseAdmin
			.schema("accounts")
			.from("account_user")
			.select(
				`
        account_id,
        accounts!inner (
          id,
          personal_account
        )
      `
			)
			.eq("user_id", userId)

		if (accountsError) {
			consola.error("[teams.create] Error fetching user accounts", accountsError)
			// Allow on error to not block users
			return { allowed: true }
		}

		// Count non-personal accounts (teams) the user owns or is member of
		const teamCount =
			accounts?.filter((a) => !(a.accounts as { personal_account?: boolean })?.personal_account).length ?? 0

		// Get the user's best plan across all their accounts
		const accountIds = accounts?.map((a) => a.account_id) ?? []
		if (accountIds.length === 0) {
			// No accounts - allow creating first team (will be on trial)
			return { allowed: true }
		}

		const { data: subscriptions } = await supabaseAdmin
			.schema("accounts")
			.from("billing_subscriptions")
			.select("account_id, plan_name, status")
			.in("account_id", accountIds)
			.in("status", ["active", "trialing"])

		// Find the best plan the user has access to
		let bestPlanId: PlanId = "free"
		const planPriority: Record<PlanId, number> = {
			free: 0,
			starter: 1,
			pro: 2,
			team: 3,
		}

		for (const sub of subscriptions ?? []) {
			const planId = sub.plan_name?.toLowerCase() as PlanId
			if (planId && planPriority[planId] > planPriority[bestPlanId]) {
				bestPlanId = planId
			}
		}

		const plan = PLANS[bestPlanId]
		const teamLimit = plan.limits.teams

		consola.info("[teams.create] Team limit check", {
			userId,
			teamCount,
			bestPlanId,
			teamLimit,
		})

		// Check limit (Infinity means unlimited)
		if (teamLimit !== Number.POSITIVE_INFINITY && teamCount >= teamLimit) {
			const limitText =
				teamLimit === 0
					? "Your plan doesn't include team workspaces"
					: `You've reached your limit of ${teamLimit} team${teamLimit === 1 ? "" : "s"}`
			return {
				allowed: false,
				error: `${limitText}. Upgrade to create more teams.`,
			}
		}

		return { allowed: true }
	} catch (error) {
		consola.error("[teams.create] Error checking team limit", error)
		// Allow on error to not block users
		return { allowed: true }
	}
}
