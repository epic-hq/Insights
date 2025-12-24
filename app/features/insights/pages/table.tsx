import consola from "consola"
import type { LoaderFunctionArgs } from "react-router"
import { useLoaderData, useSearchParams } from "react-router-dom"
import { type InsightSegmentData, InsightsDataTable } from "~/features/insights/components/InsightsDataTableTS"
import { getInsights } from "~/features/insights/db"
import { currentProjectContext } from "~/server/current-project-context"
import { userContext } from "~/server/user-context"

// Map facet kind slugs to display labels
const FACET_KIND_TO_SEGMENT: Record<string, string> = {
	role: "Role",
	industry: "Industry",
	location: "Location",
	use_case: "Use Case",
	company_size: "Company Size",
	budget_range: "Budget",
	decision_authority: "Decision Authority",
	timeline_urgency: "Timeline",
}

// Infer job function from title
function inferJobFunction(title: string): string | null {
	const t = title.toLowerCase()
	if (t.includes("engineer") || t.includes("developer") || t.includes("software") || t.includes("architect")) {
		return "Engineering"
	}
	if (t.includes("product") && !t.includes("production")) return "Product"
	if (t.includes("design") || t.includes("ux") || t.includes("ui")) return "Design"
	if (t.includes("marketing") || t.includes("growth") || t.includes("brand")) return "Marketing"
	if (t.includes("sales") || t.includes("account executive") || t.includes("business development")) return "Sales"
	if (t.includes("customer success") || t.includes("support") || t.includes("service")) return "Customer Success"
	if (t.includes("operations") || t.includes("ops")) return "Operations"
	if (t.includes("finance") || t.includes("accounting") || t.includes("cfo")) return "Finance"
	if (t.includes("hr") || t.includes("human resources") || t.includes("people")) return "HR"
	if (t.includes("legal") || t.includes("counsel") || t.includes("compliance")) return "Legal"
	if (t.includes("data") || t.includes("analytics") || t.includes("bi ")) return "Data & Analytics"
	if (t.includes("research")) return "Research"
	if (t.includes("founder") || t.includes("ceo") || t.includes("cto") || t.includes("coo")) return "Executive"
	return null
}

// Infer seniority level from title
function inferSeniority(title: string): string | null {
	const t = title.toLowerCase()
	if (t.includes("ceo") || t.includes("cto") || t.includes("cfo") || t.includes("coo") || t.includes("chief")) {
		return "C-Level"
	}
	if (t.includes("founder") || t.includes("co-founder") || t.includes("owner")) return "C-Level"
	if (t.includes("vp ") || t.includes("vice president") || t.includes("evp") || t.includes("svp")) return "VP"
	if (t.includes("director") || t.includes("head of")) return "Director"
	if (t.includes("manager") || t.includes("lead") || t.includes("principal")) return "Manager"
	if (t.includes("senior") || t.includes("sr ") || t.includes("sr.")) return "Senior IC"
	if (t.includes("junior") || t.includes("jr ") || t.includes("jr.") || t.includes("associate")) return "Junior IC"
	if (t.includes("intern") || t.includes("trainee")) return "Intern"
	return "IC" // Default to individual contributor
}

