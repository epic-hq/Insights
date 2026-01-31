/**
 * Start endpoint for Research Links (Ask links)
 * Handles different identity modes: anonymous, email-identified, phone-identified
 */
import type { ActionFunctionArgs } from "react-router"
import {
	ResearchLinkAnonymousStartSchema,
	ResearchLinkCreatePersonSchema,
	ResearchLinkPhoneStartSchema,
	ResearchLinkResponseStartSchema,
} from "~/features/research-links/schemas"
import { checkLimitAccess, getAccountPlan } from "~/lib/feature-gate/check-limit.server"
import { createSupabaseAdminClient } from "~/lib/supabase/client.server"

export const loader = () => Response.json({ message: "Method not allowed" }, { status: 405 })

type IdentityMode = "anonymous" | "identified"
type IdentityField = "email" | "phone"

interface ResearchLink {
	id: string
	is_live: boolean
	allow_chat: boolean
	default_response_mode: string | null
	account_id: string
	project_id: string | null
	identity_mode: IdentityMode
	identity_field: IdentityField
}

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

	const supabase = createSupabaseAdminClient()

	// Fetch the research link with identity settings
	const { data: list, error: listError } = await supabase
		.from("research_links")
		.select("id, is_live, allow_chat, default_response_mode, account_id, project_id, identity_mode, identity_field")
		.eq("slug", slug)
		.maybeSingle()

	if (listError) {
		return Response.json({ message: listError.message }, { status: 500 })
	}

	if (!list || !list.is_live) {
		return Response.json({ message: "Research link not found" }, { status: 404 })
	}

	// Default identity_mode to 'identified' and identity_field to 'email' for backwards compatibility
	const identityMode: IdentityMode = (list.identity_mode as IdentityMode) || "identified"
	const identityField: IdentityField = (list.identity_field as IdentityField) || "email"

	const researchLink: ResearchLink = {
		...list,
		identity_mode: identityMode,
		identity_field: identityField,
	}

	// Check survey responses limit (for new responses only - check upfront)
	const planId = await getAccountPlan(list.account_id)
	const limitCheck = await checkLimitAccess(
		{ accountId: list.account_id, userId: "anonymous", planId },
		"survey_responses"
	)
	if (!limitCheck.allowed) {
		return Response.json(
			{
				error: "survey_limit_exceeded",
				message: "This survey has reached its response limit. Please contact the survey owner.",
			},
			{ status: 403 }
		)
	}

	// Check if this is a "create person" request (has firstName) - only for identified modes
	if (identityMode === "identified") {
		const createPersonParsed = ResearchLinkCreatePersonSchema.safeParse(payload)
		if (createPersonParsed.success) {
			return handleCreatePersonAndContinue(supabase, researchLink, createPersonParsed.data)
		}
	}

	// Route based on identity mode
	if (identityMode === "anonymous") {
		return handleAnonymousStart(supabase, researchLink, payload)
	}

	if (identityField === "phone") {
		return handlePhoneStart(supabase, researchLink, payload)
	}

	// Default: email-identified
	return handleEmailStart(supabase, researchLink, payload)
}

/**
 * Handle anonymous survey start - no identification required
 */
async function handleAnonymousStart(
	supabase: ReturnType<typeof createSupabaseAdminClient>,
	list: ResearchLink,
	payload: unknown
) {
	const parsed = ResearchLinkAnonymousStartSchema.safeParse(payload)
	if (!parsed.success) {
		return Response.json({ message: "Invalid request" }, { status: 400 })
	}

	const existingResponseId = parsed.data.responseId
	const responseMode =
		list.allow_chat && parsed.data.responseMode ? parsed.data.responseMode : (list.default_response_mode ?? "form")

	// If we have an existing response ID, try to resume it
	if (existingResponseId) {
		const { data: existingById } = await supabase
			.from("research_link_responses")
			.select("id, responses, completed, person_id")
			.eq("id", existingResponseId)
			.eq("research_link_id", list.id)
			.maybeSingle()
		if (existingById) {
			await supabase.from("research_link_responses").update({ response_mode: responseMode }).eq("id", existingById.id)
			return Response.json({
				responseId: existingById.id,
				responses: existingById.responses ?? {},
				completed: existingById.completed ?? false,
				personId: existingById.person_id,
				identityMode: "anonymous",
			})
		}
	}

	// Create new anonymous response
	const { data: inserted, error: insertError } = await supabase
		.from("research_link_responses")
		.insert({
			research_link_id: list.id,
			email: null, // Anonymous - no email
			phone: null, // Anonymous - no phone
			responses: {},
			completed: false,
			response_mode: responseMode,
		})
		.select("id")
		.maybeSingle()

	if (insertError || !inserted) {
		return Response.json({ message: insertError?.message ?? "Unable to start response" }, { status: 500 })
	}

	return Response.json({
		responseId: inserted.id,
		responses: {},
		completed: false,
		personId: null,
		identityMode: "anonymous",
	})
}

