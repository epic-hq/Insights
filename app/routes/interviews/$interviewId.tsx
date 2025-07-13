import { type MetaFunction, useLoaderData } from "react-router"
import { Link } from "react-router-dom"
import type { InsightCardProps } from "~/components/insights/InsightCard"
import InsightCard from "~/components/insights/InsightCard"
import InsightCardGrid from "~/components/insights/InsightCardGrid"
import InterviewMetadata from "~/components/interviews/InterviewMetadata"

export const meta: MetaFunction = ({ params }) => {
	return [
		{ title: `Interview ${params.interviewId || ""} | Insights` },
		{ name: "description", content: "Interview transcript and insights" },
	]
}

// Mock data for demonstration purposes
export function loader({ params }: { params: { interviewId: string } }) {
	const interviewId = params.interviewId

	// Mock interview data
	const interview = {
		id: interviewId,
		date: "2025-07-10",
		participant: "Alex Johnson",
		role: "Student",
		status: "ready" as const,
		duration: "45 minutes",
		metadata: {
			age: "21",
			gender: "Male",
			location: "San Francisco, CA",
			education: "Undergraduate",
			experience: "2nd year student",
		},
		transcript: [
			{
				speaker: "Interviewer",
				text: "Thanks for joining us today. Can you tell me about your experience using the platform?",
			},
			{
				speaker: "Alex",
				text: "Sure. I've been using it for about a semester now. Overall it's been good, but I've had some issues with finding my assignments sometimes.",
			},
			{ speaker: "Interviewer", text: "Can you elaborate on that? What makes finding assignments difficult?" },
			{
				speaker: "Alex",
				text: "The navigation is a bit confusing. Sometimes assignments are under the course page, sometimes they're in the assignments section. It's not consistent.",
			},
			{ speaker: "Interviewer", text: "How does that affect your workflow?" },
			{
				speaker: "Alex",
				text: "I've missed a couple of deadlines because I didn't see the assignments. It's frustrating because I'm trying to stay on top of my work.",
			},
			{ speaker: "Interviewer", text: "What would make this better for you?" },
			{
				speaker: "Alex",
				text: "I'd love to have all assignments in one place, with clear due dates and maybe even notifications.",
			},
			{ speaker: "Interviewer", text: "How do you feel about the collaboration features?" },
			{
				speaker: "Alex",
				text: "Those are actually pretty good. I like how I can work on projects with classmates in real-time.",
			},
		],
	}

	// Mock insights from this interview
	const insights: InsightCardProps[] = [
		{
			id: "ins-001",
			title: "Navigation inconsistency causes missed deadlines",
			description:
				"Student reported missing assignment deadlines due to inconsistent placement of assignments across the platform.",
			sentiment: "negative",
			impact: "high",
			confidence: 90,
			tags: ["navigation", "assignments", "deadlines"],
			source: {
				type: "interview",
				id: interviewId,
				participant: "Alex Johnson",
				date: "2025-07-10",
			},
			evidence:
				"I've missed a couple of deadlines because I didn't see the assignments. It's frustrating because I'm trying to stay on top of my work.",
		},
		{
			id: "ins-002",
			title: "Students want centralized assignment view",
			description: "Participant expressed desire for a single location to view all assignments with clear due dates.",
			sentiment: "neutral",
			impact: "medium",
			confidence: 85,
			tags: ["assignments", "organization", "feature request"],
			source: {
				type: "interview",
				id: interviewId,
				participant: "Alex Johnson",
				date: "2025-07-10",
			},
			evidence: "I'd love to have all assignments in one place, with clear due dates and maybe even notifications.",
		},
		{
			id: "ins-003",
			title: "Positive feedback on collaboration features",
			description: "Student appreciates the real-time collaboration functionality for group projects.",
			sentiment: "positive",
			impact: "medium",
			confidence: 80,
			tags: ["collaboration", "group work", "positive"],
			source: {
				type: "interview",
				id: interviewId,
				participant: "Alex Johnson",
				date: "2025-07-10",
			},
			evidence: "Those are actually pretty good. I like how I can work on projects with classmates in real-time.",
		},
	]

	return {
		interview,
		insights,
	}
}

