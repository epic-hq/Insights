import type { SupabaseClient } from "@supabase/supabase-js";
import consola from "consola";
import { b } from "~/../baml_client";
import type { PersonProfileInput } from "~/../baml_client/types";
import type { Database } from "~/types";
import type { getPersonById } from "../db";

type PersonRecord = Awaited<ReturnType<typeof getPersonById>>;

type InterviewLookup = Map<string, { title: string | null; date: string | null }>;

type EvidenceLinkRow = {
	role?: string | null;
	evidence: {
		id: string;
		gist: string | null;
		context_summary: string | null;
		verbatim: string;
		journey_stage: string | null;
		topic: string | null;
		support: string | null;
		created_at: string;
		interview_id: string | null;
	} | null;
};

type GeneratePersonDescriptionArgs = {
	supabase: SupabaseClient<Database>;
	person: PersonRecord;
	projectId: string;
	maxEvidenceHighlights?: number;
};

const DEFAULT_EVIDENCE_LIMIT = 6;
const MAX_SNIPPET_LENGTH = 200;

function normalizeFloat(value: unknown): number | null {
	if (typeof value !== "number" || Number.isNaN(value)) return null;
	if (!Number.isFinite(value)) return null;
	return value;
}

function buildQuickFacts(person: PersonRecord): string[] {
	const facts: string[] = [];
	const append = (label: string, value?: string | number | null) => {
		if (value === null || value === undefined) return;
		const trimmed = typeof value === "string" ? value.trim() : String(value);
		if (!trimmed) return;
		facts.push(`${label}: ${trimmed}`);
	};

	const primaryOrg = person.people_organizations?.find((po: { is_primary?: boolean | null }) => po.is_primary)?.organization ?? person.people_organizations?.[0]?.organization;
	append("Segment", person.segment);
	append("Title", person.title);
	append("Company", (primaryOrg as { name?: string | null } | null)?.name ?? null);
	append("Industry", (primaryOrg as { industry?: string | null } | null)?.industry ?? null);
	append("Location", person.location);
	append("Age", typeof person.age === "number" ? `${person.age}` : null);
	append("Education", person.education);
	append("Languages", Array.isArray(person.languages) ? person.languages.filter(Boolean).join(", ") : null);

	const personaName = person.people_personas?.[0]?.personas?.name;
	append("Persona", personaName);

	return facts;
}

function truncateSnippet(text: string | null | undefined): string | null {
	if (!text) return null;
	const collapsed = text.replace(/\s+/g, " ").trim();
	if (!collapsed) return null;
	if (collapsed.length <= MAX_SNIPPET_LENGTH) return collapsed;
	return `${collapsed.slice(0, MAX_SNIPPET_LENGTH - 1)}…`;
}

function buildInterviewLookup(person: PersonRecord): InterviewLookup {
	const lookup: InterviewLookup = new Map();
	for (const link of person.interview_people ?? []) {
		const interview = link.interviews;
		if (!interview?.id) continue;
		const createdAt = interview.created_at ?? (interview as { interview_date?: string | null })?.interview_date ?? null;
		lookup.set(interview.id, {
			title: interview.title ?? null,
			date: createdAt,
		});
	}
	return lookup;
}