/**
 * Handle phone-identified survey start
 */
async function handlePhoneStart(
	supabase: ReturnType<typeof createSupabaseAdminClient>,
	list: ResearchLink,
	payload: unknown
) {
	const parsed = ResearchLinkPhoneStartSchema.safeParse(payload)
	if (!parsed.success) {
		return Response.json(
			{
				message: parsed.error.flatten().fieldErrors.phone?.[0] ?? "Invalid request",
			},
			{ status: 400 }
		)
	}

	const normalizedPhone = parsed.data.phone.trim().replace(/\s+/g, "")
	const existingResponseId = parsed.data.responseId
	const responseMode =
		list.allow_chat && parsed.data.responseMode ? parsed.data.responseMode : (list.default_response_mode ?? "form")

	// If we have an existing response ID, try to resume it
	if (existingResponseId) {
		const { data: existingById } = await supabase
			.from("research_link_responses")
			.select("id, responses, completed, person_id")
			.eq("id", existingResponseId)
			.eq("research_link_id", list.id)
			.maybeSingle()
		if (existingById) {
			await supabase
				.from("research_link_responses")
				.update({
					phone: normalizedPhone,
					response_mode: responseMode,
				})
				.eq("id", existingById.id)
			return Response.json({
				responseId: existingById.id,
				responses: existingById.responses ?? {},
				completed: existingById.completed ?? false,
				personId: existingById.person_id,
				identityMode: "identified",
				identityField: "phone",
			})
		}
	}

	// Check if a response already exists for this phone on this research link
	const { data: existing, error: existingError } = await supabase
		.from("research_link_responses")
		.select("id, responses, completed, person_id")
		.eq("research_link_id", list.id)
		.eq("phone", normalizedPhone)
		.maybeSingle()

	if (existingError) {
		return Response.json({ message: existingError.message }, { status: 500 })
	}

	if (existing) {
		await supabase
			.from("research_link_responses")
			.update({
				updated_at: new Date().toISOString(),
				response_mode: responseMode,
			})
			.eq("id", existing.id)
		return Response.json({
			responseId: existing.id,
			responses: existing.responses ?? {},
			completed: existing.completed ?? false,
			personId: existing.person_id,
			identityMode: "identified",
			identityField: "phone",
		})
	}

	// Create new phone-identified response
	const { data: inserted, error: insertError } = await supabase
		.from("research_link_responses")
		.insert({
			research_link_id: list.id,
			phone: normalizedPhone,
			responses: {},
			completed: false,
			response_mode: responseMode,
		})
		.select("id")
		.maybeSingle()

	if (insertError || !inserted) {
		return Response.json({ message: insertError?.message ?? "Unable to start response" }, { status: 500 })
	}

	return Response.json({
		responseId: inserted.id,
		responses: {},
		completed: false,
		personId: null,
		identityMode: "identified",
		identityField: "phone",
	})
}

/**
 * Handle email-identified survey start (original flow)
 */
