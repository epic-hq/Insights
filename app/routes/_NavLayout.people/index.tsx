import consola from "consola"
import { PlusIcon, UserIcon } from "lucide-react"
import type { MetaFunction } from "react-router"
import { Link, type LoaderFunctionArgs, useLoaderData } from "react-router-dom"
import { Avatar, AvatarFallback } from "~/components/ui/avatar"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { getServerClient } from "~/lib/supabase/server"

export const meta: MetaFunction = () => {
	return [
		{ title: "People - Insights" },
		{ name: "description", content: "View and manage all people in your research" },
	]
}

export async function loader({ request }: LoaderFunctionArgs) {
	const { client: supabase } = getServerClient(request)
	const { data: jwt } = await supabase.auth.getClaims()
	const accountId = jwt?.claims.sub

	if (!accountId) {
		throw new Response("Unauthorized", { status: 401 })
	}
	consola.log("Account ID:", accountId)

	// Fetch people with personas via junction table
	const { data: peopleData, error: peopleError } = await supabase
		.from("people")
		.select(`
			*,
			people_personas!inner(
				confidence_score,
				source,
				assigned_at,
				personas(
					id,
					name,
					description,
					color_hex
				)
			)
		`)
		.eq("account_id", accountId)
		.order("created_at", { ascending: false })

	if (peopleError) {
		throw new Response(`Error fetching people: ${peopleError.message}`, { status: 500 })
	}

	// Count interviews per person
	const { data: interviewCounts } = await supabase
		.from("interview_people")
		.select("person_id")

	const interviewCountMap = new Map<string, number>()
	if (interviewCounts) {
		interviewCounts.forEach((ip) => {
			const current = interviewCountMap.get(ip.person_id) || 0
			interviewCountMap.set(ip.person_id, current + 1)
		})
	}

	// Fetch insights and map via interviews
	const { data: insights } = await supabase.from("insights").select("interview_id")
	const { data: interviewPeople } = await supabase.from("interview_people").select("interview_id, person_id")
	const interviewToPerson = new Map<string, string>()
	interviewPeople?.forEach((ip) => interviewToPerson.set(ip.interview_id, ip.person_id))

	const insightCountMap = new Map<string, number>()
	insights?.forEach((insight) => {
		const personId = insight.interview_id ? interviewToPerson.get(insight.interview_id) : undefined
		if (personId) {
			insightCountMap.set(personId, (insightCountMap.get(personId) || 0) + 1)
		}
	})

	// Transform data for UI
	const people = (peopleData || []).map((person: any) => {
		const primaryPersona = person.people_personas?.[0]?.personas || null
		const allPersonas =
			person.people_personas?.map((pp: any) => ({
				...pp.personas,
				confidence_score: pp.confidence_score,
				source: pp.source,
				assigned_at: pp.assigned_at,
			})) || []

		return {
			...person,
			interview_count: interviewCountMap.get(person.id) || 0,
			insight_count: insightCountMap.get(person.id) || 0,
			last_interview_date: null,
			personas: primaryPersona,
			all_personas: allPersonas,
			persona_count: allPersonas.length,
		}
	})

	return {
		people,
	}
}

export default function PeopleIndex() {
	const { people } = useLoaderData<typeof loader>()

	return (
		<div className="mx-auto w-full max-w-7xl px-4 py-8">
			{/* Header */}
			<div className="mb-8 flex items-center justify-between">
				<div>
					<h1 className="font-bold text-3xl">People</h1>
					<p className="mt-2 text-gray-600">Manage and view insights from all research participants</p>
				</div>
				<Button asChild>
					<Link to="/people/new">
						<PlusIcon className="mr-2 h-4 w-4" />
						Add Person
					</Link>
				</Button>
			</div>

			{/* Stats Cards */}
			<div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<h2 className="font-medium text-sm">Total People</h2>
						<UserIcon className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="font-bold text-2xl">{people.length}</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<h2 className="font-medium text-sm">Active Participants</h2>
						<UserIcon className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="font-bold text-2xl">{people.length}</div>
						<p className="text-muted-foreground text-xs">
							{people.length > 0 ? Math.round((people.length / people.length) * 100) : 0}% of total
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="font-medium text-sm">Total Interviews</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="font-bold text-2xl">{0}</div>
						<p className="text-muted-foreground text-xs">
							{people.length > 0 ? (0 / people.length).toFixed(1) : 0} avg per person
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="font-medium text-sm">Total Insights</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="font-bold text-2xl">{0}</div>
						<p className="text-muted-foreground text-xs">
							{people.length > 0 ? (0 / people.length).toFixed(1) : 0} avg per interview
						</p>
					</CardContent>
				</Card>
			</div>

			{/* People Grid */}
			{people.length === 0 ? (
				<Card>
					<CardContent className="flex flex-col items-center justify-center py-16">
						<UserIcon className="mb-4 h-12 w-12 text-gray-400" />
						<h3 className="mb-2 font-semibold text-lg">No people found</h3>
						<p className="mb-6 text-center text-gray-600">Get started by adding your first research participant.</p>
						<Button asChild>
							<Link to="/people/new">
								<PlusIcon className="mr-2 h-4 w-4" />
								Add Person
							</Link>
						</Button>
					</CardContent>
				</Card>
			) : (
				<div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
					{people.map((person) => (
						<Card key={person.id} className="transition hover:shadow-md">
							<CardHeader className="pb-4">
								<div className="flex items-start justify-between">
									<div className="flex items-center space-x-3">
										<Avatar className="h-12 w-12">
											<AvatarFallback>
												{person.name
													.split(" ")
													.map((n: string) => n[0])
													.join("")
													.toUpperCase()}
											</AvatarFallback>
										</Avatar>
										<div>
											<CardTitle className="text-lg">
												<Link to={`/people/${person.id}`} className="hover:text-blue-600">
													{person.name}
												</Link>
											</CardTitle>
											{person.segment && (
												<Badge variant="outline" className="mt-1 text-xs">
													{person.segment}
												</Badge>
											)}
										</div>
									</div>
								</div>
							</CardHeader>

							<CardContent className="pt-0">
								{person.description && <p className="line-clamp-2 text-gray-600 text-sm">{person.description}</p>}

								<div className="grid grid-cols-2 gap-4 text-sm">
									<div>
										<span className="font-medium text-gray-700">Interviews</span>
										<p className="text-gray-900">{person.interview_count}</p>
									</div>
									<div>
										<span className="font-medium text-gray-700">Insights</span>
										<p className="text-gray-900">{person.insight_count}</p>
									</div>
								</div>

								{person.last_interview_date && (
									<div className="mt-4 text-gray-500 text-xs">
										Last interview: {new Date(person.last_interview_date).toLocaleDateString()}
									</div>
								)}

								<div className="mt-4 flex space-x-2">
									<Button variant="outline" size="sm" asChild className="flex-1">
										<Link to={`/people/${person.id}`}>View Details</Link>
									</Button>
									<Button variant="ghost" size="sm" asChild>
										<Link to={`/interviews?participant=${person.name}`}>View Interviews</Link>
									</Button>
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			)}
		</div>
	)
}
