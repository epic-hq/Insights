import { type MetaFunction, useLoaderData, useSearchParams } from "react-router"
import PersonaCard from "~/components/dashboard/PersonaCard"
import { Button } from "~/components/ui/button"
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

	// Fetch persona distribution data from database view
	const { data: personaDistribution, error: distributionError } = await supabase
		.from("personas")
		.select("*")
		.eq("account_id", accountId)
	// .order("participant_interview_count", { ascending: false })

	if (distributionError) {
		throw new Response(`Error fetching persona distribution: ${distributionError.message}`, { status: 500 })
	}

	// Get calculation method from URL params (default to 'segment')
	const url = new URL(request.url)
	const calculationMethod = url.searchParams.get("method") || "segment"

	// Transform database view data to match expected frontend format
	interface PersonaView {
		id: string
		name: string
		percentage: number
		count: number
		color: string
	}

	const personas: PersonaView[] = (personaDistribution || [])
		.map((row) => {
			// Choose data based on calculation method
			const isParticipantMethod = calculationMethod === "participant"
			const count = isParticipantMethod ? row.participant_interview_count : row.segment_interview_count
			const percentage = isParticipantMethod ? row.participant_percentage : row.segment_percentage

			return {
				id: row.persona_id,
				account_id: row.account_id,
				name: row.persona_name,
				color_hex: row.color_hex,
				description: row.description,
				created_at: row.created_at,
				updated_at: row.updated_at,
				// Pre-calculated values from database view
				percentage: percentage || 0,
				count: count || 0,
				color: row.color_hex || "#6b7280",
			}
		})
		.sort((a, b) => b.count - a.count)

	// Calculate aggregate stats from database view data
	const isParticipantMethod = calculationMethod === "participant"
	const totalInterviews =
		personaDistribution && personaDistribution.length > 0
			? (isParticipantMethod
					? personaDistribution[0].total_participant_interviews
					: personaDistribution[0].total_segment_interviews) || 0
			: 0
	const categorizedInterviews = personas.reduce((sum, p) => sum + (p.count || 0), 0)

	const stats = {
		total: personas.length,
		totalInterviews,
		categorizedInterviews,
		avgInterviewsPerPersona: personas.length > 0 ? Math.round(totalInterviews / personas.length) : 0,
		calculationMethod,
	}

	return { personas, stats }
}

export default function Personas() {
	const { personas, stats } = useLoaderData<typeof loader>()
	const [, setSearchParams] = useSearchParams()

	const handleMethodChange = (method: "participant" | "segment") => {
		setSearchParams((prev: URLSearchParams) => {
			const newParams = new URLSearchParams(prev)
			newParams.set("method", method)
			return newParams
		})
	}

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
					<p className="font-bold text-2xl">{stats.total}</p>
				</div>
				<div className="rounded-lg bg-white p-4 shadow-sm">
					<p className="text-gray-500 text-sm">Total Interviews</p>
					<p className="font-bold text-2xl">{stats.totalInterviews}</p>
				</div>
				<div className="rounded-lg bg-white p-4 shadow-sm">
					<p className="text-gray-500 text-sm">Categorized Interviews</p>
					<p className="font-bold text-2xl">{stats.categorizedInterviews}</p>
				</div>
				<div className="rounded-lg bg-white p-4 shadow-sm">
					<p className="text-gray-500 text-sm">Avg. per Persona</p>
					<p className="font-bold text-2xl">{stats.avgInterviewsPerPersona}</p>
				</div>
			</div>

			{/* Persona Distribution */}
			<div className="mb-6 rounded-lg bg-white p-6 shadow-sm">
				<div className="mb-4 flex items-center justify-between">
					<h2 className="font-semibold text-xl">Persona Distribution</h2>
					<div className="flex space-x-2">
						<Button
							variant={stats.calculationMethod === "participant" ? "default" : "outline"}
							size="sm"
							onClick={() => handleMethodChange("participant")}
						>
							By Participant
						</Button>
						<Button
							variant={stats.calculationMethod === "segment" ? "default" : "outline"}
							size="sm"
							onClick={() => handleMethodChange("segment")}
						>
							By Segment
						</Button>
					</div>
				</div>

				<div className="mb-4 text-gray-600 text-sm">
					{stats.calculationMethod === "participant"
						? "Distribution based on participant names matching persona names"
						: "Distribution based on interview segments matching persona names"}
				</div>

				<div className="mb-4 space-y-2">
					{personas.map((persona) => (
						<div key={persona.id} className="flex items-center space-x-3">
							<div className="h-3 w-3 rounded-full" style={{ backgroundColor: persona.color }} />
							<span className="font-medium text-sm">
								{persona.name}: {persona.percentage}% ({persona.count} interviews)
							</span>
						</div>
					))}
				</div>

				{/* Progress Bar */}
				<div className="h-4 w-full overflow-hidden rounded-lg bg-gray-200">
					<div className="flex h-full">
						{personas.map((persona) => (
							<div
								key={persona.id}
								className="h-full transition-all duration-300"
								style={{
									backgroundColor: persona.color,
									width: `${persona.percentage}%`,
								}}
							/>
						))}
					</div>
				</div>
			</div>

			{/* Persona Cards */}
			<div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
				{personas.map((persona) => (
					<PersonaCard
						key={persona.id}
						name={persona.name}
						percentage={persona.percentage}
						count={persona.count}
						color={persona.color}
					/>
				))}
			</div>
		</div>
	)
}
