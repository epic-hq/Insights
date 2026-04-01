import type { SupabaseClient } from "@supabase/supabase-js";
import consola from "consola";
import { FacetResolver } from "~/lib/database/facets.server";
import type { Database } from "~/types";
import { syncPeopleFieldsToFacets } from "../people/syncPeopleFieldsToFacets.server";
import { syncTitleToJobTitleFacet } from "../people/syncTitleToFacet.server";
import type { ResearchLinkQuestion, ResearchLinkResponsePayload } from "./schemas";

type DbClient = SupabaseClient<Database>;
type ResponseRecord = ResearchLinkResponsePayload["responses"];

export type SurveyTaxonomyKey =
	| "role_type"
	| "job_title"
	| "job_function"
	| "seniority_level"
	| "tenure_in_role"
	| "industry_vertical"
	| "company_stage"
	| "team_size"
	| "geographic_scope"
	| "funding_stage"
	| "discovery_channel";

type PersonFieldKey = "title" | "job_function" | "seniority_level" | "role";

interface CanonicalSurveyAttribute {
	taxonomyKey: SurveyTaxonomyKey;
	personFieldKey: PersonFieldKey | null;
	values: string[];
	sourceQuestionId: string;
	explicit: boolean;
}

const SINGLE_VALUE_KEYS = new Set<SurveyTaxonomyKey>([
	"role_type",
	"job_title",
	"job_function",
	"seniority_level",
	"tenure_in_role",
	"industry_vertical",
	"company_stage",
	"team_size",
	"geographic_scope",
	"funding_stage",
	"discovery_channel",
]);

const TAXONOMY_ALIASES: Record<string, SurveyTaxonomyKey> = {
	role: "role_type",
	role_type: "role_type",
	job_title: "job_title",
	title: "job_title",
	job_function: "job_function",
	function: "job_function",
	seniority: "seniority_level",
	seniority_level: "seniority_level",
	tenure: "tenure_in_role",
	tenure_in_role: "tenure_in_role",
	industry: "industry_vertical",
	industry_vertical: "industry_vertical",
	company_stage: "company_stage",
	stage: "company_stage",
	team_size: "team_size",
	company_size: "team_size",
	geographic_scope: "geographic_scope",
	geo: "geographic_scope",
	funding_stage: "funding_stage",
	discovery_channel: "discovery_channel",
};

const PERSON_FIELD_TO_TAXONOMY: Record<PersonFieldKey, SurveyTaxonomyKey> = {
	title: "job_title",
	job_function: "job_function",
	seniority_level: "seniority_level",
	role: "role_type",
};

const TAXONOMY_TO_PERSON_FIELD: Partial<Record<SurveyTaxonomyKey, PersonFieldKey>> = {
	role_type: "role",
	job_title: "title",
	job_function: "job_function",
	seniority_level: "seniority_level",
	tenure_in_role: "seniority_level",
};

const TAXONOMY_TO_FACET_KIND: Partial<Record<SurveyTaxonomyKey, string>> = {
	role_type: "persona",
	industry_vertical: "industry",
	team_size: "company_size",
	company_stage: "life_stage",
};

const INFERRED_PATTERNS: Array<{ taxonomyKey: SurveyTaxonomyKey; pattern: RegExp }> = [
	{ taxonomyKey: "job_title", pattern: /\b(job title|current title|title at|professional title)\b/i },
	{ taxonomyKey: "job_function", pattern: /\b(job function|function|department)\b/i },
	{ taxonomyKey: "industry_vertical", pattern: /\b(industry|vertical|sector)\b/i },
	{ taxonomyKey: "role_type", pattern: /\b(primary role|best describes your role|role in)\b/i },
	{ taxonomyKey: "seniority_level", pattern: /\b(seniority|years? of experience|experience level)\b/i },
	{ taxonomyKey: "tenure_in_role", pattern: /\b(years? in (your )?role|tenure in role)\b/i },
	{ taxonomyKey: "team_size", pattern: /\b(team size|how many (people|employees)|company size)\b/i },
	{ taxonomyKey: "company_stage", pattern: /\b(company stage|startup stage|business stage|arr)\b/i },
	{ taxonomyKey: "funding_stage", pattern: /\b(funding stage|pre-seed|seed|series [a-z])\b/i },
	{ taxonomyKey: "discovery_channel", pattern: /\b(how did you hear|discovery channel|heard about)\b/i },
	{ taxonomyKey: "geographic_scope", pattern: /\b(geographic scope|region|where.*operate|market scope)\b/i },
];

