/**
 * Start endpoint for Research Links (Ask links)
 * Handles different identity modes: anonymous, email-identified, phone-identified
 */
import consola from "consola";
import type { ActionFunctionArgs } from "react-router";
import { standardizeSizeRange, syncOrgDataToPersonFacets } from "~/features/people/syncOrgDataToPersonFacets.server";
import { syncPeopleFieldsToFacets } from "~/features/people/syncPeopleFieldsToFacets.server";
import { syncTitleToJobTitleFacet } from "~/features/people/syncTitleToFacet.server";
import { fetchPersonAttributesForBranching } from "~/features/research-links/lib/person-branching-context.server";
import {
	ResearchLinkAnonymousStartSchema,
	ResearchLinkCreatePersonSchema,
	ResearchLinkPhoneStartSchema,
	ResearchLinkResponseStartSchema,
} from "~/features/research-links/schemas";
import { checkLimitAccess, getAccountPlan } from "~/lib/feature-gate/check-limit.server";
import { getPostHogServerClient } from "~/lib/posthog.server";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";

export const loader = () => Response.json({ message: "Method not allowed" }, { status: 405 });

type IdentityMode = "anonymous" | "identified";
type IdentityField = "email" | "phone";

interface ResearchLink {
	id: string;
	name: string;
	is_live: boolean;
	allow_chat: boolean;
	default_response_mode: string | null;
	account_id: string;
	project_id: string | null;
	survey_owner_user_id: string | null;
	identity_mode: IdentityMode;
	identity_field: IdentityField;
}

export async function action({ request, params }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ message: "Method not allowed" }, { status: 405 });
	}

	const slug = params.slug;
	if (!slug) {
		return Response.json({ message: "Missing slug" }, { status: 400 });
	}

	let payload: unknown;
	try {
		payload = await request.json();
	} catch {
		return Response.json({ message: "Invalid JSON payload" }, { status: 400 });
	}

	const supabase = createSupabaseAdminClient();

	// Fetch the research link with identity settings
	const { data: list, error: listError } = await supabase
		.from("research_links")
		.select(
			"id, name, is_live, allow_chat, default_response_mode, account_id, project_id, survey_owner_user_id, identity_mode, identity_field"
		)
		.eq("slug", slug)
		.maybeSingle();

	if (listError) {
		return Response.json({ message: listError.message }, { status: 500 });
	}

	if (!list || !list.is_live) {
		return Response.json({ message: "Research link not found" }, { status: 404 });
	}

	// Default identity_mode to 'identified' and identity_field to 'email' for backwards compatibility
	const identityMode: IdentityMode = (list.identity_mode as IdentityMode) || "identified";
	const identityField: IdentityField = (list.identity_field as IdentityField) || "email";

	const researchLink: ResearchLink = {
		...list,
		identity_mode: identityMode,
		identity_field: identityField,
	};

	// Check survey responses limit (for new responses only - check upfront)
	const planId = await getAccountPlan(list.account_id);
	const limitCheck = await checkLimitAccess(
		{ accountId: list.account_id, userId: "anonymous", planId },
		"survey_responses"
	);
	if (!limitCheck.allowed) {
		return Response.json(
			{
				error: "survey_limit_exceeded",
				message: "This survey has reached its response limit. Please contact the survey owner.",
			},
			{ status: 403 }
		);
	}

	// Check if this is a "create person" request (has firstName) - only for identified modes
	if (identityMode === "identified") {
		const createPersonParsed = ResearchLinkCreatePersonSchema.safeParse(payload);
		if (createPersonParsed.success) {
			return handleCreatePersonAndContinue(supabase, researchLink, createPersonParsed.data);
		}
	}

	// Route based on identity mode
	if (identityMode === "anonymous") {
		return handleAnonymousStart(supabase, researchLink, payload);
	}

	if (identityField === "phone") {
		return handlePhoneStart(supabase, researchLink, payload);
	}

	// Default: email-identified
	return handleEmailStart(supabase, researchLink, payload);
}

async function getPersonAttributesOrEmpty(
	supabase: ReturnType<typeof createSupabaseAdminClient>,
	personId: string | null | undefined
) {
	if (!personId) return {};
	return fetchPersonAttributesForBranching(supabase, personId);
}

/**
 * Handle anonymous survey start - no identification required
 */
