import { type MetaFunction, useLoaderData } from "react-router"
import { Link } from "react-router-dom"
import InsightCardV2 from "~/components/insights/InsightCardV2"
import type { InsightView } from "~/types"
import { db } from "~/utils/supabase.server"
import consola from "consola"

export const meta: MetaFunction = ({ params }) => {
	return [
		{ title: `Insight ${params.insightId || ""} | Insights` },
		{ name: "description", content: "Insight details" },
	]
}

export async function loader({ params }: { params: { insightId: string } }) {
	const insightId = params.insightId
	consola.info(`Loading insight with ID: ${insightId}`)

	// Fetch insight data from database
	const { data: insightData, error: insightError } = await db
		.from("insights")
		.select("*")
		.eq("id", insightId)
		.single()

	if (insightError) {
		consola.error(`Error fetching insight: ${insightError.message}`)
		throw new Response(`Error fetching insight: ${insightError.message}`, { status: 500 })
	}

	if (!insightData) {
		consola.error(`Insight not found: ${insightId}`)
		throw new Response(`Insight not found: ${insightId}`, { status: 404 })
	}

	// Transform insight data to InsightView
	const insight: InsightView = {
		id: insightData.id,
		name: insightData.name || "",
		title: insightData.name || "", // Use name as title for backward compatibility
		category: insightData.category || "",
		journeyStage: insightData.journey_stage || undefined, // Convert null to undefined
		impact: insightData.impact,
		novelty: insightData.novelty,
		jtbd: insightData.jtbd,
		pain: insightData.pain,
		desiredOutcome: insightData.desired_outcome,
		description: undefined, // Not in DB schema
		evidence: undefined, // Not in DB schema
		opportunityIdeas: insightData.opportunity_ideas,
		confidence: insightData.confidence,
		createdAt: insightData.created_at,
		relatedTags: [], // Will be populated if needed
		contradictions: insightData.contradictions,
		interview_id: insightData.interview_id,
		underlyingMotivation: insightData.motivation,
	}

	// Optionally fetch related interview data if needed
	let interviewData = null
	if (insight.interview_id) {
		const { data: interview } = await db
			.from("interviews")
			.select("*")
			.eq("id", insight.interview_id)
			.single()
		
		interviewData = interview
	}

	consola.success(`Successfully loaded insight: ${insight.name}`)
	return { insight, interviewData }
}

export default function InsightDetailPage() {
	const { insight, interviewData } = useLoaderData<typeof loader>()

	return (
		<div className="mx-auto max-w-[1440px] px-4 py-4">
			<div className="mb-6 flex items-center justify-between">
				<div>
					<div className="flex items-center gap-2">
						<Link to="/insights" className="text-blue-600 hover:text-blue-800">
							Insights
						</Link>
						<span className="text-gray-500">/</span>
						<h1 className="font-bold text-2xl">{insight.name}</h1>
					</div>
				</div>
				<Link to="/insights" className="text-blue-600 hover:text-blue-800">
					Back to Insights
				</Link>
			</div>

			<div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
				<div className="lg:col-span-2">
					<InsightCardV2 insight={insight} expanded={true} />
				</div>
				<div className="lg:col-span-1">
					<div className="rounded-lg bg-white p-6 shadow-sm dark:bg-gray-900">
						<h2 className="mb-4 font-semibold text-xl">Related Information</h2>
						
						{interviewData && (
							<div className="mb-4">
								<h3 className="mb-2 font-medium">Source Interview</h3>
								<Link 
									to={`/interviews/${interviewData.id}`}
									className="text-blue-600 hover:text-blue-800"
								>
									{interviewData.participant_pseudonym || "Anonymous"} - {
										interviewData.interview_date?.split("T")[0] || 
										interviewData.created_at?.split("T")[0] || ""
									}
								</Link>
							</div>
						)}

						{insight.category && (
							<div className="mb-4">
								<h3 className="mb-2 font-medium">Category</h3>
								<span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 font-medium text-xs text-blue-800 dark:bg-blue-900 dark:text-blue-300">
									{insight.category}
								</span>
							</div>
						)}

						{insight.journeyStage && (
							<div className="mb-4">
								<h3 className="mb-2 font-medium">Journey Stage</h3>
								<span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 font-medium text-xs text-purple-800 dark:bg-purple-900 dark:text-purple-300">
									{insight.journeyStage}
								</span>
							</div>
						)}

						<div className="mb-4">
							<h3 className="mb-2 font-medium">Impact</h3>
							<div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
								<div 
									className="h-2 rounded-full bg-blue-600" 
									style={{ width: `${(insight.impact || 0) * 10}%` }}
								></div>
							</div>
							<div className="mt-1 text-right text-sm text-gray-500">
								{insight.impact || 0}/10
							</div>
						</div>

						<div className="mb-4">
							<h3 className="mb-2 font-medium">Novelty</h3>
							<div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
								<div 
									className="h-2 rounded-full bg-purple-600" 
									style={{ width: `${(insight.novelty || 0) * 10}%` }}
								></div>
							</div>
							<div className="mt-1 text-right text-sm text-gray-500">
								{insight.novelty || 0}/10
							</div>
						</div>

						<div className="mb-4">
							<h3 className="mb-2 font-medium">Confidence</h3>
							<div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
								<div 
									className="h-2 rounded-full bg-green-600" 
									style={{ width: `${(insight.confidence || 0) * 10}%` }}
								></div>
							</div>
							<div className="mt-1 text-right text-sm text-gray-500">
								{insight.confidence || 0}/10
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