export async function loader({ context, params }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase

	const ctx_project = context.get(currentProjectContext)
	const projectId = ctx_project.projectId || params.projectId || ""
	const accountId = ctx_project.accountId || params.accountId || ""

	if (!projectId || !accountId) {
		throw new Response("Missing project context", { status: 400 })
	}

	const { data, error } = await getInsights({ supabase, accountId, projectId })
	if (error) {
		console.error("Error loading insights:", error)
		throw new Response("Failed to load insights", { status: 500 })
	}

	const insights = data || []
	const insightIds = insights.map((i) => i.id)

	// Build segment data for each insight
	const insightSegments: Record<string, InsightSegmentData> = {}

	if (insightIds.length > 0) {
		// Get theme_evidence for insights
		const { data: themeEvidence } = await supabase
			.from("theme_evidence")
			.select("theme_id, evidence_id")
			.eq("project_id", projectId)
			.in("theme_id", insightIds)

		if (themeEvidence && themeEvidence.length > 0) {
			const evidenceIds = [...new Set(themeEvidence.map((te) => te.evidence_id))]

			// Get people linked to evidence via evidence_people junction table
			const { data: evidencePeopleLinks } = await supabase
				.from("evidence_people")
				.select(
					`
					evidence_id,
					person_id,
					people:person_id (
						id,
						job_function,
						seniority_level,
						title
					)
				`
				)
				.eq("project_id", projectId)
				.in("evidence_id", evidenceIds)

			// Get person facets for all linked people
			const personIds = [
				...new Set((evidencePeopleLinks ?? []).filter((ep) => ep.person_id).map((ep) => ep.person_id as string)),
			]
			const personFacets = new Map<string, Array<{ group: string; label: string }>>()
			const personOrgData = new Map<string, { size_range: string | null; industry: string | null }>()

			if (personIds.length > 0) {
				// Fetch person_facet data
				const { data: facetRows } = await supabase
					.from("person_facet")
					.select(
						`
						person_id,
						facet_account:facet_account_id (
							label,
							facet_kind_global:kind_id (
								slug
							)
						)
					`
					)
					.eq("project_id", projectId)
					.in("person_id", personIds)

				for (const row of facetRows ?? []) {
					const facetAccount = row.facet_account as {
						label: string
						facet_kind_global: { slug: string } | null
					} | null
					if (!row.person_id || !facetAccount) continue
					const kindSlug = facetAccount.facet_kind_global?.slug
					if (!kindSlug) continue
					const groupLabel = FACET_KIND_TO_SEGMENT[kindSlug]
					if (!groupLabel) continue

					if (!personFacets.has(row.person_id)) {
						personFacets.set(row.person_id, [])
					}
					personFacets.get(row.person_id)!.push({ group: groupLabel, label: facetAccount.label })
				}

				// Fetch organization data for people (company size, industry)
				const { data: orgLinks } = await supabase
					.from("people_organizations")
					.select(
						`
            person_id,
            is_primary,
            organization:organization_id (
              size_range,
              industry
            )
          `
					)
					.in("person_id", personIds)

				for (const link of orgLinks ?? []) {
					if (!link.person_id || !link.organization) continue
					const org = link.organization as {
						size_range: string | null
						industry: string | null
					}
					// Only set if not already set, or if this is the primary org
					if (!personOrgData.has(link.person_id) || link.is_primary) {
						personOrgData.set(link.person_id, {
							size_range: org.size_range,
							industry: org.industry,
						})
					}
				}
			}

			// Build evidence → insight lookup
			const evidenceToInsight = new Map(themeEvidence.map((te) => [te.evidence_id, te.theme_id]))

			// Track unique people per insight to avoid double-counting
			const insightPeopleSeen = new Map<string, Set<string>>()

			// Aggregate segments per insight
			for (const ep of evidencePeopleLinks ?? []) {
				if (!ep.person_id || !ep.people) continue
				const insightId = evidenceToInsight.get(ep.evidence_id)
				if (!insightId) continue

				// Skip if we've already counted this person for this insight
				if (!insightPeopleSeen.has(insightId)) {
					insightPeopleSeen.set(insightId, new Set())
				}
				if (insightPeopleSeen.get(insightId)!.has(ep.person_id)) continue
				insightPeopleSeen.get(insightId)!.add(ep.person_id)

				if (!insightSegments[insightId]) {
					insightSegments[insightId] = {
						jobFunction: {},
						seniority: {},
						segment: {},
						facets: {},
					}
				}

				const person = ep.people as {
					id: string
					job_function: string | null
					seniority_level: string | null
					title: string | null
				}

				// Count job_function (fall back to title if job_function not set)
				const jobFunc = person.job_function || (person.title ? inferJobFunction(person.title) : null)
				if (jobFunc) {
					insightSegments[insightId].jobFunction[jobFunc] = (insightSegments[insightId].jobFunction[jobFunc] || 0) + 1
				}
				// Count seniority_level (fall back to title if seniority not set)
				const seniority = person.seniority_level || (person.title ? inferSeniority(person.title) : null)
				if (seniority) {
					insightSegments[insightId].seniority[seniority] = (insightSegments[insightId].seniority[seniority] || 0) + 1
				}
				// Count facets from person_facet table
				const facets = personFacets.get(person.id)
				if (facets) {
					for (const facet of facets) {
						const key = `${facet.group}: ${facet.label}`
						insightSegments[insightId].facets[key] = (insightSegments[insightId].facets[key] || 0) + 1
					}
				}

				// Add organization data (company size, industry) as facets
				const orgData = personOrgData.get(person.id)
				if (orgData) {
					if (orgData.size_range) {
						const key = `Company Size: ${orgData.size_range}`
						insightSegments[insightId].facets[key] = (insightSegments[insightId].facets[key] || 0) + 1
					}
					if (orgData.industry) {
						const key = `Industry: ${orgData.industry}`
						insightSegments[insightId].facets[key] = (insightSegments[insightId].facets[key] || 0) + 1
					}
				}
			}
		}
	}

	consola.log(`[table] Loaded ${insights.length} insights with segment data for ${Object.keys(insightSegments).length}`)
	return { insights, insightSegments }
}

export default function Table() {
	const { insights, insightSegments } = useLoaderData<typeof loader>()
	const insightsData = insights || []
	const [, setSearchParams] = useSearchParams()

	const clearFilters = () => {
		setSearchParams({})
	}

	return (
		<>
			{insightsData.length > 0 ? (
				<InsightsDataTable data={insightsData} segmentData={insightSegments} />
			) : (
				<div className="rounded-lg bg-card p-8 text-center shadow-sm">
					<p className="text-lg text-muted-foreground">No insights match your current filters</p>
					<button type="button" onClick={clearFilters} className="mt-4 text-primary hover:underline">
						Clear all filters
					</button>
				</div>
			)}
		</>
	)
}
