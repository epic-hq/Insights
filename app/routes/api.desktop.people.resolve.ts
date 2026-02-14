/**
 * POST /api/desktop/people/resolve
 *
 * Resolves people from desktop meetings using Recall SDK data + AI extraction.
 * Returns person IDs for linking evidence and tasks.
 *
 * This endpoint accepts enriched people data from the desktop app (Recall SDK participants
 * merged with AI-extracted people) and uses the unified resolution module to match or create
 * people in the database.
 */

import type { ActionFunctionArgs } from "react-router";
import { type PersonResolutionInput, resolveOrCreatePerson } from "~/lib/people/resolution.server";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";

interface ResolvePersonRequest {
	accountId: string;
	projectId: string;
	people: Array<{
		// From AI extraction
		person_key: string;
		person_name: string;
		role?: string;

		// From Recall SDK (NEW - desktop will send this)
		recall_participant_id?: string;
		recall_platform?: string;
		email?: string;
		is_host?: boolean;
	}>;
}

interface ResolvedPerson {
	person_key: string;
	person_id: string;
	matched_by: string;
	created: boolean;
}

interface ResolvePersonError {
	person_key: string;
	error: string;
}

interface ResolvePersonResponse {
	resolved: ResolvedPerson[];
	errors: ResolvePersonError[];
}

function toOptionalString(value: unknown): string | undefined {
	if (value === null || value === undefined) return undefined;
	if (typeof value === "string") {
		const trimmed = value.trim();
		return trimmed.length ? trimmed : undefined;
	}
	if (typeof value === "number" && Number.isFinite(value)) {
		return String(value);
	}
	return undefined;
}

/**
 * Authenticates desktop request using Bearer token
 * TODO: Implement proper desktop app authentication
 */
function authenticateDesktopRequest(request: Request): boolean {
	const authHeader = request.headers.get("Authorization");
	if (!authHeader || !authHeader.startsWith("Bearer ")) {
		return false;
	}

	// TODO: Validate JWT token or API key
	// For now, accept any Bearer token
	return true;
}

export async function action({ request }: ActionFunctionArgs) {
	// Authenticate desktop request
	if (!authenticateDesktopRequest(request)) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	// Parse request body
	let body: ResolvePersonRequest;
	try {
		body = await request.json();
	} catch (_error) {
		return Response.json({ error: "Invalid JSON body" }, { status: 400 });
	}

	const { accountId, projectId, people } = body;

	// Validate required fields
	if (!accountId || !projectId || !Array.isArray(people)) {
		return Response.json({ error: "Missing required fields: accountId, projectId, people" }, { status: 400 });
	}

	// Create admin Supabase client (desktop app has elevated permissions)
	const supabase = createSupabaseAdminClient();

	const resolved: ResolvedPerson[] = [];
	const errors: ResolvePersonError[] = [];

	// Resolve each person
	for (const person of people) {
		try {
			// Validate person has required fields
			if (!person.person_key || !person.person_name) {
				errors.push({
					person_key: person.person_key || "unknown",
					error: "Missing required fields: person_key, person_name",
				});
				continue;
			}

			// Build resolution input
			const input: PersonResolutionInput = {
				name: person.person_name,
				primary_email: toOptionalString(person.email),
				role: person.role,
				platform: toOptionalString(person.recall_platform),
				platform_user_id: toOptionalString(person.recall_participant_id),
				person_type: person.role === "interviewer" || person.is_host ? "internal" : null,
				source: "desktop_meeting",
			};

			// Resolve or create person
			const result = await resolveOrCreatePerson(supabase, accountId, projectId, input);

			resolved.push({
				person_key: person.person_key,
				person_id: result.person.id,
				matched_by: result.matchedBy,
				created: result.person.created,
			});
		} catch (error) {
			errors.push({
				person_key: person.person_key,
				error: error instanceof Error ? error.message : "Unknown error",
			});
		}
	}

	const response: ResolvePersonResponse = { resolved, errors };

	// Return 207 Multi-Status if there were partial errors
	const status = errors.length > 0 && resolved.length > 0 ? 207 : errors.length > 0 ? 400 : 200;

	return Response.json(response, { status });
}
