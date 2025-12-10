import consola from "consola"
import React from "react"
import type { LoaderFunctionArgs, MetaFunction } from "react-router"
import { useLoaderData } from "react-router-dom"
import { PageContainer } from "~/components/layout/PageContainer"
import { BackButton } from "~/components/ui/back-button"
import { getInsightById } from "~/features/insights/db"
import { userContext } from "~/server/user-context"
import { InsightCardV3Page } from "../components/InsightCardV3Page"
import type { Route } from "./+types/insight-detail"

/** Minimal evidence shape for insight detail page */
export type InsightEvidence = {
	id: string
	gist: string | null
	verbatim: string | null
	interview_id: string | null
	interview: {
		id: string
		title: string | null
		thumbnail_url: string | null
	} | null
	/** Attribution line - person name, org, or interview title */
	attribution: string
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	return [
		{ title: `${data?.insight?.name || "Insight"} | Insights` },
		{ name: "description", content: "Insight details" },
	]
}

export async function loader({ params, context }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase

	if (!supabase) {
		throw new Response("Unauthorized", { status: 401 })
	}

	// Both from URL params - consistent, explicit, RESTful
	const accountId = params.accountId
	const projectId = params.projectId
	const projectPath = `/a/${accountId}/${projectId}`
	const { insightId } = params

	if (!accountId || !projectId || !insightId) {
		throw new Response("Account ID, Project ID, and Insight ID are required", { status: 400 })
	}

	try {
		const insight = await getInsightById({
			supabase,
			accountId,
			projectId,
			id: insightId,
		})

		if (!insight) {
			throw new Response("Insight not found", { status: 404 })
		}

		// Fetch evidence linked to this insight (theme)
		const { data: themeEvidence, error: themeEvidenceError } = await supabase
			.from("theme_evidence")
			.select("evidence_id")
			.eq("theme_id", insightId)
			.eq("project_id", projectId)

		consola.log(`[insight-detail] theme_evidence query for theme ${insightId}:`, {
			count: themeEvidence?.length ?? 0,
			error: themeEvidenceError,
			evidenceCount: (insight as any).evidence_count,
		})

		const evidenceIds = themeEvidence?.map((te) => te.evidence_id).filter(Boolean) ?? []

		let evidence: InsightEvidence[] = []
		if (evidenceIds.length > 0) {
			// Fetch evidence with interview details including person link
			const { data: evidenceData } = await supabase
				.from("evidence")
				.select(
					`
					id,
					gist,
					verbatim,
					interview_id,
					interview:interview_id (
						id,
						title,
						thumbnail_url,
						person:person_id (
							id,
							name,
							organizations:organization_id (
								name
							)
						)
					)
				`
				)
				.in("id", evidenceIds)
				.limit(10)

			// Fetch people linked directly to evidence (evidence_people table)
			const { data: evidencePeople } = await supabase
				.from("evidence_people")
				.select(
					`
					evidence_id,
					people:person_id (
						id,
						name,
						organizations:organization_id (
							name
						)
					)
				`
				)
				.eq("project_id", projectId)
				.in("evidence_id", evidenceIds)

			// Build a map of evidence_id -> first person from evidence_people
			const personByEvidence = new Map<string, { name: string | null; org_name: string | null }>()
			for (const ep of (evidencePeople ?? []) as any[]) {
				if (ep.evidence_id && ep.people && !personByEvidence.has(ep.evidence_id)) {
					personByEvidence.set(ep.evidence_id, {
						name: ep.people.name,
						org_name: ep.people.organizations?.name ?? null,
					})
				}
			}

			// Also get interview_people for interviews as another fallback
			const interviewIds = [...new Set((evidenceData ?? []).map((e: any) => e.interview_id).filter(Boolean))]
			const personByInterview = new Map<string, { name: string | null; org_name: string | null }>()

			if (interviewIds.length > 0) {
				const { data: interviewPeople } = await supabase
					.from("interview_people")
					.select(
						`
						interview_id,
						people:person_id (
							name,
							organizations:organization_id (
								name
							)
						)
					`
					)
					.in("interview_id", interviewIds)

				for (const ip of (interviewPeople ?? []) as any[]) {
					if (ip.interview_id && ip.people && !personByInterview.has(ip.interview_id)) {
						personByInterview.set(ip.interview_id, {
							name: ip.people.name,
							org_name: ip.people.organizations?.name ?? null,
						})
					}
				}
			}

			// Build attribution with fallbacks: evidence_people -> interview.person -> interview_people -> interview.title
			evidence = (evidenceData ?? []).map((ev: any) => {
				let attribution = ""

				// Try 1: Person linked directly to evidence
				const evPerson = personByEvidence.get(ev.id)
				if (evPerson?.name) {
					attribution = evPerson.org_name ? `${evPerson.name}, ${evPerson.org_name}` : evPerson.name
				}
				// Try 2: Person linked to interview
				else if (ev.interview?.person?.name) {
					const intPerson = ev.interview.person
					attribution = intPerson.organizations?.name
						? `${intPerson.name}, ${intPerson.organizations.name}`
						: intPerson.name
				}
				// Try 3: interview_people
				else if (ev.interview_id) {
					const intPersonFromJoin = personByInterview.get(ev.interview_id)
					if (intPersonFromJoin?.name) {
						attribution = intPersonFromJoin.org_name
							? `${intPersonFromJoin.name}, ${intPersonFromJoin.org_name}`
							: intPersonFromJoin.name
					}
				}
				// Fallback: interview title
				if (!attribution && ev.interview?.title) {
					attribution = ev.interview.title
				}

				return {
					id: ev.id,
					gist: ev.gist,
					verbatim: ev.verbatim,
					interview_id: ev.interview_id,
					interview: ev.interview
						? { id: ev.interview.id, title: ev.interview.title, thumbnail_url: ev.interview.thumbnail_url }
						: null,
					attribution: attribution || "Interview",
				}
			}) as InsightEvidence[]
		}

		return {
			insight,
			evidence,
			projectPath,
		}
	} catch (error) {
		consola.error("Error loading insight:", error)
		if (error instanceof Response) {
			throw error
		}
		throw new Response("Failed to load insight", { status: 500 })
	}
}

type ErrorBoundaryState = {
	error: unknown | null
}

class InsightContentBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
	constructor(props: { children: React.ReactNode }) {
		super(props)
		this.state = { error: null }
	}
	static getDerivedStateFromError(error: unknown) {
		return { error }
	}
	componentDidCatch(_error: unknown) {
		// Optionally send to server or analytics here
	}
	render() {
		if (this.state.error) {
			return <div style={{ color: "red" }}>An error occurred: {String(this.state.error)}</div>
		}
		return this.props.children
	}
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
	return <div style={{ color: "red" }}>An error occurred: {String(error)}</div>
}

export default function InsightDetail() {
	const { insight, evidence, projectPath } = useLoaderData<typeof loader>()
	if (!insight) {
		return <div>Insight not found</div>
	}
	return (
		<PageContainer size="lg" padded={false} className="max-w-4xl space-y-6">
			<BackButton />
			<InsightContentBoundary>
				<InsightCardV3Page insight={insight} evidence={evidence} projectPath={projectPath} extended={true} />
			</InsightContentBoundary>
		</PageContainer>
	)
}
