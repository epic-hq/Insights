/**
 * Mentionable Users API
 * Returns list of users and people that can be @mentioned in comments
 */
import type { LoaderFunctionArgs } from "react-router"
import { userContext } from "~/server/user-context"

export interface MentionableUser {
	id: string
	name: string
	avatar_url: string | null
	type: "user" | "person"
	subtitle?: string // email for users, title for people
}

export async function loader({ request, context, params }: LoaderFunctionArgs) {
	const { accountId, projectId } = params

	if (!accountId || !projectId) {
		return Response.json({ error: { message: "Missing accountId or projectId" } }, { status: 400 })
	}

	const ctx = context.get(userContext)
	if (!ctx?.supabase) {
		return Response.json({ error: { message: "Unauthorized" } }, { status: 401 })
	}

	const supabase = ctx.supabase

	try {
		// Fetch team members from account_user + user_settings
		const { data: accountUsers } = await supabase
			.schema("accounts")
			.from("account_user")
			.select("user_id")
			.eq("account_id", accountId)

		const userIds = accountUsers?.map((u) => u.user_id) || []

		const { data: userProfiles } = userIds.length > 0
			? await supabase
					.from("user_settings")
					.select("user_id, first_name, last_name, email, image_url")
					.in("user_id", userIds)
			: { data: [] }

		// Fetch project people
		const { data: projectPeople } = await supabase
			.from("people")
			.select("id, firstname, lastname, name, title, primary_email, image_url")
			.eq("project_id", projectId)
			.limit(100)

		// Build mentionable users list
		const mentionableUsers: MentionableUser[] = []

		// Add team members
		for (const profile of userProfiles || []) {
			const name = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || profile.email || "User"
			mentionableUsers.push({
				id: profile.user_id,
				name,
				avatar_url: profile.image_url,
				type: "user",
				subtitle: profile.email || undefined,
			})
		}

		// Add project people
		for (const person of projectPeople || []) {
			const name = person.name || [person.firstname, person.lastname].filter(Boolean).join(" ") || "Unknown"
			mentionableUsers.push({
				id: person.id,
				name,
				avatar_url: person.image_url,
				type: "person",
				subtitle: person.title || person.primary_email || undefined,
			})
		}

		return Response.json({ users: mentionableUsers })
	} catch (error) {
		console.error("Error fetching mentionable users:", error)
		return Response.json({ error: { message: "Failed to fetch users" } }, { status: 500 })
	}
}
