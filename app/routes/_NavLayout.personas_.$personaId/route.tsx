import { type MetaFunction, useLoaderData } from "react-router"
import InsightCardGrid from "~/components/insights/InsightCardGrid"
import InsightCardV2 from "~/components/insights/InsightCardV2"
import PersonaDetail from "~/components/personas/PersonaDetail"
import { db } from "~/lib/supabase/server"
import type { InsightView, Interview, PersonaView } from "~/types"

export const meta: MetaFunction = () => {
	return [{ title: "Persona | Insights" }, { name: "description", content: "Insights related to this persona" }]
}

export async function loader({ params }: { params: { personaId: string } }) {
	const personaId = params.personaId

	// Fetch the current persona directly by ID
	const { data: currentPersonaData, error: personaError } = await db
		.from("personas")
		.select("*")
		.eq("id", personaId)
		.single()

	if (personaError || !currentPersonaData) {
		throw new Response(`Persona with ID '${personaId}' not found`, { status: 404 })
	}

	// Fetch all personas for context
	const { data: personasData } = await db.from("personas").select("*")
	if (!personasData) {
		throw new Response("No personas found", { status: 404 })
	}

	// Transform personas data to PersonaView
	const personas: PersonaView[] = personasData.map((p) => {
		return {
			...p,
			percentage: p.percentage || 0,
			count: 0, // Will be updated with interview count
			color: p.color_hex || "#6b7280",
			href: `/personas/${p.id}`,
		}
	})

	// Fetch interviews from database
	const { data: interviewsData } = await db.from("interviews").select("*")
	const interviews: Interview[] = interviewsData || []

	// Count interviews per persona and update the count
	interviews.forEach((interview) => {
		if (interview.segment) {
			const matchingPersona = personas.find((p) => p.name === interview.segment)
			if (matchingPersona) {
				matchingPersona.count = (matchingPersona.count || 0) + 1
			}
		}
	})

	// Find the current persona in the transformed list
	const currentPersona = personas.find((p) => p.id === personaId)

	if (!currentPersona) {
		throw new Response(`Persona '${personaId}' not found`, { status: 404 })
	}

	// Fetch insights related to this persona
	const { data: insightsData } = await db
		.from("insights")
		.select("*")
		.eq("category", currentPersonaData.name)
		.order("created_at", { ascending: false })

	// Transform insights data to InsightView
	const insights: InsightView[] = (insightsData || []).map((insight) => ({
		id: insight.id,
		name: insight.name,
		title: insight.name,
		category: insight.category,
		journeyStage: insight.journey_stage || undefined, // Convert null to undefined
		impact: insight.impact,
		novelty: insight.novelty,
		jtbd: insight.jtbd,
		pain: insight.pain,
		desiredOutcome: insight.desired_outcome,
		description: undefined, // Not in DB schema
		evidence: undefined, // Not in DB schema
		opportunityIdeas: insight.opportunity_ideas,
		confidence: insight.confidence,
		createdAt: insight.created_at,
		relatedTags: [], // Will be populated if needed
		contradictions: insight.contradictions,
		interview_id: insight.interview_id,
		underlyingMotivation: insight.motivation,
	}))

	// Fetch tags for insights if any
	if (insights.length > 0) {
		const insightIds = insights.map((i) => i.id).filter(Boolean)
		if (insightIds.length > 0) {
			const { data: tagsData } = await db.from("insight_tags").select("*").in("insight_id", insightIds)

			// Add tags to insights
			if (tagsData) {
				for (const tag of tagsData) {
					const insight = insights.find((i) => i.id === tag.insight_id)
					if (insight) {
						if (!insight.relatedTags) {
							insight.relatedTags = []
						}
						insight.relatedTags.push(tag.tag)
					}
				}
			}
		}
	}

	return {
		persona: currentPersona,
		personas,
		interviews,
		insights,
	}
}

export default function PersonaDetailRoute() {
	const { persona, interviews, insights } = useLoaderData<typeof loader>()

	return (
		<div className="mx-auto max-w-[1440px] px-4 py-4">
			{/* Use the centralized PersonaDetail component */}
			<PersonaDetail personas={[persona]} interviews={interviews} />

			{/* Display related insights */}
			<div className="mb-6">
				<h2 className="mb-4 font-semibold text-xl">Related Insights</h2>
				<InsightCardGrid>
					{insights.map((insight) => (
						<InsightCardV2 key={insight.id} insight={insight} />
					))}
				</InsightCardGrid>
			</div>
		</div>
	)
}