async function handleAnonymousStart(
	supabase: ReturnType<typeof createSupabaseAdminClient>,
	list: ResearchLink,
	payload: unknown
) {
	const parsed = ResearchLinkAnonymousStartSchema.safeParse(payload);
	if (!parsed.success) {
		return Response.json({ message: "Invalid request" }, { status: 400 });
	}

	const existingResponseId = parsed.data.responseId;
	const responseMode =
		list.allow_chat && parsed.data.responseMode ? parsed.data.responseMode : (list.default_response_mode ?? "form");
	const utmParams = parsed.data.utmParams ?? null;

	// If we have an existing response ID, try to resume it
	if (existingResponseId) {
		const { data: existingById } = await supabase
			.from("research_link_responses")
			.select("id, responses, completed, person_id")
			.eq("id", existingResponseId)
			.eq("research_link_id", list.id)
			.maybeSingle();
		if (existingById) {
			await supabase.from("research_link_responses").update({ response_mode: responseMode }).eq("id", existingById.id);
			return Response.json({
				responseId: existingById.id,
				responses: existingById.responses ?? {},
				completed: existingById.completed ?? false,
				personId: existingById.person_id,
				personAttributes: await getPersonAttributesOrEmpty(supabase, existingById.person_id),
				identityMode: "anonymous",
			});
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
			...(utmParams ? { utm_params: utmParams } : {}),
		})
		.select("id")
		.maybeSingle();

	if (insertError || !inserted) {
		return Response.json({ message: insertError?.message ?? "Unable to start response" }, { status: 500 });
	}

	trackSurveyStarted({ list, responseId: inserted.id, responseMode, identityMode: "anonymous" });

	return Response.json({
		responseId: inserted.id,
		responses: {},
		completed: false,
		personId: null,
		personAttributes: {},
		identityMode: "anonymous",
	});
}

/**
 * Handle phone-identified survey start
 */
async function handlePhoneStart(
	supabase: ReturnType<typeof createSupabaseAdminClient>,
	list: ResearchLink,
	payload: unknown
) {
	const parsed = ResearchLinkPhoneStartSchema.safeParse(payload);
	if (!parsed.success) {
		return Response.json(
			{
				message: parsed.error.flatten().fieldErrors.phone?.[0] ?? "Invalid request",
			},
			{ status: 400 }
		);
	}

	const normalizedPhone = parsed.data.phone.trim().replace(/\s+/g, "");
	const existingResponseId = parsed.data.responseId;
	const responseMode =
		list.allow_chat && parsed.data.responseMode ? parsed.data.responseMode : (list.default_response_mode ?? "form");
	const utmParams = parsed.data.utmParams ?? null;

	// If we have an existing response ID, try to resume it
	if (existingResponseId) {
		const { data: existingById } = await supabase
			.from("research_link_responses")
			.select("id, responses, completed, person_id")
			.eq("id", existingResponseId)
			.eq("research_link_id", list.id)
			.maybeSingle();
		if (existingById) {
			await supabase
				.from("research_link_responses")
				.update({
					phone: normalizedPhone,
					response_mode: responseMode,
				})
				.eq("id", existingById.id);
			return Response.json({
				responseId: existingById.id,
				responses: existingById.responses ?? {},
				completed: existingById.completed ?? false,
				personId: existingById.person_id,
				personAttributes: await getPersonAttributesOrEmpty(supabase, existingById.person_id),
				identityMode: "identified",
				identityField: "phone",
			});
		}
	}

	// Check if a response already exists for this phone on this research link
	const { data: existing, error: existingError } = await supabase
		.from("research_link_responses")
		.select("id, responses, completed, person_id")
		.eq("research_link_id", list.id)
		.eq("phone", normalizedPhone)
		.maybeSingle();

	if (existingError) {
		return Response.json({ message: existingError.message }, { status: 500 });
	}

	if (existing) {
		await supabase
			.from("research_link_responses")
			.update({
				updated_at: new Date().toISOString(),
				response_mode: responseMode,
			})
			.eq("id", existing.id);
		return Response.json({
			responseId: existing.id,
			responses: existing.responses ?? {},
			completed: existing.completed ?? false,
			personId: existing.person_id,
			personAttributes: await getPersonAttributesOrEmpty(supabase, existing.person_id),
			identityMode: "identified",
			identityField: "phone",
		});
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
			...(utmParams ? { utm_params: utmParams } : {}),
		})
		.select("id")
		.maybeSingle();

	if (insertError || !inserted) {
		return Response.json({ message: insertError?.message ?? "Unable to start response" }, { status: 500 });
	}

	trackSurveyStarted({ list, responseId: inserted.id, responseMode, identityMode: "identified" });

	return Response.json({
		responseId: inserted.id,
		responses: {},
		completed: false,
		personId: null,
		personAttributes: {},
		identityMode: "identified",
		identityField: "phone",
	});
}

