import type { MetaFunction } from "react-router"
import { Link, type LoaderFunctionArgs, useLoaderData } from "react-router-dom"
import { Avatar, AvatarFallback } from "~/components/ui/avatar"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { getServerClient } from "~/lib/supabase/server"

export const meta: MetaFunction = ({ params }) => {
	return [
		{ title: `${params.personId || "Person"} - Insights` },
		{ name: "description", content: "View details for person" },
	]
}

type PersonDetail = {
	id: string
	name: string
	segment: string | null
	description: string | null
	contact_info: string | null
	created_at: string
	updated_at: string
	personas: {
		id: string
		name: string
		description: string | null
		color_hex: string | null
	} | null
}

type InterviewSummary = {
	id: string
	title: string
	interview_date: string | null
	created_at: string
	status: string
	duration_min: number | null
	insight_count: number
}

export async function loader({ request, params }: LoaderFunctionArgs) {
	const { client: supabase } = getServerClient(request)
	const { data: jwt } = await supabase.auth.getClaims()
	const accountId = jwt?.claims.sub
	const personId = params.personId

	if (!accountId) {
		throw new Response("Unauthorized", { status: 401 })
	}

	if (!personId) {
		throw new Response("Person ID required", { status: 400 })
	}

	try {
		// First, try simple person fetch without junction table
		const { data: person, error: personError } = await supabase
			.from("people")
			.select("*")
			.eq("id", personId)
			.eq("account_id", accountId)
			.single()

		if (personError) {
			console.error("Person fetch error:", personError)
			throw new Response(`Error fetching person: ${personError.message}`, { status: 500 })
		}

		if (!person) {
			throw new Response("Person not found", { status: 404 })
		}

		// Try to fetch personas via junction table (with error handling)
		let personaData = null
		try {
			const { data: personas, error: personaError } = await supabase
				.from("people_personas")
				.select(`
					confidence_score,
					source,
					assigned_at,
					personas(
						id,
						name,
						description,
						color_hex
					)
				`)
				.eq("person_id", personId)

			if (!personaError && personas) {
				personaData = personas
			} else {
				console.warn("Persona fetch error (non-fatal):", personaError)
			}
		} catch (err) {
			console.warn("Persona fetch failed (non-fatal):", err)
		}

		// Try to fetch interviews (with error handling)
		let interviews: InterviewSummary[] = []
		try {
			const { data: interviewData, error: interviewError } = await supabase
				.from("interview_people")
				.select("role, interviews(id, title, interview_date, created_at, status, duration_min)")
				.eq("person_id", personId)
				.order("created_at", { ascending: false, referencedTable: "interviews" })

			if (!interviewError && interviewData) {
				interviews = interviewData
					.map((ip: any) => ip.interviews)
					.filter(Boolean)
					.map((interview: any) => ({
						...interview,
						insight_count: 0,
					}))
			} else {
				console.warn("Interview fetch error (non-fatal):", interviewError)
			}
		} catch (err) {
			console.warn("Interview fetch failed (non-fatal):", err)
		}

		// Map primary persona for backward-compat UI
		const primaryPersona = personaData?.[0]?.personas ?? null
		const transformedPerson = {
			...person,
			personas: primaryPersona,
		} as PersonDetail

		return {
			person: transformedPerson,
			interviews,
			totalInsights: 0,
		}
	} catch (error) {
		console.error("Loader error:", error)
		throw new Response(`Server error: ${error instanceof Error ? error.message : 'Unknown error'}`, { status: 500 })
	}
}

