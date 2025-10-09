import { parseWithZod } from "@conform-to/zod/v4"
import type { ActionFunctionArgs } from "react-router"
import { data } from "react-router"
import { z } from "zod"
import { createTeamAccount } from "~/features/teams/db/accounts"
import { getAuthenticatedUser, getServerClient } from "~/lib/supabase/server"

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
	const user = await getAuthenticatedUser(request)

	if (!user) {
		return data({ ok: false, error: "Unauthorized" }, { status: 401 })
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