/**
 * Handle email-identified survey start (original flow)
 */
async function handleEmailStart(
	supabase: ReturnType<typeof createSupabaseAdminClient>,
	list: ResearchLink,
	payload: unknown
) {
	const parsed = ResearchLinkResponseStartSchema.safeParse(payload);
	if (!parsed.success) {
		return Response.json(
			{
				message: parsed.error.flatten().fieldErrors.email?.[0] ?? "Invalid request",
			},
			{ status: 400 }
		);
	}

	const normalizedEmail = parsed.data.email.trim().toLowerCase();
	const existingResponseId = parsed.data.responseId;
	const responseMode =
		list.allow_chat && parsed.data.responseMode ? parsed.data.responseMode : (list.default_response_mode ?? "form");
	const utmParams = parsed.data.utmParams ?? null;

	// If we have an existing response ID, try to resume it
	if (existingResponseId) {
		const { data: existingById } = await supabase
			.from("research_link_responses")
			.select("id, responses, completed, person_id")
			.eq("id", existingResponseId)
			.eq("research_link_id", list.id)
			.maybeSingle();
		if (existingById) {
			await supabase
				.from("research_link_responses")
				.update({
					email: normalizedEmail,
					response_mode: responseMode,
				})
				.eq("id", existingById.id);
			return Response.json({
				responseId: existingById.id,
				responses: existingById.responses ?? {},
				completed: existingById.completed ?? false,
				personId: existingById.person_id,
				personAttributes: await getPersonAttributesOrEmpty(supabase, existingById.person_id),
				identityMode: "identified",
				identityField: "email",
			});
		}
	}

	// Check if a response already exists for this email on this research link
	const { data: existing, error: existingError } = await supabase
		.from("research_link_responses")
		.select("id, responses, completed, person_id")
		.eq("research_link_id", list.id)
		.eq("email", normalizedEmail)
		.maybeSingle();

	if (existingError) {
		return Response.json({ message: existingError.message }, { status: 500 });
	}

	if (existing) {
		let personId = existing.person_id;

		// Backfill: if response exists but person_id is null, re-check people table
		if (!personId) {
			const { data: backfillPeople } = await supabase
				.from("people")
				.select("id")
				.eq("account_id", list.account_id)
				.eq("primary_email", normalizedEmail)
				.limit(1);
			const backfillPerson = backfillPeople?.[0];
			if (backfillPerson) {
				personId = backfillPerson.id;
				await supabase.from("research_link_responses").update({ person_id: backfillPerson.id }).eq("id", existing.id);
			}
		}

		await supabase
			.from("research_link_responses")
			.update({
				updated_at: new Date().toISOString(),
				response_mode: responseMode,
			})
			.eq("id", existing.id);
		return Response.json({
			responseId: existing.id,
			responses: existing.responses ?? {},
			completed: existing.completed ?? false,
			personId,
			personAttributes: await getPersonAttributesOrEmpty(supabase, personId),
			identityMode: "identified",
			identityField: "email",
		});
	}

	// Look up person by email in the people table for this account
	// Use limit(1) instead of maybeSingle() to handle duplicate people records gracefully
	const { data: existingPeople } = await supabase
		.from("people")
		.select("id, name, firstname, lastname, title, job_function, default_organization_id")
		.eq("account_id", list.account_id)
		.eq("primary_email", normalizedEmail)
		.limit(1);
	const existingPerson = existingPeople?.[0] ?? null;

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
				...(utmParams ? { utm_params: utmParams } : {}),
			})
			.select("id")
			.maybeSingle();

		if (insertError || !inserted) {
			return Response.json({ message: insertError?.message ?? "Unable to start response" }, { status: 500 });
		}

		// Fetch org data for the person profile
		let orgName: string | null = null;
		let orgIndustry: string | null = null;
		let orgSizeRange: string | null = null;
		if (existingPerson.default_organization_id) {
			const { data: org } = await supabase
				.from("organizations")
				.select("name, industry, size_range")
				.eq("id", existingPerson.default_organization_id)
				.maybeSingle();
			if (org) {
				orgName = org.name;
				orgIndustry = org.industry;
				orgSizeRange = org.size_range;
			}
		}

		return Response.json({
			responseId: inserted.id,
			responses: {},
			completed: false,
			personId: existingPerson.id,
			personAttributes: await getPersonAttributesOrEmpty(supabase, existingPerson.id),
			identityMode: "identified",
			identityField: "email",
			personProfile: {
				firstName: existingPerson.firstname,
				lastName: existingPerson.lastname,
				company: orgName,
				title: existingPerson.title,
				jobFunction: existingPerson.job_function,
				industry: orgIndustry,
				companySize: orgSizeRange,
			},
		});
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
			...(utmParams ? { utm_params: utmParams } : {}),
		})
		.select("id")
		.maybeSingle();

	if (insertError || !inserted) {
		return Response.json({ message: insertError?.message ?? "Unable to start response" }, { status: 500 });
	}

	trackSurveyStarted({ list, responseId: inserted.id, responseMode, identityMode: "identified" });

	return Response.json({
		responseId: inserted.id,
		responses: {},
		completed: false,
		personId: null,
		personAttributes: {},
		identityMode: "identified",
		identityField: "email",
	});
}

