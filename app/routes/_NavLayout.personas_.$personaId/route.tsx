import { type MetaFunction, useLoaderData } from "react-router"
import { Link } from "react-router-dom"
import InsightCardGrid from "~/components/insights/InsightCardGrid"
import InsightCardV2 from "~/components/insights/InsightCardV2"
import type { Database } from "~/../supabase/types"
import { getServerClient } from "~/lib/supabase/server"

export const meta: MetaFunction = ({ params }) => {
	return [
		{ title: `Persona ${params.personaId || ""} | Insights` },
		{ name: "description", content: "Insights related to this persona" },
	]
}

export async function loader({ request, params }: { request: Request; params: { personaId: string } }) {
	const { client: supabase } = getServerClient(request)
	const { data: jwt } = await supabase.auth.getClaims()
	const accountId = jwt?.claims.sub

	const personaId = params.personaId

	// Use Supabase types directly like interviews pattern
	type PersonaRow = Database["public"]["Tables"]["personas"]["Row"]
	type InterviewRow = Database["public"]["Tables"]["interviews"]["Row"]
	type InsightRow = Database["public"]["Tables"]["insights"]["Row"]

	// Fetch the current persona directly by ID with account filtering for RLS
	const { data: currentPersonaData, error: personaError } = await supabase
		.from("personas")
		.select("*")
		.eq("id", personaId)
		.eq("account_id", accountId)
		.single()

	if (personaError) {
		throw new Response(`Error fetching persona: ${personaError.message}`, { status: 500 })
	}

	if (!currentPersonaData) {
		throw new Response("Persona not found", { status: 404 })
	}

	const persona: PersonaRow = currentPersonaData

	// Fetch interviews related to this persona with account filtering
	const { data: interviewsData, error: interviewsError } = await supabase
		.from("interviews")
		.select("*")
		.eq("segment", persona.name)
		.eq("account_id", accountId)
		.order("created_at", { ascending: false })

	if (interviewsError) {
		throw new Response(`Error fetching interviews: ${interviewsError.message}`, { status: 500 })
	}

	const interviews: InterviewRow[] = interviewsData || []

	// Fetch insights related to this persona with account filtering
	const { data: insightsData, error: insightsError } = await supabase
		.from("insights")
		.select("*")
		.eq("category", persona.name)
		.eq("account_id", accountId)
		.order("created_at", { ascending: false })

	if (insightsError) {
		throw new Response(`Error fetching insights: ${insightsError.message}`, { status: 500 })
	}

	const insights: InsightRow[] = insightsData || []

	// Get related personas (same account, different persona)
	const { data: relatedPersonas } = await supabase
		.from("personas")
		.select("id, name, color_hex, updated_at")
		.eq("account_id", accountId)
		.neq("id", personaId)
		.limit(5)

	return {
		persona,
		interviews,
		insights,
		relatedPersonas: relatedPersonas || [],
	}
}