export default function InterviewDetail() {
	const { interview, insights } = useLoaderData<typeof loader>()

	return (
		<div className="mx-auto max-w-[1440px] px-4 py-4">
			<div className="mb-6 flex items-center justify-between">
				<div>
					<div className="flex items-center gap-2">
						<Link to="/interviews" className="text-blue-600 hover:text-blue-800">
							Interviews
						</Link>
						<span className="text-gray-500">/</span>
						<h1 className="font-bold text-2xl">
							{interview.id}: {interview.participant}
						</h1>
					</div>
				</div>
				<Link to="/" className="text-blue-600 hover:text-blue-800">
					Back to Dashboard
				</Link>
			</div>

			<div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
				<div className="lg:col-span-2">
					<div className="mb-6 rounded-lg bg-white p-6 shadow-sm dark:bg-gray-900">
						<h2 className="mb-4 font-semibold text-xl">Interview Transcript</h2>
						<div className="space-y-4">
							{interview.transcript.map((entry, index) => (
								<div
									key={`${entry.speaker}-${index}`}
									className={`rounded-lg p-3 ${
										entry.speaker === "Interviewer" ? "bg-gray-50 dark:bg-gray-800" : "bg-blue-50 dark:bg-blue-900/20"
									}`}
								>
									<p className="mb-1 font-medium">{entry.speaker}</p>
									<p className="text-gray-700 dark:text-gray-300">{entry.text}</p>
								</div>
							))}
						</div>
					</div>

					<div className="rounded-lg bg-white p-6 shadow-sm dark:bg-gray-900">
						<div className="mb-4 flex items-center justify-between">
							<h2 className="font-semibold text-xl">Insights from this Interview</h2>
							<Link to={`/insights?interview=${interview.id}`} className="text-blue-600 hover:text-blue-800">
								View all
							</Link>
						</div>
						<InsightCardGrid>
							{insights.map((insight) => (
								<InsightCard key={insight.id} {...insight} />
							))}
						</InsightCardGrid>
					</div>
				</div>

				<div className="lg:col-span-1">
					<div className="sticky top-4 mb-6 rounded-lg bg-white p-6 shadow-sm dark:bg-gray-900">
						<h2 className="mb-4 font-semibold text-xl">Participant Information</h2>
						<InterviewMetadata
							date={interview.date}
							participant={interview.participant}
							interviewer={interview.role}
							interviewId={interview.id}
							duration={Number(interview.duration)}
							segment={interview.status}
						/>

						<div className="mt-6 border-gray-200 border-t pt-6 dark:border-gray-700">
							<h3 className="mb-2 font-medium">Interview Status</h3>
							<div className="flex items-center">
								<span
									className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-medium text-xs ${
										interview.status === "ready"
											? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
											: interview.status === "transcribed"
												? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"
												: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
									}`}
								>
									{interview.status.charAt(0).toUpperCase() + interview.status.slice(1)}
								</span>
							</div>
						</div>

						<div className="mt-6 border-gray-200 border-t pt-6 dark:border-gray-700">
							<h3 className="mb-2 font-medium">Actions</h3>
							<div className="flex flex-col space-y-2">
								<Link to={`/insights?interview=${interview.id}`} className="text-blue-600 hover:text-blue-800">
									View all insights from this interview
								</Link>
								<button
									className="text-left text-blue-600 hover:text-blue-800"
									onClick={() => alert("Download functionality would be implemented here")}
								>
									Download transcript
								</button>
								<button
									className="text-left text-blue-600 hover:text-blue-800"
									onClick={() => alert("Share functionality would be implemented here")}
								>
									Share interview
								</button>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