/**
 * Handle creating a person and linking them to the response
 */
async function handleCreatePersonAndContinue(
	supabase: ReturnType<typeof createSupabaseAdminClient>,
	list: ResearchLink,
	data: {
		email: string;
		firstName: string;
		lastName?: string | null;
		company?: string | null;
		title?: string | null;
		jobFunction?: string | null;
		industry?: string | null;
		companySize?: string | null;
		phone?: string | null;
		responseId: string;
		responseMode?: "form" | "chat";
	}
) {
	const normalizedEmail = data.email.trim().toLowerCase();
	const firstName = data.firstName.trim();
	const lastName = data.lastName?.trim() || null;
	const companyName = data.company?.trim() || null;
	const title = data.title?.trim() || null;
	const jobFunction = data.jobFunction?.trim() || null;
	const industry = data.industry?.trim() || null;
	const companySize = standardizeSizeRange(data.companySize);
	const primaryPhone = data.phone?.trim() || null;
	const responseMode =
		list.allow_chat && data.responseMode ? data.responseMode : (list.default_response_mode ?? "form");

	async function ensureOrganizationId(): Promise<string | null> {
		if (!companyName || !list.account_id) return organizationId;
		if (organizationId) return organizationId;

		const { data: existingOrg } = await supabase
			.from("organizations")
			.select("id")
			.eq("account_id", list.account_id)
			.ilike("name", companyName)
			.maybeSingle();
		if (existingOrg?.id) {
			organizationId = existingOrg.id;
			return organizationId;
		}

		const { data: newOrg, error: orgError } = await supabase
			.from("organizations")
			.insert({
				account_id: list.account_id,
				project_id: list.project_id,
				name: companyName,
				industry,
				size_range: companySize,
			})
			.select("id")
			.single();

		if (!orgError && newOrg?.id) {
			organizationId = newOrg.id;
			return organizationId;
		}

		if (orgError?.code === "23505") {
			const { data: raceOrg } = await supabase
				.from("organizations")
				.select("id")
				.eq("account_id", list.account_id)
				.ilike("name", companyName)
				.maybeSingle();
			if (raceOrg?.id) {
				organizationId = raceOrg.id;
				return organizationId;
			}
		}

		return null;
	}

	// Check if person already exists by email (race condition check)
	const { data: existingPerson } = await supabase
		.from("people")
		.select("id, title, job_function, primary_phone, default_organization_id")
		.eq("account_id", list.account_id)
		.eq("primary_email", normalizedEmail)
		.maybeSingle();

	const createdNewPerson = !existingPerson?.id;
	let personId = existingPerson?.id;
	let organizationId = existingPerson?.default_organization_id ?? null;

	if (!personId) {
		// Phase 3: Resolve organization if company name provided
		organizationId = await ensureOrganizationId();

		// Create the person record (name is auto-generated from firstname/lastname)
		const { data: newPerson, error: personError } = await supabase
			.from("people")
			.insert({
				account_id: list.account_id,
				project_id: list.project_id,
				primary_email: normalizedEmail,
				primary_phone: primaryPhone,
				firstname: firstName,
				lastname: lastName,
				title,
				job_function: jobFunction,
				default_organization_id: organizationId,
				person_type: "external",
			})
			.select("id")
			.single();

		if (personError || !newPerson) {
			return Response.json({ message: personError?.message ?? "Unable to create person" }, { status: 500 });
		}

		personId = newPerson.id;

		// Phase 3: Create people_organizations join table record if organization exists
		if (organizationId) {
			const { error: linkError } = await supabase.from("people_organizations").insert({
				account_id: list.account_id,
				project_id: list.project_id,
				person_id: personId,
				organization_id: organizationId,
				is_primary: true,
			});

			if (linkError) {
				consola.warn("[research-link-start] Failed to create people_organizations link:", linkError);
				// Don't fail the whole request - person was created successfully
			}
		}
	}

	if (personId && existingPerson) {
		const personUpdate: Record<string, string> = {};
		if (title && !existingPerson.title) personUpdate.title = title;
		if (jobFunction && !existingPerson.job_function) personUpdate.job_function = jobFunction;
		if (primaryPhone && !existingPerson.primary_phone) personUpdate.primary_phone = primaryPhone;
		if (Object.keys(personUpdate).length > 0) {
			await supabase.from("people").update(personUpdate).eq("id", personId);
		}
	}

	if (companyName && !organizationId) {
		organizationId = await ensureOrganizationId();
	}

	if (!createdNewPerson && personId && organizationId && organizationId !== existingPerson?.default_organization_id) {
		await supabase.from("people").update({ default_organization_id: organizationId }).eq("id", personId);
		const { error: linkError } = await supabase.from("people_organizations").insert({
			account_id: list.account_id,
			project_id: list.project_id,
			person_id: personId,
			organization_id: organizationId,
			is_primary: true,
		});
		if (linkError && linkError.code !== "23505") {
			consola.warn("[research-link-start] Failed to create people_organizations link:", linkError);
		}
	}

	if (organizationId && (industry || companySize)) {
		const orgUpdate: Record<string, string> = {};
		if (industry) orgUpdate.industry = industry;
		if (companySize) orgUpdate.size_range = companySize;
		if (Object.keys(orgUpdate).length > 0) {
			await supabase.from("organizations").update(orgUpdate).eq("id", organizationId);
		}
	}

	// Update the response with the person_id
	const { data: response, error: updateError } = await supabase
		.from("research_link_responses")
		.update({
			person_id: personId,
			response_mode: responseMode,
			...(primaryPhone ? { phone: primaryPhone } : {}),
		})
		.eq("id", data.responseId)
		.select("id, responses, completed")
		.single();

	if (updateError || !response) {
		return Response.json({ message: updateError?.message ?? "Unable to link person to response" }, { status: 500 });
	}

	if (personId && list.project_id) {
		if (title) {
			await syncTitleToJobTitleFacet({
				supabase,
				personId,
				accountId: list.account_id,
				title,
			});
		}
		if (jobFunction) {
			await syncPeopleFieldsToFacets({
				supabase,
				personId,
				accountId: list.account_id,
				projectId: list.project_id,
				fields: { job_function: jobFunction },
			});
		}
		if (industry || companySize) {
			await syncOrgDataToPersonFacets({
				supabase,
				personId,
				accountId: list.account_id,
				projectId: list.project_id,
				orgData: {
					industry,
					size_range: companySize,
				},
			});
		}
	}

	return Response.json({
		responseId: response.id,
		responses: response.responses ?? {},
		completed: response.completed ?? false,
		personId,
		personAttributes: await getPersonAttributesOrEmpty(supabase, personId),
		identityMode: "identified",
		identityField: "email",
	});
}

/**
 * Fire-and-forget PostHog event when a new survey response is started.
 * Only called on fresh inserts, not resumes, so start/complete rates are accurate.
 */
function trackSurveyStarted({
	list,
	responseId,
	responseMode,
	identityMode,
}: {
	list: ResearchLink;
	responseId: string;
	responseMode: string;
	identityMode: IdentityMode;
}) {
	const posthog = getPostHogServerClient();
	if (!posthog) return;

	const properties = {
		survey_id: list.id,
		survey_name: list.name,
		response_id: responseId,
		account_id: list.account_id,
		project_id: list.project_id,
		survey_owner_user_id: list.survey_owner_user_id,
		response_mode: responseMode,
		identity_mode: identityMode,
	};

	void Promise.allSettled([
		// Respondent-side: responseId as anonymous identity until person is resolved
		posthog.capture({
			distinctId: responseId,
			event: "survey_started",
			properties,
		}),
		// Owner-side: so the survey creator sees their start/complete funnel
		posthog.capture({
			distinctId: list.survey_owner_user_id ?? list.account_id,
			event: "survey_started",
			properties,
		}),
	]).catch(() => {
		// Intentionally swallowed - tracking must never affect the response
	});
}