const ENABLE_DEBUG_LOGS = typeof process !== "undefined" && process.env.NODE_ENV !== "production";

function normalizeFreeText(value: string): string {
	return value.replace(/\s+/g, " ").trim();
}

function normalizeResponseValues(value: string | string[] | boolean | null | undefined): string[] {
	if (value === null || value === undefined) return [];
	if (typeof value === "boolean") return [value ? "Yes" : "No"];
	if (Array.isArray(value)) {
		return value.map((entry) => normalizeFreeText(String(entry))).filter((entry) => entry.length > 0);
	}
	const normalized = normalizeFreeText(String(value));
	return normalized.length > 0 ? [normalized] : [];
}

function normalizeTaxonomyKey(raw: string | null | undefined): SurveyTaxonomyKey | null {
	if (!raw) return null;
	const key = raw
		.trim()
		.toLowerCase()
		.replace(/[\s-]+/g, "_");
	return TAXONOMY_ALIASES[key] ?? null;
}

function normalizePersonFieldKey(raw: string | null | undefined): PersonFieldKey | null {
	if (!raw) return null;
	const key = raw
		.trim()
		.toLowerCase()
		.replace(/[\s-]+/g, "_");
	if (key === "title" || key === "job_function" || key === "seniority_level" || key === "role") return key;
	return null;
}

function inferTaxonomyFromPrompt(prompt: string | null | undefined): SurveyTaxonomyKey | null {
	if (!prompt) return null;
	for (const entry of INFERRED_PATTERNS) {
		if (entry.pattern.test(prompt)) return entry.taxonomyKey;
	}
	return null;
}

function normalizeSeniority(value: string): string {
	const normalized = value.toLowerCase().replace(/\s+/g, " ").trim();
	if (
		/\b(c-level|chief|ceo|cto|cfo|coo|cmo|cpo|president|vp|vice president|head of|founder|owner|partner)\b/i.test(
			normalized
		)
	) {
		return "Leadership";
	}
	if (/\b(director|principal|staff|lead)\b/i.test(normalized)) return "Senior";
	if (/\b(manager|mgr)\b/i.test(normalized)) return "Manager";
	if (/\b(junior|jr|entry|intern)\b/i.test(normalized)) return "Entry";
	if (/\b(less than 1|< ?1|0-1|0 to 1|under 1)\b/i.test(normalized)) return "Entry";
	if (/\b(1\s*(?:-|to)\s*3|1-3)\b/i.test(normalized)) return "Mid";
	if (/\b(3\s*(?:-|to)\s*5|3-5)\b/i.test(normalized)) return "Senior";
	if (/(^|\s)(5\+|6\+|7\+|8\+|9\+|10\+)(\s|$)/i.test(normalized)) return "Leadership";
	return value;
}

function normalizeAttributeValues(taxonomyKey: SurveyTaxonomyKey, values: string[]): string[] {
	const deduped = Array.from(new Set(values.map((value) => normalizeFreeText(value)).filter(Boolean)));
	if (deduped.length === 0) return deduped;
	if (taxonomyKey === "seniority_level" || taxonomyKey === "tenure_in_role") {
		return Array.from(new Set(deduped.map((value) => normalizeSeniority(value))));
	}
	return deduped;
}

function pickSingleValue(values: string[]): string | null {
	return values.find((value) => value.trim().length > 0) ?? null;
}

function shouldOverwrite(existing: string | null | undefined, next: string): boolean {
	if (!existing || existing.trim().length === 0) return true;
	return existing.trim().toLowerCase() === next.trim().toLowerCase();
}

function supportsMultiValueFacet(taxonomyKey: SurveyTaxonomyKey): boolean {
	return taxonomyKey === "discovery_channel";
}

/**
 * Extract and normalize canonical attributes from survey question + answer pairs.
 * Explicit taxonomy/person-field metadata takes precedence over prompt inference.
 */
