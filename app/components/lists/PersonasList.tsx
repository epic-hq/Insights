// Component for displaying a list of personas

import { Link } from "react-router-dom"
import type { PersonaSlice } from "~/components/charts/PersonaDonut"
import PersonaDonut from "~/components/charts/PersonaDonut"
import PageHeader from "~/components/navigation/PageHeader"

export interface Persona {
	id?: string
	name: string
	percentage: number
	count: number
	color: string
	description?: string
	slices?: PersonaSlice[]
	href?: string
}

interface PersonasListProps {
	personas: Persona[]
	title?: string
	totalParticipants?: number
}

export default function PersonasList({ personas, title = "Personas", totalParticipants }: PersonasListProps) {
	const total = totalParticipants || personas.reduce((sum, p) => sum + p.count, 0)

	return (
		<div className="space-y-6">
			<PageHeader title={title} />
			<div className="flex items-center justify-between">
				<div /> {/* Empty div to maintain flex spacing */}
				<div className="text-gray-500 text-sm">Total: {total} participants</div>
			</div>

			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				{personas.map((persona, index) => (
					<div
						key={persona.id || index}
						className="rounded-lg bg-white p-4 shadow transition-shadow hover:shadow-md dark:bg-gray-900"
					>
						<div className="flex items-center gap-4">
							{persona.slices ? (
								<PersonaDonut data={persona.slices} centerLabel={`${persona.percentage}%`} size={80} />
							) : (
								<div
									className="flex h-16 w-16 items-center justify-center rounded-full"
									style={{ backgroundColor: `${persona.color}20` }}
								>
									<div className="h-8 w-8 rounded-full" style={{ backgroundColor: persona.color }} />
								</div>
							)}

							<div className="flex-1">
								<h3 className="font-medium text-gray-900 dark:text-white">
									<Link
										to={`/personas/${persona.id || persona.name.toLowerCase().replace(/\s+/g, "-")}`}
										className="hover:text-blue-600"
									>
										{persona.name}
									</Link>
								</h3>
								<div className="mt-1 text-gray-500 text-sm">
									{persona.count} participants ({persona.percentage}%)
								</div>
							</div>
						</div>

						{persona.description && (
							<p className="mt-3 text-gray-600 text-sm dark:text-gray-300">{persona.description}</p>
						)}

						<div className="mt-3 flex justify-end">
							<Link
								to={`/personas/${persona.id || persona.name.toLowerCase().replace(/\s+/g, "-")}`}
								className="inline-flex items-center text-blue-600 text-sm hover:text-blue-800"
							>
								View details
								<svg
									className="ml-1 h-4 w-4"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
									xmlns="http://www.w3.org/2000/svg"
								>
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
								</svg>
							</Link>
						</div>
					</div>
				))}
			</div>
		</div>
	)
}
