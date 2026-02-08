import { createTool } from "@mastra/core/tools";
import type { SupabaseClient } from "@supabase/supabase-js";
import consola from "consola";
import { z } from "zod";
import { supabaseAdmin } from "~/lib/supabase/client.server";
import { HOST } from "~/paths";
import type { contactInfoSchema } from "~/schemas";
import { personDetailSchema } from "~/schemas";
import type {
	Database,
	Interview,
	InterviewPeople,
	Organizations,
	PeopleOrganization,
	PeoplePersona,
	Person,
	ProjectPeople,
} from "~/types";
import { createRouteDefinitions } from "~/utils/route-definitions";

type PeopleOrganizationRow = PeopleOrganization & {
	organization?: Pick<
		Organizations,
		"id" | "name" | "website_url" | "domain" | "industry" | "size_range" | "headquarters_location"
	> | null;
};

type PeoplePersonaRow = PeoplePersona & {
	personas?: Database["public"]["Tables"]["personas"]["Row"] | null;
};

type PersonFacetRow = Database["public"]["Tables"]["person_facet"]["Row"] & {
	facet?: {
		id?: number | null;
		label?: string | null;
		kind?: { slug?: string | null; label?: string | null } | null;
	} | null;
};

type PersonScaleRow = Database["public"]["Tables"]["person_scale"]["Row"];

type EvidenceRow = Database["public"]["Tables"]["evidence"]["Row"] & {
	interview?: Pick<Interview, "id" | "title" | "interview_date"> | null;
};

type ProjectPeopleRow = ProjectPeople & {
	person?: Person;
	people_personas?: PeoplePersonaRow[] | null;
	people_organizations?: PeopleOrganizationRow[] | null;
};

type InterviewPeopleRow = InterviewPeople & {
	interview?: Interview | null;
};

function normalizeDate(value: unknown) {
	if (!value) return null;
	if (value instanceof Date) return value.toISOString();
	if (typeof value === "string") return value;
	return null;
}

function toStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	const cleaned = value
		.map((item) => (typeof item === "string" ? item.trim() : ""))
		.filter((item): item is string => Boolean(item));
	return Array.from(new Set(cleaned));
}

function buildSearchableText(row: ProjectPeopleRow): string {
	const person = row.person;
	const parts: string[] = [];
	const append = (value?: string | null) => {
		if (value && typeof value === "string") {
			const trimmed = value.trim();
			if (trimmed.length) parts.push(trimmed);
		}
	};

	append(person?.name);
	append(person?.title);
	append(person?.role);
	append(person?.company);
	append(person?.segment);
	append(row.role);

	for (const personaLink of row.people_personas ?? []) {
		append(personaLink.personas?.name ?? null);
	}

	for (const orgLink of row.people_organizations ?? []) {
		append(orgLink.organization?.name ?? null);
		append(orgLink.organization?.domain ?? null);
	}

	return parts.join(" ").toLowerCase();
}

function _computeSearchScore({
	row,
	normalizedSearch,
	tokens,
}: {
	row: ProjectPeopleRow;
	normalizedSearch: string;
	tokens: string[];
}): number {
	if (!normalizedSearch) return 0;
	const text = buildSearchableText(row);
	if (!text) return 0;

	let score = 0;
	let matchedTokens = 0;

	for (const token of tokens) {
		if (token && text.includes(token)) {
			matchedTokens += 1;
			score += 2;
		}
	}

	if (matchedTokens === tokens.length && tokens.length > 0) {
		score += 3;
	}

	if (normalizedSearch && text.includes(normalizedSearch)) {
		score += 2;
	}

	const name = row.person?.name?.toLowerCase().trim();
	if (name) {
		if (name === normalizedSearch) {
			score += 6;
		} else if (name.startsWith(normalizedSearch)) {
			score += 3;
		}
	}

	return score;
}

