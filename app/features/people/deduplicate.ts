/**
 * People deduplication and merge utilities
 *
 * Detects duplicate people records based on:
 * - Exact email match
 * - Exact LinkedIn URL match
 * - Name + company match (same name at same organization)
 *
 * Merge logic transfers all relationships to the primary record
 * and deletes the duplicate.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import consola from "consola";
import type { Database } from "~/types";

type Person = Database["public"]["Tables"]["people"]["Row"];

export type DuplicateGroup = {
	key: string;
	reason: "email" | "linkedin" | "name_company" | "firstname_company" | "placeholder_name";
	people: Person[];
};

export type DeduplicationResult = {
	success: boolean;
	duplicateGroups: DuplicateGroup[];
	errors: string[];
};

export type MergeResult = {
	success: boolean;
	primaryId: string;
	mergedIds: string[];
	relationshipsTransferred: {
		interview_people: number;
		evidence_people: number;
		person_facet: number;
		people_personas: number;
		people_organizations: number;
		asset_people: number;
	};
	errors: string[];
};

/**
 * Normalize strings for comparison (lowercase, trim, remove extra spaces)
 */
function normalize(str: string | null | undefined): string {
	return (str || "").toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * Extract domain from email for grouping
 */
function extractEmailKey(email: string | null | undefined): string | null {
	if (!email) return null;
	const normalized = normalize(email);
	if (!normalized.includes("@")) return null;
	return normalized;
}

/**
 * Normalize LinkedIn URL for comparison
 */
function normalizeLinkedIn(url: string | null | undefined): string | null {
	if (!url) return null;
	const normalized = url.toLowerCase().trim();
	// Extract the profile identifier
	const match = normalized.match(/linkedin\.com\/in\/([^/?]+)/);
	return match ? match[1].replace(/\/$/, "") : null;
}

/**
 * Extract first name from full name or firstname field
 */
function extractFirstName(person: Person): string | null {
	// Prefer explicit firstname field
	if (person.firstname) {
		return normalize(person.firstname);
	}
	// Fall back to first word of full name
	if (person.name) {
		const parts = normalize(person.name).split(" ");
		if (parts.length > 0 && parts[0].length > 1) {
			return parts[0];
		}
	}
	return null;
}

/**
 * Check if a name looks like a placeholder (Participant 1, Unknown, etc.)
 */
function isPlaceholderName(name: string | null | undefined): boolean {
	if (!name) return false;
	const normalized = normalize(name);
	// Match patterns like "Participant 1", "Speaker 2", "Unknown", "Interviewee", etc.
	return /^(participant|speaker|interviewee|respondent|user|person|unknown)\s*\d*$/i.test(normalized);
}

/**
 * Get placeholder group key if applicable
 */
function getPlaceholderGroupKey(name: string | null | undefined): string | null {
	if (!name) return null;
	const normalized = normalize(name);
	// Extract the base pattern (e.g., "participant" from "Participant 1")
	const match = normalized.match(/^(participant|speaker|interviewee|respondent|user|person)/i);
	return match ? match[1] : null;
}

/**
 * Find potential duplicate people within a project
 */
export async function findDuplicates({
	supabase,
	accountId,
	projectId,
}: {
	supabase: SupabaseClient<Database>;
	accountId: string;
	projectId: string;
}): Promise<DeduplicationResult> {
	const errors: string[] = [];

	try {
		// Fetch all people in the project
		const { data: people, error: fetchError } = await supabase
			.from("people")
			.select(
				`
        *,
        people_organizations (
          organization:organizations (
            id,
            name
          )
        )
      `
			)
			.eq("account_id", accountId)
			.eq("project_id", projectId)
			.order("created_at", { ascending: true });

		if (fetchError) {
			consola.error("Error fetching people:", fetchError);
			return {
				success: false,
				duplicateGroups: [],
				errors: [fetchError.message],
			};
		}

		if (!people || people.length === 0) {
			return { success: true, duplicateGroups: [], errors: [] };
		}

		const duplicateGroups: DuplicateGroup[] = [];

		// Group by email
		const emailGroups = new Map<string, Person[]>();
		for (const person of people) {
			const emailKey = extractEmailKey(person.primary_email);
			if (emailKey) {
				const group = emailGroups.get(emailKey) || [];
				group.push(person);
				emailGroups.set(emailKey, group);
			}
		}

		for (const [key, group] of emailGroups.entries()) {
			if (group.length > 1) {
				duplicateGroups.push({
					key: `email:${key}`,
					reason: "email",
					people: group,
				});
			}
		}

		// Group by LinkedIn (excluding already matched emails)
		const matchedIds = new Set(duplicateGroups.flatMap((g) => g.people.map((p) => p.id)));
		const linkedinGroups = new Map<string, Person[]>();
		for (const person of people) {
			if (matchedIds.has(person.id)) continue;
			const linkedinKey = normalizeLinkedIn(person.linkedin_url);
			if (linkedinKey) {
				const group = linkedinGroups.get(linkedinKey) || [];
				group.push(person);
				linkedinGroups.set(linkedinKey, group);
			}
		}

		for (const [key, group] of linkedinGroups.entries()) {
			if (group.length > 1) {
				duplicateGroups.push({
					key: `linkedin:${key}`,
					reason: "linkedin",
					people: group,
				});
				for (const p of group) matchedIds.add(p.id);
			}
		}

		// Group by name + company (excluding already matched)
		const nameCompanyGroups = new Map<string, Person[]>();
		for (const person of people) {
			if (matchedIds.has(person.id)) continue;
			const name = normalize(person.name);
			if (!name) continue;

			// Get primary organization name
			const orgs = person.people_organizations as Array<{
				organization: { id: string; name: string | null } | null;
			}> | null;
			const primaryOrg = orgs?.[0]?.organization?.name;
			const company = normalize(primaryOrg);

			if (company) {
				const key = `${name}|${company}`;
				const group = nameCompanyGroups.get(key) || [];
				group.push(person);
				nameCompanyGroups.set(key, group);
			}
		}

		for (const [key, group] of nameCompanyGroups.entries()) {
			if (group.length > 1) {
				duplicateGroups.push({
					key: `name_company:${key}`,
					reason: "name_company",
					people: group,
				});
				for (const p of group) matchedIds.add(p.id);
			}
		}

		// Group by firstname + company (catches "Tim" vs "Tim Wolf" at same company)
		const firstnameCompanyGroups = new Map<string, Person[]>();
		for (const person of people) {
			if (matchedIds.has(person.id)) continue;

			const firstname = extractFirstName(person);
			if (!firstname || firstname.length < 2) continue;

			// Get primary organization name
			const orgs = person.people_organizations as Array<{
				organization: { id: string; name: string | null } | null;
			}> | null;
			const primaryOrg = orgs?.[0]?.organization?.name;
			const company = normalize(primaryOrg);

			if (company) {
				const key = `${firstname}|${company}`;
				const group = firstnameCompanyGroups.get(key) || [];
				group.push(person);
				firstnameCompanyGroups.set(key, group);
			}
		}

		for (const [key, group] of firstnameCompanyGroups.entries()) {
			if (group.length > 1) {
				duplicateGroups.push({
					key: `firstname_company:${key}`,
					reason: "firstname_company",
					people: group,
				});
				for (const p of group) matchedIds.add(p.id);
			}
		}

		// Group placeholder names (Participant 1, Participant 2, etc.)
		const placeholderGroups = new Map<string, Person[]>();
		for (const person of people) {
			if (matchedIds.has(person.id)) continue;

			if (isPlaceholderName(person.name)) {
				const placeholderKey = getPlaceholderGroupKey(person.name);
				if (placeholderKey) {
					const group = placeholderGroups.get(placeholderKey) || [];
					group.push(person);
					placeholderGroups.set(placeholderKey, group);
				}
			}
		}

		for (const [key, group] of placeholderGroups.entries()) {
			if (group.length > 1) {
				duplicateGroups.push({
					key: `placeholder:${key}`,
					reason: "placeholder_name",
					people: group,
				});
			}
		}

		consola.info(
			`Found ${duplicateGroups.length} duplicate groups with ${duplicateGroups.reduce((acc, g) => acc + g.people.length, 0)} people`
		);

		return {
			success: true,
			duplicateGroups,
			errors,
		};
	} catch (error) {
		consola.error("Unexpected error during duplicate detection:", error);
		return {
			success: false,
			duplicateGroups: [],
			errors: [String(error)],
		};
	}
}

/**
 * Calculate a "completeness" score for a person record
 * Higher score = more complete data = better candidate for primary
 */
function calculateCompleteness(person: Person): number {
	let score = 0;

	// Core identity fields
	if (person.name) score += 10;
	if (person.firstname && person.lastname) score += 5;
	if (person.primary_email) score += 15;
	if (person.primary_phone) score += 5;
	if (person.linkedin_url) score += 10;

	// Professional info
	if (person.title) score += 5;
	if (person.job_function) score += 5;
	if (person.seniority_level) score += 5;
	const orgs = person.people_organizations as Array<{ organization: { name: string | null; industry?: string | null } | null }> | null;
	const pOrg = orgs?.[0]?.organization;
	if (pOrg?.name) score += 5;
	if (pOrg?.industry) score += 3;

	// Additional info
	if (person.description) score += 3;
	if (person.location) score += 3;
	if (person.image_url) score += 5;
	if (person.website_url) score += 2;

	// Demographics
	if (person.age_range || person.age) score += 2;
	if (person.life_stage) score += 2;

	return score;
}

/**
 * Merge duplicate people records
 * Transfers all relationships to the primary record and deletes duplicates
 */
export async function mergePeople({
	supabase,
	accountId,
	projectId,
	primaryId,
	duplicateIds,
	dryRun = false,
}: {
	supabase: SupabaseClient<Database>;
	accountId: string;
	projectId: string;
	primaryId: string;
	duplicateIds: string[];
	dryRun?: boolean;
}): Promise<MergeResult> {
	const errors: string[] = [];
	const transferred = {
		interview_people: 0,
		evidence_people: 0,
		person_facet: 0,
		people_personas: 0,
		people_organizations: 0,
		asset_people: 0,
	};

	try {
		// Verify primary exists
		const { data: primary, error: primaryError } = await supabase
			.from("people")
			.select("*")
			.eq("id", primaryId)
			.eq("account_id", accountId)
			.single();

		if (primaryError || !primary) {
			return {
				success: false,
				primaryId,
				mergedIds: [],
				relationshipsTransferred: transferred,
				errors: [`Primary person not found: ${primaryId}`],
			};
		}

		// Verify all duplicates exist
		const { data: duplicates, error: dupError } = await supabase
			.from("people")
			.select("*")
			.in("id", duplicateIds)
			.eq("account_id", accountId);

		if (dupError) {
			return {
				success: false,
				primaryId,
				mergedIds: [],
				relationshipsTransferred: transferred,
				errors: [`Error fetching duplicates: ${dupError.message}`],
			};
		}

		const foundDupIds = duplicates?.map((d) => d.id) || [];
		const missingDups = duplicateIds.filter((id) => !foundDupIds.includes(id));
		if (missingDups.length > 0) {
			consola.warn(`Some duplicate IDs not found: ${missingDups.join(", ")}`);
		}

		consola.info(`${dryRun ? "[DRY RUN] " : ""}Merging ${foundDupIds.length} duplicates into ${primaryId}`);

		// Transfer relationships from duplicates to primary
		// 1. interview_people
		for (const dupId of foundDupIds) {
			const { data: interviews } = await supabase
				.from("interview_people")
				.select("id, interview_id")
				.eq("person_id", dupId);

			if (interviews && interviews.length > 0) {
				if (!dryRun) {
					// Check for existing links to avoid duplicates
					const { data: existingLinks } = await supabase
						.from("interview_people")
						.select("interview_id")
						.eq("person_id", primaryId);

					const existingInterviewIds = new Set(existingLinks?.map((l) => l.interview_id) || []);

					for (const ip of interviews) {
						if (!existingInterviewIds.has(ip.interview_id)) {
							await supabase.from("interview_people").update({ person_id: primaryId }).eq("id", ip.id);
							transferred.interview_people++;
						} else {
							// Delete duplicate link
							await supabase.from("interview_people").delete().eq("id", ip.id);
						}
					}
				} else {
					transferred.interview_people += interviews.length;
				}
			}
		}

		// 2. evidence_people
		for (const dupId of foundDupIds) {
			const { data: evidence } = await supabase
				.from("evidence_people")
				.select("id, evidence_id")
				.eq("person_id", dupId);

			if (evidence && evidence.length > 0) {
				if (!dryRun) {
					const { data: existingLinks } = await supabase
						.from("evidence_people")
						.select("evidence_id")
						.eq("person_id", primaryId);

					const existingEvidenceIds = new Set(existingLinks?.map((l) => l.evidence_id) || []);

					for (const ep of evidence) {
						if (!existingEvidenceIds.has(ep.evidence_id)) {
							await supabase.from("evidence_people").update({ person_id: primaryId }).eq("id", ep.id);
							transferred.evidence_people++;
						} else {
							await supabase.from("evidence_people").delete().eq("id", ep.id);
						}
					}
				} else {
					transferred.evidence_people += evidence.length;
				}
			}
		}

		// 3. person_facet
		for (const dupId of foundDupIds) {
			const { data: facets } = await supabase
				.from("person_facet")
				.select("person_id, facet_account_id")
				.eq("person_id", dupId);

			if (facets && facets.length > 0) {
				if (!dryRun) {
					const { data: existingFacets } = await supabase
						.from("person_facet")
						.select("facet_account_id")
						.eq("person_id", primaryId);

					const existingFacetIds = new Set(existingFacets?.map((f) => f.facet_account_id) || []);

					for (const pf of facets) {
						if (!existingFacetIds.has(pf.facet_account_id)) {
							await supabase
								.from("person_facet")
								.update({ person_id: primaryId })
								.eq("person_id", dupId)
								.eq("facet_account_id", pf.facet_account_id);
							transferred.person_facet++;
						} else {
							await supabase
								.from("person_facet")
								.delete()
								.eq("person_id", dupId)
								.eq("facet_account_id", pf.facet_account_id);
						}
					}
				} else {
					transferred.person_facet += facets.length;
				}
			}
		}

		// 4. people_personas (uses composite key: person_id + persona_id)
		for (const dupId of foundDupIds) {
			const { data: personas } = await supabase.from("people_personas").select("persona_id").eq("person_id", dupId);

			if (personas && personas.length > 0) {
				if (!dryRun) {
					const { data: existingPersonas } = await supabase
						.from("people_personas")
						.select("persona_id")
						.eq("person_id", primaryId);

					const existingPersonaIds = new Set(existingPersonas?.map((p) => p.persona_id) || []);

					for (const pp of personas) {
						if (!existingPersonaIds.has(pp.persona_id)) {
							// Transfer to primary by deleting old and inserting new (can't update composite PK)
							await supabase.from("people_personas").delete().eq("person_id", dupId).eq("persona_id", pp.persona_id);
							await supabase.from("people_personas").insert({
								person_id: primaryId,
								persona_id: pp.persona_id,
							});
							transferred.people_personas++;
						} else {
							// Already exists on primary, just delete the duplicate
							await supabase.from("people_personas").delete().eq("person_id", dupId).eq("persona_id", pp.persona_id);
						}
					}
				} else {
					transferred.people_personas += personas.length;
				}
			}
		}

		// 5. people_organizations
		for (const dupId of foundDupIds) {
			const { data: orgs } = await supabase
				.from("people_organizations")
				.select("id, organization_id")
				.eq("person_id", dupId);

			if (orgs && orgs.length > 0) {
				if (!dryRun) {
					const { data: existingOrgs } = await supabase
						.from("people_organizations")
						.select("organization_id")
						.eq("person_id", primaryId);

					const existingOrgIds = new Set(existingOrgs?.map((o) => o.organization_id) || []);

					for (const po of orgs) {
						if (!existingOrgIds.has(po.organization_id)) {
							await supabase.from("people_organizations").update({ person_id: primaryId }).eq("id", po.id);
							transferred.people_organizations++;
						} else {
							await supabase.from("people_organizations").delete().eq("id", po.id);
						}
					}
				} else {
					transferred.people_organizations += orgs.length;
				}
			}
		}

		// 6. asset_people
		for (const dupId of foundDupIds) {
			const { data: assets } = await supabase.from("asset_people").select("id, asset_id").eq("person_id", dupId);

			if (assets && assets.length > 0) {
				if (!dryRun) {
					const { data: existingAssets } = await supabase
						.from("asset_people")
						.select("asset_id")
						.eq("person_id", primaryId);

					const existingAssetIds = new Set(existingAssets?.map((a) => a.asset_id) || []);

					for (const ap of assets) {
						if (!existingAssetIds.has(ap.asset_id)) {
							await supabase.from("asset_people").update({ person_id: primaryId }).eq("id", ap.id);
							transferred.asset_people++;
						} else {
							await supabase.from("asset_people").delete().eq("id", ap.id);
						}
					}
				} else {
					transferred.asset_people += assets.length;
				}
			}
		}

		// Merge data from duplicates into primary (fill in missing fields)
		if (!dryRun && duplicates && duplicates.length > 0) {
			const updateData: Partial<Person> = {};

			// Sort duplicates by completeness (most complete first)
			const sortedDuplicates = [...duplicates].sort((a, b) => calculateCompleteness(b) - calculateCompleteness(a));

			// Fill in missing fields from duplicates
			const fieldsToMerge = [
				"firstname",
				"lastname",
				"primary_email",
				"primary_phone",
				"linkedin_url",
				"title",
				"job_function",
				"seniority_level",
				"company",
				"industry",
				"description",
				"location",
				"image_url",
				"website_url",
				"age_range",
				"life_stage",
				"segment",
			] as const;

			for (const field of fieldsToMerge) {
				if (!primary[field]) {
					for (const dup of sortedDuplicates) {
						if (dup[field]) {
							(updateData as Record<string, unknown>)[field] = dup[field];
							break;
						}
					}
				}
			}

			if (Object.keys(updateData).length > 0) {
				await supabase.from("people").update(updateData).eq("id", primaryId);
				consola.info(`Updated primary with merged fields: ${Object.keys(updateData).join(", ")}`);
			}
		}

		// Delete duplicates
		if (!dryRun) {
			for (const dupId of foundDupIds) {
				const { error: deleteError } = await supabase.from("people").delete().eq("id", dupId);

				if (deleteError) {
					errors.push(`Failed to delete duplicate ${dupId}: ${deleteError.message}`);
				}
			}
		}

		consola.info(
			`${dryRun ? "[DRY RUN] " : ""}Merge complete. Transferred: ` +
				`interviews=${transferred.interview_people}, ` +
				`evidence=${transferred.evidence_people}, ` +
				`facets=${transferred.person_facet}, ` +
				`personas=${transferred.people_personas}, ` +
				`orgs=${transferred.people_organizations}, ` +
				`assets=${transferred.asset_people}`
		);

		return {
			success: errors.length === 0,
			primaryId,
			mergedIds: foundDupIds,
			relationshipsTransferred: transferred,
			errors,
		};
	} catch (error) {
		consola.error("Unexpected error during merge:", error);
		return {
			success: false,
			primaryId,
			mergedIds: [],
			relationshipsTransferred: transferred,
			errors: [String(error)],
		};
	}
}

/**
 * Auto-merge all detected duplicates
 * Picks the most complete record as primary for each group
 */
export async function autoMergeDuplicates({
	supabase,
	accountId,
	projectId,
	dryRun = true,
}: {
	supabase: SupabaseClient<Database>;
	accountId: string;
	projectId: string;
	dryRun?: boolean;
}): Promise<{
	success: boolean;
	groupsProcessed: number;
	peopleMerged: number;
	errors: string[];
}> {
	const allErrors: string[] = [];
	let groupsProcessed = 0;
	let peopleMerged = 0;

	// Find all duplicates
	const { duplicateGroups, errors: findErrors } = await findDuplicates({
		supabase,
		accountId,
		projectId,
	});

	if (findErrors.length > 0) {
		allErrors.push(...findErrors);
	}

	// Process each group
	for (const group of duplicateGroups) {
		// Sort by completeness to find the best primary
		const sortedPeople = [...group.people].sort((a, b) => calculateCompleteness(b) - calculateCompleteness(a));

		const [primary, ...duplicates] = sortedPeople;

		consola.info(
			`${dryRun ? "[DRY RUN] " : ""}Processing group "${group.key}": ` +
				`primary=${primary.name || primary.id.slice(0, 8)}, ` +
				`duplicates=${duplicates.length}`
		);

		const result = await mergePeople({
			supabase,
			accountId,
			projectId,
			primaryId: primary.id,
			duplicateIds: duplicates.map((d) => d.id),
			dryRun,
		});

		if (result.errors.length > 0) {
			allErrors.push(...result.errors);
		}

		groupsProcessed++;
		peopleMerged += result.mergedIds.length;
	}

	return {
		success: allErrors.length === 0,
		groupsProcessed,
		peopleMerged,
		errors: allErrors,
	};
}