export default function PersonaDetailRoute() {
	const { persona, interviews, insights, relatedPersonas } = useLoaderData<typeof loader>()

	if (!persona) {
		return (
			<div className="flex h-64 items-center justify-center">
				<div className="text-center">
					<h1 className="mb-2 font-bold text-2xl text-gray-900">Persona Not Found</h1>
					<p className="text-gray-600">The persona you're looking for doesn't exist or has been removed.</p>
				</div>
			</div>
		)
	}

	return (
		<div className="mx-auto max-w-7xl px-4 py-6">
			<div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
				<div className="lg:col-span-3">
					{/* Persona Header */}
					<div className="mb-6 rounded-lg bg-white p-6 shadow-sm">
						<div className="mb-4 flex items-start justify-between">
							<div className="flex items-center gap-3">
								<div
									className="h-12 w-12 rounded-full"
									style={{ backgroundColor: persona.color_hex || "#6b7280" }}
								/>
								<div>
									<h1 className="font-bold text-3xl text-gray-900">{persona.name || "Untitled Persona"}</h1>
									{persona.description && (
										<p className="mt-1 text-gray-600">{persona.description}</p>
									)}
								</div>
							</div>
						</div>

						<div className="flex items-center gap-6 text-gray-500 text-sm">
							<div>
								<span className="font-medium">Created:</span> {new Date(persona.created_at).toLocaleDateString()}
							</div>
							<div>
								<span className="font-medium">Updated:</span> {new Date(persona.updated_at).toLocaleDateString()}
							</div>
						</div>
					</div>

					{/* Stats Cards */}
					<div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
						<div className="rounded-lg bg-white p-4 shadow-sm">
							<p className="text-gray-500 text-sm">Related Interviews</p>
							<p className="font-bold text-2xl">{interviews.length}</p>
						</div>
						<div className="rounded-lg bg-white p-4 shadow-sm">
							<p className="text-gray-500 text-sm">Related Insights</p>
							<p className="font-bold text-2xl">{insights.length}</p>
						</div>
						<div className="rounded-lg bg-white p-4 shadow-sm">
							<p className="text-gray-500 text-sm">Avg. Insights per Interview</p>
							<p className="font-bold text-2xl">
								{interviews.length > 0 ? (insights.length / interviews.length).toFixed(1) : "0"}
							</p>
						</div>
					</div>

					{/* Interviews Section */}
					<div className="mb-6 rounded-lg bg-white p-6 shadow-sm">
						<h2 className="mb-4 font-semibold text-xl">Related Interviews</h2>
						{interviews.length > 0 ? (
							<div className="space-y-3">
								{interviews.map((interview) => (
									<div
										key={interview.id}
										className="flex items-center justify-between rounded border bg-gray-50 p-3 transition hover:bg-gray-100"
									>
										<div>
											<Link to={`/interviews/${interview.id}`} className="font-medium text-gray-900">
												{interview.title || "Untitled Interview"}
											</Link>
											{interview.participant_pseudonym && (
												<span className="ml-2 text-blue-700">{interview.participant_pseudonym}</span>
											)}
											{interview.interview_date && (
												<span className="ml-2 text-gray-500">
													{new Date(interview.interview_date).toLocaleDateString()}
												</span>
											)}
										</div>
										<Link to={`/interviews/${interview.id}`} className="text-blue-600 text-sm hover:underline">
											View
										</Link>
									</div>
								))}
							</div>
						) : (
							<div className="py-8 text-center text-gray-500">
								<p>No interviews found for this persona.</p>
								<p className="mt-1 text-sm">Upload interviews with this persona segment to see them here.</p>
							</div>
						)}
					</div>

					{/* Related Insights Section */}
					{insights.length > 0 && (
						<div className="rounded-lg bg-white p-6 shadow-sm">
							<div className="mb-4 flex items-center justify-between">
								<h2 className="font-semibold text-xl">Related Insights</h2>
								<Link to="/insights" className="text-blue-600 text-sm hover:text-blue-800">
									View all insights
								</Link>
							</div>
							<InsightCardGrid>
								{insights.slice(0, 6).map((insight) => (
									<InsightCardV2 key={insight.id} insight={insight} />
								))}
							</InsightCardGrid>
						</div>
					)}
				</div>

				{/* Sidebar with Related Personas */}
				<aside className="space-y-4">
					<div className="rounded-lg bg-white p-4 shadow-sm">
						<h2 className="mb-3 font-semibold text-lg">Related Personas</h2>
						{relatedPersonas.length > 0 ? (
							<ul className="space-y-2">
								{relatedPersonas.map((related) => (
									<li key={related.id} className="rounded border bg-gray-50 p-2 transition hover:bg-gray-100">
										<Link to={`/personas/${related.id}`} className="font-medium text-gray-900 text-sm">
											{related.name || "Untitled"}
										</Link>
										<div className="mt-1 flex items-center justify-between text-xs">
											<div
												className="h-3 w-3 rounded-full"
												style={{ backgroundColor: related.color_hex || "#6b7280" }}
											/>
											<span className="text-gray-500">
												{new Date(related.updated_at).toLocaleDateString()}
											</span>
										</div>
									</li>
								))}
							</ul>
						) : (
							<div className="text-gray-400 text-sm italic">No related personas found.</div>
						)}
					</div>
				</aside>
			</div>
		</div>
	)
}