async function handleEmailStart(
	supabase: ReturnType<typeof createSupabaseAdminClient>,
	list: ResearchLink,
	payload: unknown
) {
	const parsed = ResearchLinkResponseStartSchema.safeParse(payload)
	if (!parsed.success) {
		return Response.json(
			{
				message: parsed.error.flatten().fieldErrors.email?.[0] ?? "Invalid request",
			},
			{ status: 400 }
		)
	}

	const normalizedEmail = parsed.data.email.trim().toLowerCase()
	const existingResponseId = parsed.data.responseId
	const responseMode =
		list.allow_chat && parsed.data.responseMode ? parsed.data.responseMode : (list.default_response_mode ?? "form")

	// If we have an existing response ID, try to resume it
	if (existingResponseId) {
		const { data: existingById } = await supabase
			.from("research_link_responses")
			.select("id, responses, completed, person_id")
			.eq("id", existingResponseId)
			.eq("research_link_id", list.id)
			.maybeSingle()
		if (existingById) {
			await supabase
				.from("research_link_responses")
				.update({
					email: normalizedEmail,
					response_mode: responseMode,
				})
				.eq("id", existingById.id)
			return Response.json({
				responseId: existingById.id,
				responses: existingById.responses ?? {},
				completed: existingById.completed ?? false,
				personId: existingById.person_id,
				identityMode: "identified",
				identityField: "email",
			})
		}
	}

	// Check if a response already exists for this email on this research link
	const { data: existing, error: existingError } = await supabase
		.from("research_link_responses")
		.select("id, responses, completed, person_id")
		.eq("research_link_id", list.id)
		.eq("email", normalizedEmail)
		.maybeSingle()

	if (existingError) {
		return Response.json({ message: existingError.message }, { status: 500 })
	}

	if (existing) {
		await supabase
			.from("research_link_responses")
			.update({
				updated_at: new Date().toISOString(),
				response_mode: responseMode,
			})
			.eq("id", existing.id)
		return Response.json({
			responseId: existing.id,
			responses: existing.responses ?? {},
			completed: existing.completed ?? false,
			personId: existing.person_id,
			identityMode: "identified",
			identityField: "email",
		})
	}

	// Look up person by email in the people table for this account
	const { data: existingPerson } = await supabase
		.from("people")
		.select("id, name, firstname, lastname")
		.eq("account_id", list.account_id)
		.eq("primary_email", normalizedEmail)
		.maybeSingle()

	if (existingPerson) {
		// Person exists - create response linked to them
		const { data: inserted, error: insertError } = await supabase
			.from("research_link_responses")
			.insert({
				research_link_id: list.id,
				email: normalizedEmail,
				person_id: existingPerson.id,
				responses: {},
				completed: false,
				response_mode: responseMode,
			})
			.select("id")
			.maybeSingle()

		if (insertError || !inserted) {
			return Response.json({ message: insertError?.message ?? "Unable to start response" }, { status: 500 })
		}

		return Response.json({
			responseId: inserted.id,
			responses: {},
			completed: false,
			personId: existingPerson.id,
			identityMode: "identified",
			identityField: "email",
		})
	}

	// No person found - create response without person_id and signal frontend needs name
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

	return Response.json({
		responseId: inserted.id,
		responses: {},
		completed: false,
		personId: null,
		identityMode: "identified",
		identityField: "email",
	})
}

/**
 * Handle creating a person and linking them to the response
 */
async function handleCreatePersonAndContinue(
	supabase: ReturnType<typeof createSupabaseAdminClient>,
	list: ResearchLink,
	data: {
		email: string
		firstName: string
		lastName?: string | null
		responseId: string
		responseMode?: "form" | "chat"
	}
) {
	const normalizedEmail = data.email.trim().toLowerCase()
	const firstName = data.firstName.trim()
	const lastName = data.lastName?.trim() || null
	const responseMode = list.allow_chat && data.responseMode ? data.responseMode : (list.default_response_mode ?? "form")

	// Check if person already exists by email (race condition check)
	const { data: existingPerson } = await supabase
		.from("people")
		.select("id")
		.eq("account_id", list.account_id)
		.eq("primary_email", normalizedEmail)
		.maybeSingle()

	let personId = existingPerson?.id

	if (!personId) {
		// Create the person record (name is auto-generated from firstname/lastname)
		const { data: newPerson, error: personError } = await supabase
			.from("people")
			.insert({
				account_id: list.account_id,
				project_id: list.project_id,
				primary_email: normalizedEmail,
				firstname: firstName,
				lastname: lastName,
				company: "",
				person_type: "external",
			})
			.select("id")
			.single()

		if (personError || !newPerson) {
			return Response.json({ message: personError?.message ?? "Unable to create person" }, { status: 500 })
		}

		personId = newPerson.id
	}

	// Update the response with the person_id
	const { data: response, error: updateError } = await supabase
		.from("research_link_responses")
		.update({
			person_id: personId,
			response_mode: responseMode,
		})
		.eq("id", data.responseId)
		.select("id, responses, completed")
		.single()

	if (updateError || !response) {
		return Response.json({ message: updateError?.message ?? "Unable to link person to response" }, { status: 500 })
	}

	return Response.json({
		responseId: response.id,
		responses: response.responses ?? {},
		completed: response.completed ?? false,
		personId,
		identityMode: "identified",
		identityField: "email",
	})
}
