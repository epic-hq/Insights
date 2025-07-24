import { type MetaFunction, useLoaderData } from "react-router"
import { Link } from "react-router-dom"
import PersonaCard from "~/components/dashboard/PersonaCard"
import type { Database } from "~/../supabase/types"
import { getServerClient } from "~/lib/supabase/server"

export const meta: MetaFunction = () => {
	return [
		{ title: "Personas | Insights" },
		{ name: "description", content: "User personas based on research insights" },
	]
}

export async function loader({ request }: { request: Request }) {
	const { client: supabase } = getServerClient(request)
	const { data: jwt } = await supabase.auth.getClaims()
	const accountId = jwt?.claims.sub

	// Use Supabase types directly like interviews pattern
	type PersonaRow = Database["public"]["Tables"]["personas"]["Row"]

	// Fetch personas from database with account filtering for RLS
	const { data: personasData, error: personasError } = await supabase
		.from("personas")
		.select("*")
		.eq("account_id", accountId)
		.order("created_at", { ascending: false })

	if (personasError) {
		throw new Response(`Error fetching personas: ${personasError.message}`, { status: 500 })
	}

	const personas: PersonaRow[] = personasData || []

	// Fetch interviews to count per persona with account filtering
	const { data: interviewsData, error: interviewsError } = await supabase
		.from("interviews")
		.select("segment")
		.eq("account_id", accountId)

	if (interviewsError) {
		throw new Response(`Error fetching interviews: ${interviewsError.message}`, { status: 500 })
	}

	// Count interviews per persona segment
	const segmentCounts = new Map<string, number>()
	interviewsData?.forEach((interview: { segment: string | null }) => {
		if (interview.segment) {
			const count = segmentCounts.get(interview.segment) || 0
			segmentCounts.set(interview.segment, count + 1)
		}
	})

	// Use total interviews with segments for percentage calculation
	// This ensures percentages are based on interviews that are actually categorized
	const totalCategorizedInterviews = Array.from(segmentCounts.values()).reduce((sum, count) => sum + count, 0)

	// Calculate stats
	const stats = {
		total: personas.length,
		totalInterviews: interviewsData?.length || 0,
		categorizedInterviews: totalCategorizedInterviews,
		avgInterviewsPerPersona: personas.length > 0 ? Math.round((interviewsData?.length || 0) / personas.length) : 0,
	}

	// Transform personas with calculated data
	const personasWithStats = personas.map((persona) => {
		const interviewCount = segmentCounts.get(persona.name) || 0
		// Calculate percentage based on categorized interviews only
		// This ensures the percentages add up to 100% for personas that have interviews
		const percentage = totalCategorizedInterviews > 0 
			? Math.round((interviewCount / totalCategorizedInterviews) * 100) 
			: 0

		return {
			...persona,
			percentage,
			count: interviewCount,
			color: persona.color_hex || "#6b7280",
		}
	})

	// Sort personas by interview count (descending) for better display
	const sortedPersonas = personasWithStats.sort((a, b) => b.count - a.count)

	return { personas: sortedPersonas, stats }
}

export default function Personas() {
	const { personas = [], stats } = useLoaderData<typeof loader>() || {}

	return (
		<div className="mx-auto max-w-7xl px-4 py-6">
			{/* Header */}
			<div className="mb-6">
				<h1 className="font-bold text-3xl text-gray-900">Personas</h1>
				<p className="mt-2 text-gray-600">User personas based on research insights</p>
			</div>

			{/* Stats Cards */}
			<div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
				<div className="rounded-lg bg-white p-4 shadow-sm">
					<p className="text-gray-500 text-sm">Total Personas</p>
					<p className="font-bold text-2xl">{stats?.total || 0}</p>
				</div>
				<div className="rounded-lg bg-white p-4 shadow-sm">
					<p className="text-gray-500 text-sm">Total Interviews</p>
					<p className="font-bold text-2xl">{stats?.totalInterviews || 0}</p>
				</div>
				<div className="rounded-lg bg-white p-4 shadow-sm">
					<p className="text-gray-500 text-sm">Categorized Interviews</p>
					<p className="font-bold text-2xl">{stats?.categorizedInterviews || 0}</p>
				</div>
				<div className="rounded-lg bg-white p-4 shadow-sm">
					<p className="text-gray-500 text-sm">Avg. per Persona</p>
					<p className="font-bold text-2xl">{stats?.avgInterviewsPerPersona || 0}</p>
				</div>
			</div>

			{/* Persona Distribution Chart */}
			{personas.length > 0 && (
				<div className="mb-6 rounded-lg bg-white p-6 shadow-sm">
					<h2 className="mb-4 font-semibold text-xl">Persona Distribution</h2>
					<div className="flex flex-wrap gap-4">
						{personas.map((persona) => (
							<div key={persona.name} className="flex items-center gap-2">
								<div className="h-4 w-4 rounded-full" style={{ backgroundColor: persona.color }} />
								<span>
									{persona.name}: {persona.percentage}%
								</span>
							</div>
						))}
					</div>
					<div className="mt-4 flex h-8 w-full overflow-hidden rounded-full bg-gray-200">
						{personas.map((persona) => (
							<div
								key={persona.name}
								className="h-full"
								style={{
									backgroundColor: persona.color,
									width: `${persona.percentage}%`,
								}}
							/>
						))}
				</div>
			</div>
			)}

			{/* Personas Grid */}
			{personas.length > 0 ? (
				<div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
					{personas.map((persona) => (
						<Link key={persona.id} to={`/personas/${persona.id}`} className="block">
							<div className="rounded-lg bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
								<PersonaCard
									name={persona.name}
									percentage={persona.percentage || 0}
									count={persona.count || 0}
									color={persona.color || "#6b7280"}
								/>
								<div className="mt-4 border-gray-200 border-t pt-4">
									<p className="text-gray-500 text-sm">
										Click to view detailed insights about this persona
									</p>
								</div>
							</div>
						</Link>
					))}
				</div>
			) : (
				<div className="rounded-lg bg-white p-12 text-center shadow-sm">
					<h3 className="mb-2 font-medium text-gray-900 text-lg">No personas found</h3>
					<p className="text-gray-500">Create your first persona to start organizing your research insights.</p>
				</div>
			)}
		</div>
	)
}
