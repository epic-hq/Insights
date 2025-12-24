import consola from "consola"
import type { LoaderFunctionArgs } from "react-router"
import { useLoaderData, useSearchParams } from "react-router-dom"
import { type InsightSegmentData, InsightsDataTable } from "~/features/insights/components/InsightsDataTableTS"
import { getInsights } from "~/features/insights/db"
import { currentProjectContext } from "~/server/current-project-context"
import { userContext } from "~/server/user-context"

// Map facet kind slugs to segment group IDs
const FACET_KIND_TO_SEGMENT: Record<string, string> = {
	role: "Role",
	industry: "Industry",
	location: "Location",
	use_case: "Use Case",
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

			// Get people linked to evidence with demographic data
			const { data: evidencePeople } = await supabase
				.from("evidence_facet")
				.select(
					`
					evidence_id,
					person_id,
					people:person_id (
						id,
						job_function,
						seniority_level
					)
				`
				)
				.eq("project_id", projectId)
				.in("evidence_id", evidenceIds)
				.not("person_id", "is", null)

			// Get person facets
			const personIds = [
				...new Set((evidencePeople ?? []).filter((ep) => ep.person_id).map((ep) => ep.person_id as string)),
			]
			const personFacets = new Map<string, Array<{ group: string; label: string }>>()

			if (personIds.length > 0) {
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
			}

			// Build evidence → insight lookup
			const evidenceToInsight = new Map(themeEvidence.map((te) => [te.evidence_id, te.theme_id]))

			// Aggregate segments per insight
			for (const ep of evidencePeople ?? []) {
				if (!ep.person_id || !ep.people) continue
				const insightId = evidenceToInsight.get(ep.evidence_id)
				if (!insightId) continue

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
				}

				// Count job_function
				if (person.job_function) {
					insightSegments[insightId].jobFunction[person.job_function] =
						(insightSegments[insightId].jobFunction[person.job_function] || 0) + 1
				}
				// Count seniority_level
				if (person.seniority_level) {
					insightSegments[insightId].seniority[person.seniority_level] =
						(insightSegments[insightId].seniority[person.seniority_level] || 0) + 1
				}
				// NOTE: deprecated segment field removed
				// Count facets
				const facets = personFacets.get(person.id)
				if (facets) {
					for (const facet of facets) {
						const key = `${facet.group}: ${facet.label}`
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
