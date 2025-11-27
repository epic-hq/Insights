import type { LoaderFunctionArgs } from "react-router"
import { json } from "react-router"
import { supabaseServer } from "~/lib/supabase.server"
import { userContext } from "~/server/user-context"

export async function loader({ request, context }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase

	if (!supabase) {
		throw new Response("Supabase client unavailable", { status: 500 })
	}

	const url = new URL(request.url)
	const accountId = url.searchParams.get("accountId")
	const projectId = url.searchParams.get("projectId")

	if (!accountId) {
		throw new Response("Account ID required", { status: 400 })
	}

	try {
		// Fetch people from interviews or people table
		const { data: interviews } = await supabase
			.from("interviews")
			.select("id, title, contact_name, contact_email, contact_title, contact_company")
			.eq("account_id", accountId)
			.eq("project_id", projectId)
			.not("contact_name", "is", null)

		// Deduplicate by contact_name
		const peopleMap = new Map<string, { id: string; display_name?: string; email?: string; title?: string; company?: string }>()
		interviews?.forEach((interview: { contact_name?: string; contact_email?: string; contact_title?: string; contact_company?: string }) => {
			if (interview.contact_name) {
				const key = `${interview.contact_name}-${interview.contact_email || ""}`
				if (!peopleMap.has(key)) {
					peopleMap.set(key, {
						id: key,
						display_name: interview.contact_name,
						email: interview.contact_email,
						title: interview.contact_title,
						company: interview.contact_company,
					})
				}
			}
		})

		const people = Array.from(peopleMap.values())

		return json({ people })
	} catch (error) {
		console.error("Error fetching people:", error)
		throw new Response("Internal server error", { status: 500 })
	}
}