export function extractCanonicalSurveyAttributes(
	questions: ResearchLinkQuestion[],
	responses: ResponseRecord
): CanonicalSurveyAttribute[] {
	const candidates: CanonicalSurveyAttribute[] = [];

	for (const question of questions) {
		if (!question.id) continue;
		const values = normalizeResponseValues(responses[question.id]);
		if (values.length === 0) continue;

		const explicitTaxonomy = normalizeTaxonomyKey(question.taxonomyKey ?? null);
		const explicitPersonField = normalizePersonFieldKey(question.personFieldKey ?? null);
		const inferredTaxonomy = inferTaxonomyFromPrompt(question.prompt);
		const taxonomyKey =
			explicitTaxonomy ??
			(explicitPersonField ? PERSON_FIELD_TO_TAXONOMY[explicitPersonField] : null) ??
			inferredTaxonomy;
		if (!taxonomyKey) continue;

		const personFieldKey = explicitPersonField ?? TAXONOMY_TO_PERSON_FIELD[taxonomyKey] ?? null;
		const normalizedValues = normalizeAttributeValues(taxonomyKey, values);
		if (normalizedValues.length === 0) continue;

		candidates.push({
			taxonomyKey,
			personFieldKey,
			values: normalizedValues,
			sourceQuestionId: question.id,
			explicit: Boolean(explicitTaxonomy || explicitPersonField),
		});
	}

	const byTaxonomy = new Map<SurveyTaxonomyKey, CanonicalSurveyAttribute>();
	for (const candidate of candidates) {
		const existing = byTaxonomy.get(candidate.taxonomyKey);
		if (!existing) {
			byTaxonomy.set(candidate.taxonomyKey, candidate);
			continue;
		}
		if (candidate.explicit && !existing.explicit) {
			byTaxonomy.set(candidate.taxonomyKey, candidate);
		}
	}

	const resolved = Array.from(byTaxonomy.values());
	return resolved.map((entry) => {
		if (!SINGLE_VALUE_KEYS.has(entry.taxonomyKey) || supportsMultiValueFacet(entry.taxonomyKey)) return entry;
		const single = pickSingleValue(entry.values);
		return single ? { ...entry, values: [single] } : entry;
	});
}

async function upsertFacetValuesForKind({
	supabase,
	resolver,
	accountId,
	projectId,
	personId,
	kindSlug,
	values,
	replaceExisting,
}: {
	supabase: DbClient;
	resolver: FacetResolver;
	accountId: string;
	projectId: string | null;
	personId: string;
	kindSlug: string;
	values: string[];
	replaceExisting: boolean;
}): Promise<number> {
	const normalizedValues = Array.from(new Set(values.map(normalizeFreeText).filter(Boolean)));
	if (normalizedValues.length === 0) return 0;

	const { data: kind } = await supabase.from("facet_kind_global").select("id").eq("slug", kindSlug).maybeSingle();
	if (!kind?.id) {
		if (ENABLE_DEBUG_LOGS) {
			consola.debug("[survey-person-standardization] skipping unknown facet kind", { kindSlug });
		}
		return 0;
	}

	if (replaceExisting) {
		const { data: kindFacets } = await supabase
			.from("facet_account")
			.select("id")
			.eq("account_id", accountId)
			.eq("kind_id", kind.id);

		const facetIds = (kindFacets ?? []).map((row) => row.id);
		if (facetIds.length > 0) {
			let deleteQuery = supabase
				.from("person_facet")
				.delete()
				.eq("person_id", personId)
				.in("facet_account_id", facetIds);
			if (projectId) {
				deleteQuery = deleteQuery.eq("project_id", projectId);
			}
			await deleteQuery;
		}
	}

	let upserted = 0;
	for (const value of normalizedValues) {
		const facetAccountId = await resolver.ensureFacet({
			kindSlug,
			label: value,
			synonyms: [],
			isActive: true,
		});
		if (!facetAccountId) continue;

		const { error } = await supabase.from("person_facet").upsert(
			{
				account_id: accountId,
				project_id: projectId,
				person_id: personId,
				facet_account_id: facetAccountId,
				source: "survey_response",
				confidence: 0.95,
				noted_at: new Date().toISOString(),
			},
			{ onConflict: "person_id,facet_account_id" }
		);
		if (!error) {
			upserted += 1;
		}
	}

	return upserted;
}

