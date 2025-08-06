import type React from "react"
import { Link, useParams } from "react-router-dom"
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts"
import PageHeader from "../navigation/PageHeader"

// Supabase generated types
import type { Database } from "~/../supabase/types"
import { useCurrentProject } from "~/contexts/current-project-context"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"

type Person = Database["public"]["Tables"]["people"]["Row"] & {
	interview_role?: string
	personas?: {
		persona_id: string
		personas: { id: string; name: string; color_hex: string | null }
	}[]
}

interface IntervieweeDetailProps {
	participants: Person[]
	interview?: Database["public"]["Tables"]["interviews"]["Row"]
}

const IntervieweeDetail: React.FC<IntervieweeDetailProps> = ({ participants, interview }) => {
	const { intervieweeId } = useParams<{ intervieweeId: string }>()
	const { projectPath } = useCurrentProject()
	const routes = useProjectRoutes(projectPath || "")

	// Find the person by ID
	const person = participants.find((p) => p.id === intervieweeId)

	if (!person) {
		return (
			<div className="mx-auto max-w-7xl px-4 py-8">
				<PageHeader title="Person Not Found" />
				<div className="rounded-lg bg-white p-6 shadow dark:bg-gray-900">
					<h1 className="mb-4 font-bold text-2xl text-red-600">Person Not Found</h1>
					<p>The requested person could not be found.</p>
				</div>
			</div>
		)
	}

	// Get primary persona for display
	const primaryPersona = person.personas?.[0]?.personas

	// Mock additional data - in real app, this could come from person record or be computed
	const personData = {
		name: person.name,
		role: person.interview_role || "Participant",
		company: person.segment || "Unknown",
		email: person.contact_info || undefined,
		persona: primaryPersona?.name,
		personaColor: primaryPersona?.color_hex || "#3b82f6",
		yearsExperience: 8, // Could be computed from person data
		keyInsights: [
			"Extracted from interview insights",
			"Could be computed from related insights",
			"Based on persona characteristics",
		],
		sentimentScore: 0.7, // Could be computed from insights
	}

	// Remove unused date formatting

	return (
		<div className="mx-auto max-w-7xl px-4 py-8">
			<PageHeader title={`${personData.name} - Interview Analysis`} breadcrumbs={[
				{ label: "Dashboard", path: routes.dashboard() },
				{ label: "Interviews", path: routes.interviews.index() },
				{ label: personData.name, path: routes.people.detail(intervieweeId) },
			]} />

			<div className="overflow-hidden rounded-lg bg-white shadow dark:bg-gray-900">
				{/* Header with persona color */}
				<div className="h-16 w-full" style={{ backgroundColor: personData.personaColor }} />

				<div className="p-6">
					<div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between">
						<div>
							<h1 className="font-bold text-2xl">{personData.name}</h1>
							<p className="text-gray-600 dark:text-gray-400">
								{personData.role} at {personData.company}
							</p>
						</div>

						<div className="mt-4 flex items-center md:mt-0">
							{personData.persona && primaryPersona && (
								<Link
									to={routes.personas.detail(primaryPersona.id)}
									className="flex items-center"
								>
									<span
										className="mr-2 inline-block h-4 w-4 rounded-full"
										style={{ backgroundColor: personData.personaColor }}
									/>
									<span className="font-medium text-sm">{personData.persona}</span>
								</Link>
							)}
						</div>
					</div>

					{/* Interviewee details */}
					<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
						<div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
							<h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">{personData.name}</h1>
							<div className="mb-4 flex flex-wrap gap-2">
								<span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">
									{personData.role}
								</span>
								<span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-200">
									{personData.company}
								</span>
								{personData.persona && (
									<span
										className="rounded-full px-3 py-1 text-sm font-medium text-white"
										style={{ backgroundColor: personData.personaColor }}
									>
										{personData.persona}
									</span>
								)}
							</div>
							<p className="text-gray-600 dark:text-gray-300">
								Interview Date: {interview?.interview_date ? new Date(interview.interview_date).toLocaleDateString() : 'N/A'}
							</p>
						</div>

						<div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
							<h2 className="mb-3 font-semibold text-lg">Contact Information</h2>
							<div className="space-y-3">
								<div>
									<p className="text-gray-600 text-sm dark:text-gray-400">Email</p>
									<p className="font-medium text-gray-900 dark:text-white">
										{personData.email || "Not provided"}
									</p>
								</div>
								<div>
									<p className="text-gray-600 text-sm dark:text-gray-400">Company</p>
									<p className="font-medium text-gray-900 dark:text-white">{personData.company}</p>
								</div>
								<div>
									<p className="text-gray-600 text-sm dark:text-gray-400">Years of Experience</p>
									<p className="font-medium text-gray-900 dark:text-white">{personData.yearsExperience} years</p>
								</div>
							</div>
						</div>

						<div className="rounded-lg bg-gray-50 p-4 md:col-span-2 dark:bg-gray-800">
							<h2 className="mb-3 font-semibold text-lg">Key Insights</h2>
							<ul className="list-inside list-disc space-y-2">
								{personData.keyInsights?.map((insight) => (
									<li key={insight}>{insight}</li>
								))}
							</ul>

							<div className="mt-6">
								<h3 className="mb-2 font-medium">Sentiment Analysis</h3>
								<div className="flex items-center">
									<div className="mr-4 h-20 w-20">
										<ResponsiveContainer width="100%" height={80}>
											<PieChart>
												<Pie
													data={[
														{ name: "Positive", value: Math.round((personData.sentimentScore || 0) * 100) },
														{ name: "Negative", value: 100 - Math.round((personData.sentimentScore || 0) * 100) },
													]}
													cx="50%"
													cy="50%"
													innerRadius={25}
													outerRadius={35}
													paddingAngle={0}
													dataKey="value"
												>
													<Cell key="positive" fill="#4ade80" />
													<Cell key="negative" fill="transparent" />
												</Pie>
											</PieChart>
										</ResponsiveContainer>
									</div>
									<span className="font-medium text-sm">
										{personData.sentimentScore ? personData.sentimentScore.toFixed(1) : "0"}/10
									</span>
								</div>
							</div>
						</div>
					</div>

					{/* Interview Transcript Preview */}
					<div className="mt-6 rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
						<div className="mb-3 flex items-center justify-between">
							<h2 className="font-semibold text-lg">Interview Transcript</h2>
							<Link
								to={routes.interviews.detail(interview?.id || "")}
								className="inline-flex items-center text-blue-600 text-sm hover:text-blue-800"
							>
								View Full Transcript
								<svg
									className="ml-1 h-4 w-4"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
									xmlns="http://www.w3.org/2000/svg"
									aria-labelledby="view-transcript-title"
								>
									<title id="view-transcript-title">View Full Transcript</title>
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
								</svg>
							</Link>
						</div>

						<div className="rounded bg-white p-4 text-sm dark:bg-gray-900">
							<div className="space-y-4">
								<div>
									<p className="font-semibold text-gray-700 dark:text-gray-300">Interviewer:</p>
									<p className="ml-4">Can you tell me about your experience with our product?</p>
								</div>
								<div>
									<p className="font-semibold text-gray-700 dark:text-gray-300">{personData.name}:</p>
									<p className="ml-4">
										I've been using it for about 6 months now. Overall, I find it quite intuitive, but there are some
										features that I think could be improved.
									</p>
								</div>
								<div>
									<p className="font-semibold text-gray-700 dark:text-gray-300">Interviewer:</p>
									<p className="ml-4">Could you elaborate on which features specifically?</p>
								</div>
								<div>
									<p className="font-semibold text-gray-700 dark:text-gray-300">{personData.name}:</p>
									<p className="ml-4">
										The reporting functionality is a bit cumbersome. It takes too many clicks to generate the reports I
										need regularly...
									</p>
								</div>
							</div>
							<div className="mt-4 text-center text-gray-500">
								<p>[ Transcript truncated - view full interview for more ]</p>
							</div>
						</div>
					</div>

					{/* Related Opportunities Section */}
					<div className="mt-6 rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
						<h2 className="mb-3 font-semibold text-lg">Related Opportunities</h2>
						<div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
							{/* This is mock data - in a real app, you would fetch the actual related opportunities */}
							{[
								{ id: "opp-1", name: "Improve Reporting UX", status: "Explore", impact: "High", effort: "Medium" },
								{
									id: "opp-2",
									name: "Simplify Dashboard Navigation",
									status: "Validate",
									impact: "Medium",
									effort: "Low",
								},
							].map((opp) => (
								<div
									key={opp.id}
									className="rounded bg-white p-3 shadow-sm transition-shadow hover:shadow-md dark:bg-gray-900"
								>
									<Link to={routes.opportunities.detail(opp.id)} className="font-medium text-blue-600 hover:text-blue-800">
										{opp.name}
									</Link>
									<p className="mt-1 text-gray-500 text-sm">Status: {opp.status}</p>
									<p className="text-gray-400 text-xs">
										Impact: {opp.impact} | Effort: {opp.effort}
									</p>
								</div>
							))}
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}

export default IntervieweeDetail
