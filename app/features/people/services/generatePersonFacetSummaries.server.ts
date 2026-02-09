import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import consola from "consola";
import { b } from "~/../baml_client";
import type { Database } from "~/types";
import type { getPersonById } from "../db";

type PersonRecord = Awaited<ReturnType<typeof getPersonById>>;

type EvidenceLinkRow = {
	role?: string | null;
	evidence: {
		id: string;
		gist: string | null;
		context_summary: string | null;
		verbatim: string | null;
		journey_stage: string | null;
		topic: string | null;
		support: string | null;
		created_at: string;
		interview_id: string | null;
		project_id: string | null;
	} | null;
};

type InterviewLookup = Map<string, { title: string | null; date: string | null }>;

const MAX_EVIDENCE_HIGHLIGHTS = 6;
const MODEL_VERSION = "person_facet_lens_v1";

function normalizeFloat(value: unknown): number | null {
	if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) return null;
	return value;
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
	append("Title", person.title || person.role);
	append("Role", person.role && person.role !== person.title ? person.role : null);
	append("Company", (primaryOrg as { name?: string | null } | null)?.name ?? person.company);
	append("Industry", (primaryOrg as { industry?: string | null } | null)?.industry ?? person.industry);
	append("Location", person.location);

	return facts;
}

function truncateSnippet(text: string | null | undefined): string | null {
	if (!text) return null;
	const collapsed = text.replace(/\s+/g, " ").trim();
	if (!collapsed) return null;
	const MAX_SNIPPET_LENGTH = 200;
	if (collapsed.length <= MAX_SNIPPET_LENGTH) return collapsed;
	return `${collapsed.slice(0, MAX_SNIPPET_LENGTH - 1)}…`;
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
}) {
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
		consola.warn("generatePersonFacetSummaries: failed to load evidence highlights", error);
		return [];
	}

	const highlights: Array<{
		gist: string;
		interview_title: string | null;
		interview_date: string | null;
		journey_stage: string | null;
		topic: string | null;
		support: string | null;
	}> = [];

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

function buildFacetGroups(person: PersonRecord) {
	const groups = new Map<
		string,
		{
			kind_label: string | null;
			facets: Array<{ label: string; source: string | null; confidence: number | null }>;
		}
	>();

	for (const facet of person.person_facet ?? []) {
		const kindSlug = facet.facet?.facet_kind_global?.slug ?? "";
		if (!kindSlug) continue;
		const kindLabel = facet.facet?.facet_kind_global?.label ?? kindSlug;
		const label =
			facet.facet?.label ??
			((facet.facet_account_id ? `Facet ${facet.facet_account_id}` : "") || facet.source || kindLabel);

		if (!label) continue;

		if (!groups.has(kindSlug)) {
			groups.set(kindSlug, { kind_label: kindLabel, facets: [] });
		}

		groups.get(kindSlug)?.facets.push({
			label,
			source: facet.source ?? null,
			confidence: normalizeFloat(facet.confidence),
		});
	}

	return Array.from(groups.entries()).map(([kind_slug, value]) => ({ kind_slug, ...value }));
}

function computeInputHash(payload: unknown): string {
	const serialized = JSON.stringify(payload);
	return createHash("sha256").update(serialized).digest("hex");
}

export async function generatePersonFacetSummaries({
	supabase,
	person,
	projectId,
	accountId,
	force = false,
}: {
	supabase: SupabaseClient<Database>;
	person: PersonRecord;
	projectId: string;
	accountId: string;
	force?: boolean;
}) {
	const facetGroups = buildFacetGroups(person);
	if (facetGroups.length === 0) {
		consola.info("generatePersonFacetSummaries: no facets to summarize", { personId: person.id });
		return [];
	}

	const interviewLookup = buildInterviewLookup(person);
	const evidenceHighlights = await fetchEvidenceHighlights({
		supabase,
		personId: person.id,
		projectId,
		limit: MAX_EVIDENCE_HIGHLIGHTS,
		interviewLookup,
	});

	const primaryOrgForPayload = person.people_organizations?.find((po: { is_primary?: boolean | null }) => po.is_primary)?.organization ?? person.people_organizations?.[0]?.organization;
	const payload = {
		person: {
			person_id: person.id,
			name: person.name ?? null,
			title: person.title ?? person.role ?? null,
			company: (primaryOrgForPayload as { name?: string | null } | null)?.name ?? person.company ?? null,
			segment: person.segment ?? null,
			persona: person.people_personas?.[0]?.personas?.name ?? null,
			quick_facts: buildQuickFacts(person),
		},
		facet_groups: facetGroups,
		evidence_highlights: evidenceHighlights,
	};

	const inputHash = computeInputHash(payload);

	const { data: existing, error: existingError } = await supabase
		.from("person_facet_summaries")
		.select("*")
		.eq("person_id", person.id)
		.eq("project_id", projectId);

	if (existingError) {
		consola.warn("generatePersonFacetSummaries: failed to load existing summaries", existingError);
	}

	const summariesMatch =
		!force &&
		(existing?.length ?? 0) === facetGroups.length &&
		existing?.every((row) => row.input_hash && row.input_hash === inputHash);

	if (summariesMatch && existing) {
		return existing;
	}

	try {
		const response = await b.SummarizePersonFacetLens(payload);
		const summaries = response?.summaries ?? [];

		if (summaries.length === 0) {
			consola.warn("generatePersonFacetSummaries: BAML returned no summaries", { personId: person.id });
			return existing ?? [];
		}

		const upsertPayload = summaries.map((summary) => ({
			account_id: accountId,
			project_id: projectId,
			person_id: person.id,
			kind_slug: summary.kind_slug,
			summary: summary.summary,
			input_hash: inputHash,
			model_version: MODEL_VERSION,
			supporting_evidence: evidenceHighlights,
		}));

		const { data, error } = await supabase
			.from("person_facet_summaries")
			.upsert(upsertPayload, { onConflict: "person_id,kind_slug" })
			.select();

		if (error) {
			consola.error("generatePersonFacetSummaries: failed to upsert", { error, personId: person.id });
			return existing ?? [];
		}

		return data ?? [];
	} catch (error) {
		consola.error("generatePersonFacetSummaries: BAML call failed", { error, personId: person.id });
		return existing ?? [];
	}
}