export async function applySurveyResponsesToPersonProfile({
	supabase,
	accountId,
	projectId,
	personId,
	questions,
	responses,
}: {
	supabase: DbClient;
	accountId: string;
	projectId: string | null;
	personId: string;
	questions: ResearchLinkQuestion[];
	responses: ResponseRecord;
}): Promise<{
	attributesDetected: number;
	personFieldsUpdated: number;
	personFieldsSkipped: string[];
	facetsUpserted: number;
}> {
	const attributes = extractCanonicalSurveyAttributes(questions, responses);
	if (attributes.length === 0) {
		return {
			attributesDetected: 0,
			personFieldsUpdated: 0,
			personFieldsSkipped: [],
			facetsUpserted: 0,
		};
	}

	const { data: person } = await supabase
		.from("people")
		.select("id, title, job_function, seniority_level, role")
		.eq("id", personId)
		.maybeSingle();

	if (!person) {
		return {
			attributesDetected: attributes.length,
			personFieldsUpdated: 0,
			personFieldsSkipped: ["person_not_found"],
			facetsUpserted: 0,
		};
	}

	const personUpdate: Partial<{
		title: string;
		job_function: string;
		seniority_level: string;
		role: string;
	}> = {};
	const skippedFields: string[] = [];

	for (const attribute of attributes) {
		if (!attribute.personFieldKey) continue;
		const value = pickSingleValue(attribute.values);
		if (!value) continue;

		if (attribute.personFieldKey === "title") {
			if (shouldOverwrite(person.title, value)) personUpdate.title = value;
			else skippedFields.push("title");
			continue;
		}
		if (attribute.personFieldKey === "job_function") {
			if (shouldOverwrite(person.job_function, value)) personUpdate.job_function = value;
			else skippedFields.push("job_function");
			continue;
		}
		if (attribute.personFieldKey === "seniority_level") {
			if (shouldOverwrite(person.seniority_level, value)) personUpdate.seniority_level = value;
			else skippedFields.push("seniority_level");
			continue;
		}
		if (attribute.personFieldKey === "role") {
			if (shouldOverwrite(person.role, value)) personUpdate.role = value;
			else skippedFields.push("role");
		}
	}

	const updatesToApply = Object.keys(personUpdate).length;
	if (updatesToApply > 0) {
		await supabase.from("people").update(personUpdate).eq("id", personId);
	}

	const finalJobFunction = personUpdate.job_function ?? person.job_function;
	const finalSeniority = personUpdate.seniority_level ?? person.seniority_level;
	const finalTitle = personUpdate.title ?? person.title;

	if (projectId && (finalJobFunction || finalSeniority)) {
		await syncPeopleFieldsToFacets({
			supabase,
			personId,
			accountId,
			projectId,
			fields: {
				job_function: finalJobFunction,
				seniority_level: finalSeniority,
			},
		});
	}

	if (finalTitle && finalTitle.trim().length > 0) {
		await syncTitleToJobTitleFacet({
			supabase,
			personId,
			accountId,
			title: finalTitle,
		});
	}

	const resolver = new FacetResolver(supabase, accountId);
	let facetsUpserted = 0;

	for (const attribute of attributes) {
		const kindSlug = TAXONOMY_TO_FACET_KIND[attribute.taxonomyKey];
		if (!kindSlug) continue;
		facetsUpserted += await upsertFacetValuesForKind({
			supabase,
			resolver,
			accountId,
			projectId,
			personId,
			kindSlug,
			values: attribute.values,
			replaceExisting: false,
		});
	}

	if (ENABLE_DEBUG_LOGS) {
		consola.debug("[survey-person-standardization] applied", {
			personId,
			attributesDetected: attributes.length,
			personFieldsUpdated: updatesToApply,
			skippedFields,
			facetsUpserted,
		});
	}

	return {
		attributesDetected: attributes.length,
		personFieldsUpdated: updatesToApply,
		personFieldsSkipped: Array.from(new Set(skippedFields)),
		facetsUpserted,
	};
}
