import type { ActionFunctionArgs } from "react-router"
import { ResearchLinkResponseStartSchema } from "~/features/research-links/schemas"
import { createSupabaseAdminClient } from "~/lib/supabase/client.server"

export const loader = () => Response.json({ message: "Method not allowed" }, { status: 405 })

export async function action({ request, params }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ message: "Method not allowed" }, { status: 405 })
	}

	const slug = params.slug
	if (!slug) {
		return Response.json({ message: "Missing slug" }, { status: 400 })
	}

	let payload: unknown
	try {
		payload = await request.json()
	} catch {
		return Response.json({ message: "Invalid JSON payload" }, { status: 400 })
	}

	const parsed = ResearchLinkResponseStartSchema.safeParse(payload)
	if (!parsed.success) {
		return Response.json(
			{ message: parsed.error.flatten().fieldErrors.email?.[0] ?? "Invalid request" },
			{ status: 400 }
		)
	}

	const supabase = createSupabaseAdminClient()
	const { data: list, error: listError } = await supabase
		.from("research_links")
		.select("id, is_live, allow_chat, default_response_mode")
		.eq("slug", slug)
		.maybeSingle()

	if (listError) {
		return Response.json({ message: listError.message }, { status: 500 })
	}

	if (!list || !list.is_live) {
		return Response.json({ message: "Research link not found" }, { status: 404 })
	}

	const normalizedEmail = parsed.data.email.trim().toLowerCase()
	const existingResponseId = parsed.data.responseId
	const responseMode =
		list.allow_chat && parsed.data.responseMode ? parsed.data.responseMode : (list.default_response_mode ?? "form")

	if (existingResponseId) {
		const { data: existingById } = await supabase
			.from("research_link_responses")
			.select("id, responses, completed")
			.eq("id", existingResponseId)
			.eq("research_link_id", list.id)
			.maybeSingle()
		if (existingById) {
			await supabase
				.from("research_link_responses")
				.update({ email: normalizedEmail, response_mode: responseMode })
				.eq("id", existingById.id)
			return Response.json({
				responseId: existingById.id,
				responses: existingById.responses ?? {},
				completed: existingById.completed ?? false,
			})
		}
	}

	const { data: existing, error: existingError } = await supabase
		.from("research_link_responses")
		.select("id, responses, completed")
		.eq("research_link_id", list.id)
		.eq("email", normalizedEmail)
		.maybeSingle()

	if (existingError) {
		return Response.json({ message: existingError.message }, { status: 500 })
	}

	if (existing) {
		await supabase
			.from("research_link_responses")
			.update({ updated_at: new Date().toISOString(), response_mode: responseMode })
			.eq("id", existing.id)
		return Response.json({
			responseId: existing.id,
			responses: existing.responses ?? {},
			completed: existing.completed ?? false,
		})
	}

	const { data: inserted, error: insertError } = await supabase
		.from("research_link_responses")
		.insert({
			research_link_id: list.id,
			email: normalizedEmail,
			responses: {},
			completed: false,
			response_mode: responseMode,
		})
		.select("id")
		.maybeSingle()

	if (insertError || !inserted) {
		return Response.json({ message: insertError?.message ?? "Unable to start response" }, { status: 500 })
	}

	return { responseId: inserted.id, responses: {}, completed: false }
}