async function fetchEvidenceHighlights({
	supabase,
	personId,
	projectId,
	limit,
	interviewLookup,
}: {
	supabase: SupabaseClient<Database>;
	personId: string;
	projectId: string;
	limit: number;
	interviewLookup: InterviewLookup;
}): Promise<PersonProfileInput["evidence_highlights"]> {
	const { data, error } = await supabase
		.from("evidence_people")
		.select(
			`
				role,
				evidence:evidence!inner(
					id,
					gist,
					context_summary,
					verbatim,
					journey_stage,
					topic,
					support,
					created_at,
					interview_id,
					project_id
				)
			`
		)
		.eq("person_id", personId)
		.eq("evidence.project_id", projectId)
		.order("created_at", { ascending: false, foreignTable: "evidence" })
		.limit(limit);

	if (error) {
		consola.warn("generatePersonDescription: failed to load evidence highlights", error);
		return [];
	}

	const highlights: PersonProfileInput["evidence_highlights"] = [];
	for (const row of (data ?? []) as EvidenceLinkRow[]) {
		const evidence = row.evidence;
		if (!evidence) continue;
		const snippet =
			truncateSnippet(evidence.gist) ?? truncateSnippet(evidence.context_summary) ?? truncateSnippet(evidence.verbatim);
		if (!snippet) continue;
		const interviewMeta = evidence.interview_id ? interviewLookup.get(evidence.interview_id) : null;
		highlights.push({
			gist: snippet,
			interview_title: interviewMeta?.title ?? null,
			interview_date: interviewMeta?.date ?? evidence.created_at ?? null,
			journey_stage: evidence.journey_stage ?? null,
			topic: evidence.topic ?? null,
			support: evidence.support ?? null,
		});
	}

	return highlights;
}

function mapPersonToProfile(
	person: PersonRecord,
	evidenceHighlights: PersonProfileInput["evidence_highlights"]
): PersonProfileInput {
	const quickFacts = buildQuickFacts(person);
	const facets =
		person.person_facet
			?.map((facet) => {
				const label =
					(facet.facet?.label ?? undefined) || (facet.facet_account_id ? `Facet ${facet.facet_account_id}` : undefined);
				const kindSlug = facet.facet?.facet_kind_global?.slug ?? "";
				if (!label || !kindSlug) return null;
				return {
					label,
					kind_slug: kindSlug,
					source: facet.source ?? null,
					confidence: normalizeFloat(facet.confidence),
				};
			})
			.filter((facet): facet is NonNullable<typeof facet> => Boolean(facet)) ?? [];

	const scales =
		person.person_scale
			?.map((scale) => {
				if (!scale.kind_slug) return null;
				return {
					kind_slug: scale.kind_slug,
					score: normalizeFloat(scale.score),
					band: scale.band ?? null,
					source: scale.source ?? null,
					confidence: normalizeFloat(scale.confidence),
				};
			})
			.filter((scale): scale is NonNullable<typeof scale> => Boolean(scale)) ?? [];

	return {
		person_id: person.id,
		name: person.name ?? null,
		title: person.title ?? null,
		role: null, // DEPRECATED: people.role no longer populated
		company: (person.people_organizations?.find((po: { is_primary?: boolean | null }) => po.is_primary)?.organization as { name?: string | null } | null)?.name ?? null,
		segment: person.segment ?? null,
		persona: person.people_personas?.[0]?.personas?.name ?? null,
		quick_facts: quickFacts,
		facets,
		scales,
		evidence_highlights: evidenceHighlights,
	};
}

export async function generatePersonDescription({
	supabase,
	person,
	projectId,
	maxEvidenceHighlights = DEFAULT_EVIDENCE_LIMIT,
}: GeneratePersonDescriptionArgs): Promise<string> {
	const interviewLookup = buildInterviewLookup(person);
	const evidenceHighlights = await fetchEvidenceHighlights({
		supabase,
		personId: person.id,
		projectId,
		limit: maxEvidenceHighlights,
		interviewLookup,
	});
	const profile = mapPersonToProfile(person, evidenceHighlights);

	if (
		profile.facets.length === 0 &&
		profile.quick_facts.length === 0 &&
		profile.scales.length === 0 &&
		profile.evidence_highlights.length === 0
	) {
		throw new Error("Insufficient structured data to summarize this person.");
	}

	try {
		const response = await b.SummarizePersonProfile(profile);
		const summary = response?.summary?.trim();
		if (!summary) {
			throw new Error("BAML returned an empty summary.");
		}
		return summary;
	} catch (error) {
		consola.error("generatePersonDescription: failed to summarize person", {
			personId: person.id,
			error,
		});
		throw error instanceof Error ? error : new Error("Failed to generate person description.");
	}
}