export default function PersonDetail() {
	const { person, interviews, totalInsights } = useLoaderData<typeof loader>()

	return (
		<div className="mx-auto w-full max-w-7xl px-4 py-8">
			{/* Header */}
			<div className="mb-8 flex items-center justify-between">
				<div className="flex items-center space-x-4">
					<Avatar className="h-16 w-16">
						<AvatarFallback className="text-lg">
							{person.name
								.split(" ")
								.map((n: string) => n[0])
								.join("")
								.toUpperCase()}
						</AvatarFallback>
					</Avatar>
					<div>
						<h1 className="font-bold text-3xl">{person.name}</h1>
						<div className="mt-2 flex items-center space-x-2">
							{person.personas && (
								<Badge
									style={{
										backgroundColor: person.personas.color_hex || "#3b82f6",
										color: "white",
									}}
								>
									{person.personas.name}
								</Badge>
							)}
							{person.segment && (
								<Badge variant="outline">{person.segment}</Badge>
							)}
						</div>
					</div>
				</div>
				<div className="flex space-x-2">
					<Button variant="outline" asChild>
						<Link to="/people">← Back to People</Link>
					</Button>
					<Button asChild>
						<Link to={`/people/${person.id}/edit`}>Edit</Link>
					</Button>
				</div>
			</div>

			<div className="grid gap-8 lg:grid-cols-3">
				{/* Main Content */}
				<div className="space-y-8 lg:col-span-2">
					{/* Person Details */}
					<Card>
						<CardHeader>
							<CardTitle>Details</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							{person.description && (
								<div>
									<h3 className="font-medium text-gray-700 text-sm">Description</h3>
									<p className="mt-1 text-gray-900">{person.description}</p>
								</div>
							)}
							{person.contact_info && (
								<div>
									<h3 className="font-medium text-gray-700 text-sm">Contact Information</h3>
									<p className="mt-1 text-gray-900">{person.contact_info}</p>
								</div>
							)}
							{person.personas?.description && (
								<div>
									<h3 className="font-medium text-gray-700 text-sm">Persona Description</h3>
									<p className="mt-1 text-gray-900">{person.personas.description}</p>
								</div>
							)}
							<div className="grid grid-cols-2 gap-4 text-sm">
								<div>
									<h3 className="font-medium text-gray-700">Created</h3>
									<p className="text-gray-900">{new Date(person.created_at).toLocaleDateString()}</p>
								</div>
								<div>
									<h3 className="font-medium text-gray-700">Last Updated</h3>
									<p className="text-gray-900">{new Date(person.updated_at).toLocaleDateString()}</p>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Interviews */}
					<Card>
						<CardHeader>
							<CardTitle>Interviews ({interviews.length})</CardTitle>
						</CardHeader>
						<CardContent>
							{interviews.length === 0 ? (
								<div className="py-8 text-center text-gray-500">
									<p>No interviews found for this person.</p>
								</div>
							) : (
								<div className="space-y-4">
									{interviews.map((interview: any) => (
										<div
											key={interview.id}
											className="flex items-center justify-between rounded-lg border p-4 transition hover:bg-gray-50"
										>
											<div>
												<div className="flex items-center space-x-2">
													<Link
														to={`/interviews/${interview.id}`}
														className="font-medium text-gray-900 hover:text-blue-600"
													>
														{interview.title || "Untitled Interview"}
													</Link>
													<Badge variant="outline" className="text-xs">
														{interview.status}
													</Badge>
												</div>
												<div className="mt-1 flex items-center space-x-4 text-gray-500 text-sm">
													{interview.interview_date && (
														<span>{new Date(interview.interview_date).toLocaleDateString()}</span>
													)}
													{interview.duration_min && <span>{interview.duration_min} min</span>}
													<span>{interview.insight_count} insights</span>
												</div>
											</div>
											<Button variant="outline" size="sm" asChild>
												<Link to={`/interviews/${interview.id}`}>View</Link>
											</Button>
										</div>
									))}
								</div>
							)}
						</CardContent>
					</Card>
				</div>

				{/* Sidebar */}
				<div className="space-y-6">
					{/* Stats */}
					<Card>
						<CardHeader>
							<CardTitle className="text-base">Statistics</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="flex justify-between">
								<span className="text-gray-600 text-sm">Total Interviews</span>
								<span className="font-medium">{interviews.length}</span>
							</div>
							<div className="flex justify-between">
								<span className="text-gray-600 text-sm">Total Insights</span>
								<span className="font-medium">{totalInsights}</span>
							</div>
							{interviews.length > 0 && (
								<div className="flex justify-between">
									<span className="text-gray-600 text-sm">Avg Insights/Interview</span>
									<span className="font-medium">{totalInsights > 0 ? (totalInsights / interviews.length).toFixed(1) : '0.0'}</span>
								</div>
							)}
						</CardContent>
					</Card>

					{/* Quick Actions */}
					<Card>
						<CardHeader>
							<CardTitle className="text-base">Quick Actions</CardTitle>
						</CardHeader>
						<CardContent className="space-y-2">
							<Button variant="outline" size="sm" className="w-full" asChild>
								<Link to={`/people/${person.id}/edit`}>Edit Person</Link>
							</Button>
							<Button variant="outline" size="sm" className="w-full" asChild>
								<Link to={`/interviews?participant=${person.name}`}>View All Interviews</Link>
							</Button>
							{person.personas && (
								<Button variant="outline" size="sm" className="w-full" asChild>
									<Link to={`/personas/${person.personas.id}`}>View Persona</Link>
								</Button>
							)}
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	)
}
