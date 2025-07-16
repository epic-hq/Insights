import consola from "consola"
import { type MetaFunction, useLoaderData } from "react-router"
import InsightCardV2 from "~/components/insights/InsightCardV2"
import type { InsightView } from "~/types"
import { db } from "~/utils/supabase.server"

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
	const { data: insightData, error: insightError } = await db.from("insights").select("*").eq("id", insightId).single()

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
		const { data: interview } = await db.from("interviews").select("*").eq("id", insight.interview_id).single()

		interviewData = interview
	}

	consola.success(`Successfully loaded insight: ${insight.name}`)
	return { insight, interviewData }
}

export default function InsightDetailPage() {
	const { insight, interviewData } = useLoaderData<typeof loader>()
	consola.log("InsightDetailPage", insight)

	return (
		<div className="mx-auto max-w-[1440px] px-4 py-4">
			{/* <div className="p-2">
				<h1 className="font-bold text-2xl">{insight.name}</h1>
			</div> */}

			<div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
				<div className="lg:col-span-2">
					<InsightCardV2 insight={insight} />
				</div>
			</div>
		</div>
	)
}
