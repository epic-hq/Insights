/**
 * Unified person resolution module
 * Single source of truth for matching and creating people across all paths:
 * - Desktop finalize
 * - Realtime evidence extraction
 * - BAML extraction
 * - Manual import
 *
 * Match priority: email > platform_id > name+org > create
 *
 * Phase 3: Uses default_organization_id FK for identity matching.
 * Company text is resolved to an org UUID before person creation.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~/../supabase/types";
import { upsertPersonWithOrgAwareConflict } from "~/features/interviews/peopleNormalization.server";

type PeopleInsert = Database["public"]["Tables"]["people"]["Insert"];

export interface PersonResolutionInput {
	// Core identity
	firstname?: string;
	lastname?: string;
	name?: string; // Full name fallback

	// Contact info
	primary_email?: string;
	primary_phone?: string;

	// Organization
	company?: string;
	title?: string;

	// Platform identity (for cross-meeting matching)
	platform?: string;
	platform_user_id?: string;

	// Metadata
	role?: string; // 'interviewer' | 'participant'
	person_type?: "internal" | null;
	source: string; // 'desktop_meeting' | 'baml_extraction' | 'manual'
}

export interface PersonResolutionResult {
	person: {
		id: string;
		name: string | null;
		created: boolean; // True if newly created
	};
	matchedBy: "email" | "platform_id" | "name_company" | "created";
}

/**
 * Find person by email (highest priority match)
 */
async function findByEmail(
	supabase: SupabaseClient<Database>,
	accountId: string,
	email: string
): Promise<{ id: string; name: string | null } | null> {
	const normalizedEmail = email.trim().toLowerCase();

	const { data, error } = await supabase
		.from("people")
		.select("id, name")
		.eq("account_id", accountId)
		.ilike("primary_email", normalizedEmail)
		.limit(1)
		.single();

	if (error || !data) return null;
	return data;
}

/**
 * Find person by platform user ID (e.g., Zoom conf_user_id)
 * Queries contact_info JSONB field
 */
async function findByPlatformId(
	supabase: SupabaseClient<Database>,
	accountId: string,
	platform: string,
	platformUserId: string
): Promise<{ id: string; name: string | null } | null> {
	// Query contact_info JSONB using PostgreSQL JSON operators
	// contact_info->platform->'user_id' = platformUserId
	const { data, error } = await supabase
		.from("people")
		.select("id, name, contact_info")
		.eq("account_id", accountId)
		.not("contact_info", "is", null);

	if (error || !data) return null;

	// Filter in-memory since Supabase doesn't support deep JSONB queries easily
	const match = data.find((person) => {
		const contactInfo = person.contact_info as Record<string, any> | null;
		if (!contactInfo) return false;
		const platformData = contactInfo[platform];
		if (!platformData) return false;
		return platformData.user_id === platformUserId;
	});

	if (!match) return null;
	return { id: match.id, name: match.name };
}

/**
 * Find person by name + organization FK
 * Phase 3: Uses default_organization_id instead of company text
 */
async function findByNameOrg(
	supabase: SupabaseClient<Database>,
	accountId: string,
	name: string,
	orgId?: string | null
): Promise<{ id: string; name: string | null } | null> {
	const normalizedName = name.trim().toLowerCase();

	let query = supabase.from("people").select("id, name").eq("account_id", accountId).ilike("name", normalizedName);

	if (orgId) {
		query = query.eq("default_organization_id", orgId);
	} else {
		query = query.is("default_organization_id", null);
	}

	const { data, error } = await query.limit(1).single();

	if (error || !data) return null;
	return data;
}

/**
 * Resolve company text to an organization UUID.
 * Creates the organization if it doesn't exist.
 */
async function resolveOrganization(
	supabase: SupabaseClient<Database>,
	accountId: string,
	companyName: string
): Promise<string | null> {
	const normalized = companyName.trim();
	if (!normalized) return null;

	// Try case-insensitive exact match
	const { data: existing } = await supabase
		.from("organizations")
		.select("id")
		.eq("account_id", accountId)
		.ilike("name", normalized)
		.order("updated_at", { ascending: false })
		.limit(1)
		.single();

	if (existing) return existing.id;

	// Create new organization
	const { data: newOrg } = await supabase
		.from("organizations")
		.insert({ account_id: accountId, name: normalized })
		.select("id")
		.single();

	return newOrg?.id ?? null;
}

/**
 * Unified person resolution used by all paths:
 * - Desktop finalize
 * - Realtime evidence extraction
 * - BAML extraction
 * - Manual import
 *
 * Match priority:
 * 1. Email (most reliable)
 * 2. Platform user ID (repeat meetings)
 * 3. Name + company (fuzzy)
 * 4. Create new (via upsert for idempotency)
 */
export async function resolveOrCreatePerson(
	supabase: SupabaseClient<Database>,
	accountId: string,
	projectId: string,
	input: PersonResolutionInput
): Promise<PersonResolutionResult> {
	// 1. Email match (highest priority)
	if (input.primary_email) {
		const existing = await findByEmail(supabase, accountId, input.primary_email);
		if (existing) {
			return {
				person: { ...existing, created: false },
				matchedBy: "email",
			};
		}
	}

	// 2. Platform user ID match (for repeat meetings)
	if (input.platform && input.platform_user_id) {
		const existing = await findByPlatformId(supabase, accountId, input.platform, input.platform_user_id);
		if (existing) {
			return {
				person: { ...existing, created: false },
				matchedBy: "platform_id",
			};
		}
	}

	// 3. Resolve company text -> org UUID (needed for matching and creation)
	const orgId = input.company ? await resolveOrganization(supabase, accountId, input.company) : null;

	// 4. Name + org match
	const name = input.name || `${input.firstname || ""} ${input.lastname || ""}`.trim();
	if (name) {
		const existing = await findByNameOrg(supabase, accountId, name, orgId);
		if (existing) {
			return {
				person: { ...existing, created: false },
				matchedBy: "name_company",
			};
		}
	}

	// 5. Create new person with org FK
	const insertPayload: PeopleInsert = {
		account_id: accountId,
		project_id: projectId,
		firstname: input.firstname,
		lastname: input.lastname,
		name,
		primary_email: input.primary_email,
		primary_phone: input.primary_phone,
		default_organization_id: orgId,
		title: input.title,
		person_type: input.person_type,
		source: input.source,
		// Store platform user ID in contact_info JSONB
		contact_info: input.platform_user_id
			? {
					[input.platform!]: { user_id: input.platform_user_id },
				}
			: null,
	};

	const person = await upsertPersonWithOrgAwareConflict(supabase, insertPayload, input.person_type);

	return {
		person: { ...person, created: true },
		matchedBy: "created",
	};
}
