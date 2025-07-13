import type React from "react"
import { Link, useParams } from "react-router-dom"
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts"
import PageHeader from "../navigation/PageHeader"

// Import types
import type { Interview } from "./InterviewsList"

interface IntervieweeDetailProps {
	interviews: Interview[]
}

// Extended interviewee data (in a real app, this would come from an API)
interface IntervieweeData {
	name: string
	role: string
	company: string
	email?: string
	persona?: string
	personaColor?: string
	yearsExperience?: number
	keyInsights?: string[]
	sentimentScore?: number
}

const IntervieweeDetail: React.FC<IntervieweeDetailProps> = ({ interviews }) => {
	const { intervieweeId } = useParams<{ intervieweeId: string }>()

	// Find the interview by participant ID
	const interview = interviews.find(
		(i) => i.id === intervieweeId || i.participant.toLowerCase().replace(/\s+/g, "-") === intervieweeId
	)

	if (!interview) {
		return (
			<div className="mx-auto max-w-7xl px-4 py-8">
				<PageHeader title="Interviewee Not Found" />
				<div className="rounded-lg bg-white p-6 shadow dark:bg-gray-900">
					<h1 className="mb-4 font-bold text-2xl text-red-600">Interviewee Not Found</h1>
					<p>The requested interviewee could not be found.</p>
				</div>
			</div>
		)
	}

	// Mock additional data about the interviewee (in a real app, this would come from an API)
	const intervieweeData: IntervieweeData = {
		name: interview.participant,
		role: ["Product Manager", "Developer", "Designer", "Marketing"][Math.floor(Math.random() * 4)],
		company: ["Acme Corp", "TechGiant", "StartupXYZ", "Enterprise Inc"][Math.floor(Math.random() * 4)],
		email: `${interview.participant.toLowerCase().replace(/\s+/g, ".")}@example.com`,
		persona: ["Early Adopters", "Mainstream Learners", "Skeptics"][Math.floor(Math.random() * 3)],
		personaColor: ["#4285F4", "#42E3A9", "#FF6B6B"][Math.floor(Math.random() * 3)],
		yearsExperience: Math.floor(Math.random() * 15) + 1,
		keyInsights: [
			"Prefers visual documentation over text",
			"Uses the product daily for core workflows",
			"Struggles with advanced features",
			"Values quick response times",
		],
		sentimentScore: Math.random() * 10,
	}

	// Format date
	const interviewDate = new Date(interview.date)
	const formattedDate = interviewDate.toLocaleDateString("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
	})

	return (
		<div className="mx-auto max-w-7xl px-4 py-8">
			<PageHeader
				title={intervieweeData.name}
				breadcrumbs={[
					{ label: "Dashboard", path: "/" },
					{ label: "Interviews", path: "/interviews" },
					{ label: intervieweeData.name, path: `/interviewees/${intervieweeId}` },
				]}
			/>

			<div className="overflow-hidden rounded-lg bg-white shadow dark:bg-gray-900">
				{/* Header with persona color */}
				<div className="h-16 w-full" style={{ backgroundColor: intervieweeData.personaColor }} />

				<div className="p-6">
					<div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between">
						<div>
							<h1 className="font-bold text-2xl">{intervieweeData.name}</h1>
							<p className="text-gray-600 dark:text-gray-400">
								{intervieweeData.role} at {intervieweeData.company}
							</p>
						</div>

						<div className="mt-4 flex items-center md:mt-0">
							{intervieweeData.persona && (
								<Link
									to={`/personas/${intervieweeData.persona.toLowerCase().replace(/\s+/g, "-")}`}
									className="flex items-center"
								>
									<span
										className="mr-2 inline-block h-4 w-4 rounded-full"
										style={{ backgroundColor: intervieweeData.personaColor }}
									/>
									<span className="font-medium text-sm">{intervieweeData.persona}</span>
								</Link>
							)}
						</div>
					</div>

					{/* Interviewee details */}
					<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
						<div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
							<h2 className="mb-3 font-semibold text-lg">Contact Information</h2>
							<div className="space-y-3">
								<div>
									<span className="block text-gray-500 text-sm">Email</span>
									<p>{intervieweeData.email}</p>
								</div>
								<div>
									<span className="block text-gray-500 text-sm">Company</span>
									<p>{intervieweeData.company}</p>
								</div>
								<div>
									<span className="block text-gray-500 text-sm">Years of Experience</span>
									<p>{intervieweeData.yearsExperience} years</p>
								</div>
							</div>
						</div>

						<div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
							<h2 className="mb-3 font-semibold text-lg">Interview Details</h2>
							<div className="space-y-3">
								<div>
									<span className="block text-gray-500 text-sm">Interview Date</span>
									<p>{formattedDate}</p>
								</div>
								<div>
									<span className="block text-gray-500 text-sm">Interview ID</span>
									<p>{interview.id}</p>
								</div>
								<div>
									<span className="block text-gray-500 text-sm">Status</span>
									<span
										className={`rounded-full px-2 py-1 font-semibold text-xs ${
											interview.status === "ready"
												? "bg-green-100 text-green-800"
												: interview.status === "transcribed"
													? "bg-blue-100 text-blue-800"
													: "bg-yellow-100 text-yellow-800"
										}`}
									>
										{interview.status}
									</span>
								</div>
							</div>
						</div>

						<div className="rounded-lg bg-gray-50 p-4 md:col-span-2 dark:bg-gray-800">
							<h2 className="mb-3 font-semibold text-lg">Key Insights</h2>
							<ul className="list-inside list-disc space-y-2">
								{intervieweeData.keyInsights?.map((insight) => (
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
														{ name: "Positive", value: intervieweeData.sentimentScore || 0 },
														{ name: "Negative", value: 100 - (intervieweeData.sentimentScore || 0) },
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
										{intervieweeData.sentimentScore ? intervieweeData.sentimentScore.toFixed(1) : "0"}/10
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
								to={`/interviews/${interview.id}`}
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
									<p className="font-semibold text-gray-700 dark:text-gray-300">{intervieweeData.name}:</p>
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
									<p className="font-semibold text-gray-700 dark:text-gray-300">{intervieweeData.name}:</p>
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
									<Link to={`/opportunities/${opp.id}`} className="font-medium text-blue-600 hover:text-blue-800">
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
