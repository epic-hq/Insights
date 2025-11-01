import type React from "react"
import { Link, useParams } from "react-router-dom"
import PageHeader from "~/components/navigation/PageHeader"
import { useCurrentProject } from "~/contexts/current-project-context"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
// Import centralized types
import type { Interview, PersonaView } from "~/types"

interface PersonaDetailProps {
	personas: PersonaView[]
	interviews: Interview[]
}

const PersonaDetail: React.FC<PersonaDetailProps> = ({ personas, interviews }) => {
	const { personaId } = useParams<{ personaId: string }>()
	const { projectPath } = useCurrentProject()
	const routes = useProjectRoutes(projectPath || "")

	// Find the persona by ID (slug)
	const persona = personas.find((p) => {
		// Check if persona has an href that matches the current route
		if (p.href) {
			const hrefSlug = p.href.split("/").pop()
			if (hrefSlug === personaId) return true
		}

		// Fallback to generating slug from name
		const slug = p.name.toLowerCase().replace(/\s+/g, "-")
		return slug === personaId
	})

	if (!persona) {
		return (
			<div className="mx-auto max-w-7xl px-4 py-8">
				<PageHeader title="Persona Not Found" />
				<div className="rounded-lg bg-white p-6 shadow dark:bg-gray-900">
					<h1 className="mb-4 font-bold text-2xl text-red-600">Persona Not Found</h1>
					<p>The requested persona could not be found.</p>
				</div>
			</div>
		)
	}

	// Calculate percentage distribution of slices
	const totalSliceValue = persona.slices?.reduce((sum, slice) => sum + slice.value, 0) || 0

	return (
		<div className="mx-auto max-w-7xl px-4">
			<div className="overflow-hidden rounded-lg bg-white shadow dark:bg-gray-900">
				{/* Header with persona color */}
				<div className="h-18 w-full" style={{ backgroundColor: persona.color }}>
					<div className="flex flex-col p-2 md:flex-row md:items-center md:justify-between">
						<div>
							<h1 className="font-bold text-2xl">{persona.name}</h1>
							<p className="text-gray-600 dark:text-gray-400">
								{persona.percentage}% of participants ({persona.count} interviews)
							</p>
						</div>
					</div>
				</div>

				{/* Persona details */}
				<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
					<div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
						<h2 className="mb-3 font-semibold text-lg">Key Characteristics</h2>
						<ul className="list-disc space-y-2 pl-5 text-left">
							<li>
								Primary focus:{" "}
								{persona.name.includes("Early")
									? "Innovation and new features"
									: persona.name.includes("Mainstream")
										? "Usability and reliability"
										: "Value and stability"}
							</li>
							<li>
								Adoption stage:{" "}
								{persona.name.includes("Early")
									? "Early adopter"
									: persona.name.includes("Mainstream")
										? "Majority adopter"
										: "Late adopter"}
							</li>
							<li>
								Technical proficiency:{" "}
								{persona.name.includes("Early") ? "High" : persona.name.includes("Mainstream") ? "Medium" : "Varies"}
							</li>
						</ul>
					</div>

					<div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
						<h2 className="mb-3 font-semibold text-lg">Engagement Breakdown</h2>
						{persona.slices ? (
							<div className="space-y-3">
								{persona.slices.map((slice) => (
									<div key={slice.name} className="space-y-1">
										<div className="flex justify-between text-sm">
											<span>{slice.name}</span>
											<span>{Math.round((slice.value / totalSliceValue) * 100)}%</span>
										</div>
										<div className="h-2.5 w-full rounded-full bg-gray-200 dark:bg-gray-700">
											<div
												className="h-2.5 rounded-full"
												style={{
													width: `${(slice.value / totalSliceValue) * 100}%`,
													backgroundColor: slice.color,
												}}
											/>
										</div>
									</div>
								))}
							</div>
						) : (
							<p className="text-gray-500">No engagement data available</p>
						)}
					</div>

					<div className="rounded-lg bg-gray-50 p-4 md:col-span-2 dark:bg-gray-800">
						<h2 className="mb-3 font-semibold text-lg">Recommended Approach</h2>
						<p className="mb-3">
							{persona.name.includes("Early")
								? "Focus on innovation and cutting-edge features. This persona values being first and is willing to try experimental features."
								: persona.name.includes("Mainstream")
									? "Emphasize ease of use and practical benefits. This persona values reliability and clear documentation."
									: "Address concerns about value and stability. This persona needs convincing evidence before adopting new solutions."}
						</p>
						<h3 className="mt-4 mb-2 font-medium">Key Insights</h3>
						<ul className="list-disc space-y-1 pl-5 text-left">
							<li>
								{persona.name.includes("Early")
									? "Willing to tolerate some bugs in exchange for new capabilities"
									: persona.name.includes("Mainstream")
										? "Prefers proven solutions with good support"
										: "Highly concerned about disruption to existing workflows"}
							</li>
							<li>
								{persona.name.includes("Early")
									? "Often serves as internal champions for new tools"
									: persona.name.includes("Mainstream")
										? "Influenced by peer recommendations and case studies"
										: "Requires extensive proof of ROI before adoption"}
							</li>
						</ul>
					</div>
				</div>

				{/* Participant List Section */}
				<div className="mt-6 rounded-lg bg-gray-50 p-4 md:col-span-2 dark:bg-gray-800">
					<h2 className="mb-3 font-semibold text-lg">Participants in this Persona</h2>
					<div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
						{/* Filter participants by persona */}
						{interviews
							.filter((interview) => interview.segment === persona.name)
							.map((interview) => (
								<div
									key={interview.id}
									className="rounded bg-white p-3 shadow-sm transition-shadow hover:shadow-md dark:bg-gray-900"
								>
									<Link
										to={routes.interviews.detail(interview.id)}
										className="font-medium text-blue-600 hover:text-blue-800"
									>
										{interview.participant_pseudonym || "Anonymous"}
									</Link>
									<p className="mt-1 text-gray-500 text-sm">Role: {interview.title || "Not specified"}</p>
									<p className="text-gray-400 text-xs">
										Interviewed on{" "}
										{interview.interview_date
											? new Date(interview.interview_date).toLocaleDateString()
											: "Unknown date"}
									</p>
								</div>
							))}

						{/* Show message if no participants match this persona */}
						{interviews.filter((interview) => interview.segment === persona.name).length === 0 && (
							<div className="col-span-full py-4 text-center text-gray-500">
								No participants found for this persona.
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	)
}

export default PersonaDetail