export const fetchPeopleDetailsTool = createTool({
	id: "fetch-people-details",
	description:
		"Fetch detailed information about people in a project, including demographics, professional info, preferences, attributes, motivations, personas, interview history, evidence snippets, and facet/scale attributes.",
	inputSchema: z.object({
		projectId: z.string().describe("Project ID to fetch people from. Required - no default project context available."),
		peopleSearch: z
			.string()
			.nullish()
			.describe("Case-insensitive search string to match people by name or display name."),
		peopleLimit: z.number().int().min(1).max(50).nullish().describe("Maximum number of people to return."),
		includeEvidence: z.boolean().nullish().describe("Whether to include actual evidence snippets from interviews."),
		includePersonas: z.boolean().nullish().describe("Whether to include persona assignments for each person."),
		includeFacets: z
			.boolean()
			.nullish()
			.describe("Whether to include facet attributes and scale measurements for each person."),
		specificPersonIds: z.array(z.string()).nullish().describe("Specific person IDs to fetch details for."),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
		projectId: z.string().nullable().optional(),
		people: z.array(personDetailSchema),
		totalCount: z.number(),
		searchApplied: z.string().nullable(),
	}),
	execute: async (input, context?) => {
		const supabase = supabaseAdmin as SupabaseClient<Database>;
		const runtimeAccountId = context?.requestContext?.get?.("account_id");

		const projectId = input.projectId;
		const accountId = runtimeAccountId ? String(runtimeAccountId).trim() : undefined;
		const peopleSearch = (input.peopleSearch ?? "").trim();
		const sanitizedPersonSearch = peopleSearch.replace(/[%*"'()]/g, "").trim();
		const peopleLimit = input.peopleLimit ?? 20;
		const includeEvidence = input.includeEvidence ?? true;
		const includePersonas = input.includePersonas ?? true;
		const includeFacets = input.includeFacets ?? false;
		const specificPersonIds = input.specificPersonIds ?? [];

		consola.debug("fetch-people-details: execute start", {
			projectId,
			accountId,
			peopleSearch: sanitizedPersonSearch,
			peopleLimit,
			includeEvidence,
			includePersonas,
			includeFacets,
			specificPersonIds: specificPersonIds.length,
		});

		if (!projectId || projectId.trim() === "") {
			consola.warn("fetch-people-details: missing or empty projectId");
			return {
				success: false,
				message: "Missing or empty projectId. A valid project ID is required.",
				projectId: null,
				people: [],
				totalCount: 0,
				searchApplied: null,
			};
		}

		try {
			// First try project-scoped search using project_people junction table
			const { data: projectPeopleData, error: peopleError } = await supabase
				.from("people")
				.select("*, project_people!inner(project_id)")
				.eq("project_people.project_id", projectId)
				.eq("account_id", accountId || "")
				.limit(sanitizedPersonSearch ? 100 : peopleLimit);

			let searchScope: "project" | "account" = "project";
			let peopleData: Person[] | null = projectPeopleData as Person[] | null;

			// If searching and no results in project, expand to account level
			if (sanitizedPersonSearch && (!peopleData || peopleData.length === 0) && accountId) {
				consola.debug("fetch-people-details: no project results, expanding to account scope", {
					projectId,
					accountId,
					searchTerm: sanitizedPersonSearch,
				});

				const accountQuery = await supabase.from("people").select("*").eq("account_id", accountId).limit(100);

				if (accountQuery.data && accountQuery.data.length > 0) {
					peopleData = accountQuery.data as Person[];
					searchScope = "account";
					consola.debug("fetch-people-details: found results at account scope", {
						count: peopleData?.length || 0,
					});
				}
			}

			if (peopleError) {
				consola.error("fetch-people-details: failed to fetch people", peopleError);
				throw peopleError;
			}

			// Debug: Log raw response to see exact structure
			if (peopleData && peopleData.length > 0) {
				consola.debug("fetch-people-details: RAW first result", JSON.stringify(peopleData[0], null, 2));
			}

			let people = peopleData ?? [];

			consola.debug("fetch-people-details: query results", {
				projectId,
				searchTerm: sanitizedPersonSearch,
				rawResultsCount: people.length,
				sampleResult:
					people.length > 0
						? {
								person_id: people[0].id,
								name: people[0].name,
								title: people[0].title,
								company: people[0].company,
							}
						: null,
			});

			// Application-side search filtering
			if (sanitizedPersonSearch) {
				const searchLower = sanitizedPersonSearch.toLowerCase();

				// Filter to only matching records
				people = people.filter((person) => {
					const nameMatch = person.name?.toLowerCase().includes(searchLower);
					const titleMatch = person.title?.toLowerCase().includes(searchLower);
					const companyMatch = person.company?.toLowerCase().includes(searchLower);
					const roleMatch = person.role?.toLowerCase().includes(searchLower);

					return nameMatch || titleMatch || companyMatch || roleMatch;
				});

				consola.debug("fetch-people-details: after search filter", {
					projectId,
					searchTerm: sanitizedPersonSearch,
					filteredResultsCount: people.length,
				});
			}

			// Apply specific person IDs filter if provided
			if (specificPersonIds.length > 0) {
				people = people.filter((person) => specificPersonIds.includes(person.id));
			}

			if (people.length > peopleLimit) {
				people = people.slice(0, peopleLimit);
			}
			const personIds = people.map((person) => person.id);

			// Get total count - just use the filtered array length since we fetched all matching records
			const totalCount = people.length;

			// Fetch additional data if requested
			const [personaData, interviewData, evidenceData, facetData, scaleData] = await Promise.all([
				includePersonas && personIds.length > 0
					? supabase
							.from("people_personas")
							.select(`
						person_id,
						personas:persona_id(
							id,
							name,
							color_hex,
							description
						),
						assigned_at,
						confidence_score
					`)
							.in("person_id", personIds)
							.eq("project_id", projectId)
					: Promise.resolve({ data: null }),

				includeEvidence && personIds.length > 0
					? supabase
							.from("interview_people")
							.select(`
						person_id,
						interview:interview_id(
							id,
							title,
							interview_date,
							status
						)
					`)
							.eq("project_id", projectId)
							.in("person_id", personIds)
							.order("created_at", { ascending: false })
					: Promise.resolve({ data: null }),

				includeEvidence && personIds.length > 0
					? supabase
							.from("evidence")
							.select(`
						id,
						gist,
						verbatim,
						context_summary,
						modality,
						created_at,
						interview_id,
						interview:interview_id(
							title,
							interview_date
						)
					`)
							.eq("project_id", projectId)
							.in(
								"interview_id",
								(
									await supabase
										.from("interview_people")
										.select("interview_id")
										.eq("project_id", projectId)
										.in("person_id", personIds)
								).data
									?.map((ip) => ip.interview_id)
									.filter(Boolean) ?? []
							)
							.order("created_at", { ascending: false })
							.limit(50) // Limit evidence per person to avoid too much data
					: Promise.resolve({ data: null }),

				includeFacets && personIds.length > 0
					? supabase
							.from("person_facet")
							.select(`
						person_id,
						facet_account_id,
						source,
						confidence,
						noted_at,
						facet:facet_account!inner(
							id,
							label,
							kind_id,
							synonyms,
							is_active,
							kind:kinds!inner(
								slug,
								label
							)
						)
					`)
							.eq("project_id", projectId)
							.in("person_id", personIds)
					: Promise.resolve({ data: null }),

				includeFacets && personIds.length > 0
					? supabase
							.from("person_scale")
							.select(`
						person_id,
						kind_slug,
						score,
						band,
						source,
						confidence,
						noted_at
					`)
							.eq("project_id", projectId)
							.in("person_id", personIds)
					: Promise.resolve({ data: null }),
			]);

			// Organize the additional data by person_id
			const personasByPerson = new Map<string, PeoplePersonaRow[]>();
			const interviewsByPerson = new Map<string, InterviewPeopleRow[]>();
			const evidenceByPerson = new Map<string, EvidenceRow[]>();
			const facetsByPerson = new Map<string, PersonFacetRow[]>();
			const scalesByPerson = new Map<string, PersonScaleRow[]>();

			if (personaData.data) {
				for (const row of personaData.data as PeoplePersonaRow[]) {
					const existing = personasByPerson.get(row.person_id) ?? [];
					existing.push(row);
					personasByPerson.set(row.person_id, existing);
				}
			}

			if (interviewData.data) {
				for (const row of interviewData.data as InterviewPeopleRow[]) {
					const existing = interviewsByPerson.get(row.person_id) ?? [];
					existing.push(row);
					interviewsByPerson.set(row.person_id, existing);
				}
			}

			if (evidenceData.data) {
				for (const evidence of evidenceData.data as EvidenceRow[]) {
					// Find which person this evidence belongs to by looking up interview_people
					const interviewPeople = (interviewData.data as InterviewPeopleRow[])?.find(
						(ip) => ip.interview?.id === evidence.interview_id
					);
					if (interviewPeople) {
						const existing = evidenceByPerson.get(interviewPeople.person_id) ?? [];
						existing.push(evidence);
						evidenceByPerson.set(interviewPeople.person_id, existing);
					}
				}
			}

			if (facetData.data) {
				for (const facet of facetData.data as PersonFacetRow[]) {
					const existing = facetsByPerson.get(facet.person_id) ?? [];
					existing.push(facet);
					facetsByPerson.set(facet.person_id, existing);
				}
			}

			if (scaleData.data) {
				for (const scale of scaleData.data as PersonScaleRow[]) {
					const existing = scalesByPerson.get(scale.person_id) ?? [];
					existing.push(scale);
					scalesByPerson.set(scale.person_id, existing);
				}
			}

			// Generate route definitions for URL generation
			const projectPath = accountId && projectId ? `/a/${accountId}/${projectId}` : "";
			const routes = createRouteDefinitions(projectPath);

			// Build the final result
			const result = people
				.map((person) => {
					const personPersonas = personasByPerson.get(person.id) ?? [];
					const personInterviews = interviewsByPerson.get(person.id) ?? [];
					const personEvidence = evidenceByPerson.get(person.id) ?? [];
					const personFacets = facetsByPerson.get(person.id) ?? [];
					const personScales = scalesByPerson.get(person.id) ?? [];

					// Calculate evidence count for backward compatibility
					const evidenceCount = personEvidence.length;

					const interviews = personInterviews
						.map((ip) => {
							const interview = ip.interview;
							if (!interview) return null;

							// Count evidence for this specific interview
							const interviewEvidenceCount = personEvidence.filter((ev) => ev.interview_id === interview.id).length;

							return {
								id: interview.id,
								title: interview.title,
								interview_date: normalizeDate(interview.interview_date),
								status: interview.status,
								evidenceCount: interviewEvidenceCount,
								url: projectPath ? `${HOST}${routes.interviews.detail(interview.id)}` : null,
							};
						})
						.filter(Boolean);

					return {
						personId: person.id,
						name: person.name,
						age: person.age,
						gender: person.gender,
						pronouns: person.pronouns,
						title: person.title,
						company: person.company,
						occupation: person.occupation,
						role: person.role,
						segment: person.segment,
						industry: person.industry,
						income: person.income,
						location: person.location,
						timezone: person.timezone,
						languages: toStringArray(person.languages),
						education: person.education,
						lifecycle_stage: person.lifecycle_stage,
						description: person.description,
						preferences: person.preferences,
						image_url: person.image_url,
						linkedin_url: person.linkedin_url,
						website_url: person.website_url,
						contactInfo: person.contact_info as z.infer<typeof contactInfoSchema> | null,
						primary_email: person.primary_email,
						primary_phone: person.primary_phone,
						projectRole: person.role, // Use person.role instead of project_people.role
						interviewCount: personInterviews.length, // Calculate from actual interviews
						firstSeenAt: null, // Not available without project_people junction
						lastSeenAt: null, // Not available without project_people junction
						personas: includePersonas
							? personPersonas.map((pp) => ({
									id: pp.personas?.id ?? null,
									name: pp.personas?.name ?? null,
									color_hex: pp.personas?.color_hex ?? null,
									description: pp.personas?.description ?? null,
									assigned_at: normalizeDate(pp.assigned_at),
									confidence_score: pp.confidence_score,
									url: projectPath && pp.personas?.id ? `${HOST}${routes.personas.detail(pp.personas.id)}` : null,
								}))
							: undefined,
						interviews: includeEvidence ? interviews : undefined,
						evidence: includeEvidence
							? personEvidence.slice(0, 20).map((ev) => ({
									// Limit to 20 snippets per person
									id: ev.id,
									gist: ev.gist ?? null,
									verbatim: ev.verbatim ?? null,
									context_summary: ev.context_summary ?? null,
									modality: ev.modality ?? null,
									interview_title: ev.interview?.title ?? null,
									interview_date: normalizeDate(ev.interview?.interview_date),
									created_at: normalizeDate(ev.created_at),
									url: projectPath ? `${HOST}${routes.evidence.detail(ev.id)}` : null,
								}))
							: undefined,
						facets: includeFacets
							? personFacets.map((facet) => ({
									facet_account_id: facet.facet_account_id,
									label: facet.facet?.label ?? `ID:${facet.facet_account_id}`,
									kind_slug: facet.facet?.kind?.slug ?? "",
									source: facet.source ?? null,
									confidence: facet.confidence ?? null,
								}))
							: undefined,
						scales: includeFacets
							? personScales.map((scale) => ({
									kind_slug: scale.kind_slug,
									score: scale.score,
									band: scale.band ?? null,
									source: scale.source ?? null,
									confidence: scale.confidence ?? null,
								}))
							: undefined,
						evidenceCount: includeEvidence ? evidenceCount : undefined,
						created_at: normalizeDate(person.created_at),
						updated_at: normalizeDate(person.updated_at),
						url: projectPath ? `${HOST}${routes.people.detail(person.id)}` : null,
					};
				})
				.filter(Boolean) as z.infer<typeof personDetailSchema>[];

			const message = sanitizedPersonSearch
				? searchScope === "account"
					? `Found ${result.length} people matching "${sanitizedPersonSearch}" across account (searched beyond current project).`
					: `Found ${result.length} people matching "${sanitizedPersonSearch}" in current project.`
				: `Retrieved ${result.length} people from current project.`;

			consola.debug("fetch-people-details: final result", {
				projectId,
				accountId,
				searchTerm: sanitizedPersonSearch,
				searchScope,
				peopleCount: result.length,
				totalCount: totalCount ?? 0,
				samplePerson:
					result.length > 0
						? {
								id: result[0].personId,
								name: result[0].name,
								title: result[0].title,
								company: result[0].company,
							}
						: null,
			});

			return {
				success: true,
				message,
				projectId,
				people: result.filter((p): p is NonNullable<typeof p> => p !== null),
				totalCount: totalCount ?? 0,
				searchApplied: sanitizedPersonSearch || null,
			};
		} catch (error) {
			consola.error("fetch-people-details: unexpected error", error);
			return {
				success: false,
				message: "Unexpected error fetching people details.",
				projectId,
				people: [],
				totalCount: 0,
				searchApplied: null,
			};
		}
	},
});
