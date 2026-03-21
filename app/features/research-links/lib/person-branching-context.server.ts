import type { SupabaseClient } from "@supabase/supabase-js";
import type { PersonAttributeRecord } from "~/features/research-links/branching-context";
import type { Database } from "~/types";

type DbClient = SupabaseClient<Database>;

function deriveIcpBand(score: number | null | undefined, band: string | null | undefined): string | null {
	if (band && band.trim().length > 0) return band;
	if (typeof score !== "number") return null;
	if (score >= 0.7) return "Strong";
	if (score >= 0.5) return "Moderate";
	return "Weak";
}

export async function fetchPersonAttributesForBranching(
	supabase: DbClient,
	personId: string
): Promise<PersonAttributeRecord> {
	const [personResult, icpResult, facetsResult] = await Promise.all([
		supabase
			.from("people")
			.select(
				"id, title, job_function, seniority_level, role, segment, default_organization_id, organizations!default_organization_id(name, industry, size_range)"
			)
			.eq("id", personId)
			.maybeSingle(),
		supabase
			.from("person_scale")
			.select("score, band")
			.eq("person_id", personId)
			.eq("kind_slug", "icp_match")
			.maybeSingle(),
		supabase
			.from("person_facet")
			.select("kind_slug, value")
			.eq("person_id", personId)
			.in("kind_slug", ["persona", "membership_status", "membership_year", "membership_expiration"]),
	]);

	const person = personResult.data;
	if (!person) return {};

	const organization = person.organizations as {
		name: string | null;
		industry: string | null;
		size_range: string | null;
	} | null;
	const facets = facetsResult.data ?? [];

	const personas = facets
		.filter((facet) => facet.kind_slug === "persona")
		.map((facet) => facet.value)
		.filter(Boolean);
	const membershipStatus = facets.find((facet) => facet.kind_slug === "membership_status")?.value ?? null;
	const membershipYear = facets.find((facet) => facet.kind_slug === "membership_year")?.value ?? null;
	const membershipExpiration = facets.find((facet) => facet.kind_slug === "membership_expiration")?.value ?? null;

	return {
		title: person.title ?? null,
		job_function: person.job_function ?? null,
		seniority_level: person.seniority_level ?? null,
		role: person.role ?? null,
		segment: person.segment ?? null,
		company: organization?.name ?? null,
		industry: organization?.industry ?? null,
		company_size: organization?.size_range ?? null,
		persona: personas.length > 0 ? personas : null,
		icp_band: deriveIcpBand(icpResult.data?.score, icpResult.data?.band),
		membership_status: membershipStatus,
		membership_year: membershipYear,
		membership_expiration: membershipExpiration,
	};
}
