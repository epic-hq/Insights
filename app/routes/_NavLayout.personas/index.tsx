import { type MetaFunction, useLoaderData } from "react-router"
import { Link } from "react-router-dom"
import PersonaCard from "~/components/dashboard/PersonaCard"
import { db } from "~/lib/supabase/server"
import type { PersonaView } from "~/types"

export const meta: MetaFunction = () => {
	return [
		{ title: "Personas | Insights" },
		{ name: "description", content: "User personas based on research insights" },
	]
}

export async function loader() {
	// Fetch personas from database
	const { data: personasData } = await db.from("personas").select("*")
	if (!personasData || personasData.length === 0) {
		return { personas: [] }
	}

	// Fetch interviews to count per persona
	const { data: interviewsData } = await db.from("interviews").select("segment")

	// Count interviews per persona segment
	const segmentCounts = new Map<string, number>()
	interviewsData?.forEach((interview: { segment: string | null }) => {
		if (interview.segment) {
			const count = segmentCounts.get(interview.segment) || 0
			segmentCounts.set(interview.segment, count + 1)
		}
	})

	// Calculate total interviews for percentage calculation
	const totalInterviews = Array.from(segmentCounts.values()).reduce((sum, count) => sum + count, 0) || 1

	// Transform personas data to PersonaView
	const personas: PersonaView[] = personasData.map((persona) => {
		const interviewCount = segmentCounts.get(persona.name) || 0
		const percentage = Math.round((interviewCount / totalInterviews) * 100) || persona.percentage || 0

		return {
			...persona,
			percentage: percentage || 0, // Ensure percentage is never null
			count: interviewCount,
			color: persona.color_hex || "#6b7280",
			// Use database ID for navigation instead of slug
			href: `/personas/${persona.id}`,
		}
	})

	return { personas }
}

export default function Personas() {
	const { personas = [] } = useLoaderData<typeof loader>() || {}

	return (
		<div className="mx-auto max-w-[1440px] px-4 py-4">
			<div className="mb-6 rounded-lg bg-white p-6 shadow-sm dark:bg-gray-900">
				<h2 className="mb-4 font-semibold text-xl">Persona Distribution</h2>
				<div className="flex flex-wrap gap-4">
					{personas.map((persona: PersonaView) => (
						<div key={persona.name} className="flex items-center gap-2">
							<div className="h-4 w-4 rounded-full" style={{ backgroundColor: persona.color }} />
							<span>
								{persona.name}: {persona.percentage}%
							</span>
						</div>
					))}
				</div>
				<div className="mt-4 flex h-8 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
					{personas.map((persona: PersonaView) => (
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

			<div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
				{personas.map((persona: PersonaView) => (
					<Link key={persona.id} to={`/personas/${persona.id}`} className="block">
						<div className="rounded-lg bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:bg-gray-900">
							<PersonaCard
								name={persona.name}
								percentage={persona?.percentage * 100 || 0}
								count={persona.count || 0}
								color={persona.color || "#6b7280"}
							/>
							<div className="mt-4 border-gray-200 border-t pt-4 dark:border-gray-700">
								<p className="text-gray-500 text-sm dark:text-gray-400">
									Click to view detailed insights about this persona
								</p>
							</div>
						</div>
					</Link>
				))}
			</div>
		</div>
	)
}
