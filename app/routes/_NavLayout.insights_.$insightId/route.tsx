import { type MetaFunction, useLoaderData } from "react-router"
import { Link } from "react-router-dom"
import type { Database } from "~/../supabase/types"
import InsightCardV2 from "~/components/insights/InsightCardV2"  
import { getServerClient } from "~/lib/supabase/server"

export const meta: MetaFunction = ({ params }) => {
	return [
		{ title: `Insight ${params.insightId || ""} | Insights` },
		{ name: "description", content: "Insight details" },
	]
}

export async function loader({ request, params }: { request: Request; params: { insightId: string } }) {
	const { client: supabase } = getServerClient(request)
	const { data: jwt } = await supabase.auth.getClaims()
	const accountId = jwt?.claims.sub

	const insightId = params.insightId

	// Fetch insight data from database with account filtering for RLS
	const { data: insightData, error: insightError } = await supabase
		.from("insights")
		.select("*")
		.eq("id", insightId)
		.eq("account_id", accountId)
		.single()

	if (insightError) {
		throw new Response(`Error fetching insight: ${insightError.message}`, { status: 500 })
	}

	if (!insightData) {
		throw new Response("Insight not found", { status: 404 })
	}

	// Use Supabase types directly like interviews pattern
	type InsightRow = Database["public"]["Tables"]["insights"]["Row"]
	const insight: InsightRow = insightData

	// Fetch related interview data if available
	let interviewData = null
	if (insight.interview_id) {
		const { data: interview } = await supabase
			.from("interviews")
			.select("*")
			.eq("id", insight.interview_id)
			.eq("account_id", accountId)
			.single()

		interviewData = interview
	}

	// Get related insights from the same category
	const { data: relatedInsights } = await supabase
		.from("insights")
		.select("id, name, category, impact, novelty")
		.eq("account_id", accountId)
		.eq("category", insight.category)
		.neq("id", insightId)
		.limit(5)

	return {
		insight,
		interviewData,
		relatedInsights: relatedInsights || [],
	}
}

export default function InsightDetailPage() {
	const { insight, interviewData, relatedInsights } = useLoaderData<typeof loader>()

	if (!insight) {
		return (
			<div className="flex h-64 items-center justify-center">
				<div className="text-center">
					<h1 className="mb-2 font-bold text-2xl text-gray-900">Insight Not Found</h1>
					<p className="text-gray-600">The insight you're looking for doesn't exist or has been removed.</p>
				</div>
			</div>
		)
	}

	return (
		<div className="mx-auto max-w-7xl px-4 py-6">
			<div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
				<div className="lg:col-span-3">
					{/* Transform to InsightView for component compatibility */}
					<InsightCardV2 insight={{
						id: insight.id,
						name: insight.name || "",
						category: insight.category || "",
						journeyStage: insight.journey_stage || "",
						impact: insight.impact || 0,
						novelty: insight.novelty || 0,
						jtbd: insight.jtbd || "",
						pain: insight.pain || "",
						desiredOutcome: insight.desired_outcome || "",
						details: insight.details || "",
						evidence: insight.evidence || "",
						opportunityIdeas: insight.opportunity_ideas || [],
						confidence: insight.confidence || "",
						createdAt: new Date(insight.created_at),
						relatedTags: [],
						contradictions: insight.contradictions || "",
						interview_id: insight.interview_id,
						underlyingMotivation: insight.motivation || "",
					} as any} />

					{/* Related Interview Section */}
					{interviewData && (
						<div className="mt-6 rounded-lg bg-white p-6 shadow-sm">
							<h2 className="mb-3 font-semibold text-lg">Source Interview</h2>
							<div className="flex items-center justify-between rounded border bg-gray-50 p-3">
								<div>
									<Link to={`/interviews/${interviewData.id}`} className="font-medium text-gray-900">
										{interviewData.title || "Untitled Interview"}
									</Link>
									{interviewData.participant_pseudonym && (
										<span className="ml-2 text-blue-700">{interviewData.participant_pseudonym}</span>
									)}
									{interviewData.interview_date && (
										<span className="ml-2 text-gray-500">
											{new Date(interviewData.interview_date).toLocaleDateString()}
										</span>
									)}
								</div>
								<Link
									to={`/interviews/${interviewData.id}`}
									className="text-blue-600 text-sm hover:underline"
								>
									View Interview
								</Link>
							</div>
						</div>
					)}
				</div>

				{/* Sidebar with Related Insights */}
				<aside className="space-y-4">
					<div className="rounded-lg bg-white p-4 shadow-sm">
						<h2 className="mb-3 font-semibold text-lg">Related Insights</h2>
						{relatedInsights.length > 0 ? (
							<ul className="space-y-2">
								{relatedInsights.map((related) => (
									<li key={related.id} className="rounded border bg-gray-50 p-2 transition hover:bg-gray-100">
										<Link to={`/insights/${related.id}`} className="font-medium text-gray-900 text-sm">
											{related.name || "Untitled"}
										</Link>
										<div className="text-gray-500 text-xs">
											Impact: {related.impact || 0} | Novelty: {related.novelty || 0}
										</div>
									</li>
								))}
							</ul>
						) : (
							<div className="text-gray-400 italic text-sm">No related insights found.</div>
						)}
					</div>
				</aside>
			</div>
		</div>
	)
}
