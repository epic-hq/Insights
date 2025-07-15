import consola from "consola"
import { type MetaFunction, useLoaderData } from "react-router"
import { Link } from "react-router-dom"
import OpportunityDetail from "~/components/opportunities/OpportunityDetail"
import type { OpportunityView } from "~/types"
import { db } from "~/utils/supabase.server"

export const meta: MetaFunction = ({ params }) => {
	return [
		{ title: `Opportunity ${params.opportunityId || ""} | Insights` },
		{ name: "description", content: "Opportunity details" },
	]
}

export async function loader({ params }: { params: { opportunityId: string } }) {
	const opportunityId = params.opportunityId
	consola.info(`Loading opportunity with ID: ${opportunityId}`)

	// Fetch opportunity data from database
	const { data: opportunityData, error: opportunityError } = await db
		.from("opportunities")
		.select("*")
		.eq("id", opportunityId)
		.single()

	if (opportunityError) {
		consola.error(`Error fetching opportunity: ${opportunityError.message}`)
		throw new Response(`Error fetching opportunity: ${opportunityError.message}`, { status: 500 })
	}

	if (!opportunityData) {
		consola.error(`Opportunity not found: ${opportunityId}`)
		throw new Response(`Opportunity not found: ${opportunityId}`, { status: 404 })
	}

	// Define a type that extends the base opportunity type with optional fields needed for OpportunityView
	type ExtendedOpportunity = typeof opportunityData & {
		description?: string
		impact?: number
		effort?: number
		confidence?: number
		priority?: string
		tags?: string[]
		assignee?: string
		due_date?: string
	}

	// Safely cast to the extended type
	const extendedOpportunity = opportunityData as ExtendedOpportunity

	// Transform opportunity data to OpportunityView
	const opportunity: OpportunityView = {
		...opportunityData,
		// Add any missing fields with default values
		title: opportunityData.title || "",
		name: opportunityData.title || "", // Use title as name for display purposes
		// Handle fields that may not exist in the base type but are in OpportunityView
		description: extendedOpportunity.description || undefined,
		impact: extendedOpportunity.impact || undefined,
		effort: extendedOpportunity.effort || undefined,
		confidence: extendedOpportunity.confidence || undefined,
		status: opportunityData.kanban_status || undefined,
		priority:
			extendedOpportunity.priority ||
			(extendedOpportunity.impact && extendedOpportunity.impact > 7
				? "high"
				: extendedOpportunity.impact && extendedOpportunity.impact > 4
					? "medium"
					: "low"),
		tags: extendedOpportunity.tags || undefined,
		insights: opportunityData.related_insight_ids || undefined,
		owner: opportunityData.owner_id || undefined,
		assignee: extendedOpportunity.assignee || undefined,
		due_date: extendedOpportunity.due_date || undefined,
	}

	consola.success(`Successfully loaded opportunity: ${opportunity.title}`)
	return { opportunity }
}

export default function OpportunityDetailPage() {
	const { opportunity } = useLoaderData<typeof loader>()

	return (
		<div className="mx-auto max-w-[1440px] px-4 py-4">
			<div className="mb-6 flex items-center justify-between">
				<div>
					<div className="flex items-center gap-2">
						<Link to="/opportunities" className="text-blue-600 hover:text-blue-800">
							Opportunities
						</Link>
						<span className="text-gray-500">/</span>
						<h1 className="font-bold text-2xl">{opportunity.name}</h1>
					</div>
				</div>
				<Link to="/opportunities" className="text-blue-600 hover:text-blue-800">
					Back to Opportunities
				</Link>
			</div>

			<OpportunityDetail opportunity={opportunity} />
		</div>
	)
}
