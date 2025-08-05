import consola from "consola"
import { formatDistance } from "date-fns"
import type { LoaderFunctionArgs, MetaFunction } from "react-router"
import { Link, useLoaderData } from "react-router-dom"
import { PrettySegmentPie } from "~/components/charts/PieSemgents"
import { useCurrentProject } from "~/contexts/current-project-context"
import { getInterviews } from "~/features/interviews/db"
import InlinePersonaBadge from "~/features/personas/components/InlinePersonaBadge"
import AddInterviewButton from "~/features/upload/components/AddInterviewButton"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { userContext } from "~/server/user-context"

export const meta: MetaFunction = () => {
	return [{ title: "Interviews | Insights" }, { name: "description", content: "Research interviews and transcripts" }]
}

export async function loader({ context }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const accountId = ctx.account_id
	const supabase = ctx.supabase

	consola.log("accountId", accountId)

	// Use typed database function
	const { data: rows, error } = await getInterviews({ supabase, accountId })

	if (error) {
		consola.error("Interviews query error:", error)
		throw new Response(`Error fetching interviews: ${error.message}`, { status: 500 })
	}

	consola.log(`Found ${rows?.length || 0} interviews`)

	// Fetch insights count for each interview
	const { data: allInsights, error: insightsError } = await supabase
		.from("insights")
		.select("id, interview_id")
		.eq("account_id", accountId)

	if (insightsError) {
		consola.error("Insights query error:", insightsError)
		throw new Response(`Error fetching insights: ${insightsError.message}`, { status: 500 })
	}

	const insightCountMap = new Map<string, number>()
	if (allInsights) {
		allInsights.forEach((insight) => {
			if (insight.interview_id) {
				const currentCount = insightCountMap.get(insight.interview_id) || 0
				insightCountMap.set(insight.interview_id, currentCount + 1)
			}
		})
	}

	// Build persona/segment distribution from interview participants
	const personaCountMap = new Map<string, number>()

	;(rows || []).forEach((interview) => {
		const primaryParticipant = interview.interview_people?.[0]
		const segment = primaryParticipant?.people?.segment || "Unknown"
		personaCountMap.set(segment, (personaCountMap.get(segment) || 0) + 1)
	})

	const segmentData = Array.from(personaCountMap.entries()).map(([name, value]) => ({
		name,
		value,
		color: "#d1d5db", // TODO: map personas to colors when available
	}))

	// Transform interviews for UI
	const interviews = (rows || []).map((interview) => {
		// Get primary participant from interview_people junction
		const primaryParticipant = interview.interview_people?.[0]
		const participant = primaryParticipant?.people

		return {
			...interview,
			participant: participant?.name || interview.title || "Unknown",
			role: primaryParticipant?.role || "participant",
			persona: participant?.segment || "No segment",
			date: interview.interview_date || interview.created_at || "",
			duration: interview.duration_min ? `${interview.duration_min} min` : "Unknown",
			insightCount: insightCountMap.get(interview.id) || 0,
		}
	})

	// Use the insight count from the map we already calculated
	const interviewsWithCounts = interviews.map((interview) => ({
		...interview,
		insightCount: interview.insightCount, // Already calculated above
	}))

	return { interviews: interviewsWithCounts, segmentData }
}

export default function InterviewsIndex() {
	const { interviews, segmentData } = useLoaderData<typeof loader>()
	const { accountId, projectId, projectPath } = useCurrentProject()
	const routes = useProjectRoutes(projectPath)

	return (
		<div className="space-y-8 p-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="font-bold text-3xl">Interviews</h1>
					<p className="text-gray-600">Research interviews and transcripts</p>
				</div>
				<AddInterviewButton />
			</div>

			<div className="mt-6">
				<h2 className="mb-4 font-semibold text-xl">Interview Segments</h2>
				<PrettySegmentPie data={segmentData} />
			</div>

			<div className="rounded-lg bg-white p-6 shadow-sm dark:bg-gray-900">
				<div className="mb-4 flex items-center justify-between">
					<h2 className="font-semibold text-xl">All Interviews</h2>
					<Link to={routes.insights.withSort("latest")} className="text-blue-600 hover:text-blue-800">
						View all insights
					</Link>
				</div>
				<div className="overflow-x-auto">
					<table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
						<thead>
							<tr>
								<th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400">
									People
								</th>
								<th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400">
									Persona
								</th>
								<th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400">
									Insights
								</th>
								<th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400">
									Duration
								</th>
								<th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400">
									Status
								</th>
								<th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400">
									Date
								</th>
								<th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400">
									Actions
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-gray-200 dark:divide-gray-700">
							{interviews.map((interview) => (
								<tr key={interview.id}>
									<td className="whitespace-nowrap px-4 py-3">
										<Link to={routes.interviews.detail(interview.id)}>
											<div className="flex flex-col">
												<div className="font-medium text-gray-900">
													{interview.interview_people?.[0]?.people?.name || interview.title || "Unknown Participant"}
												</div>
												<div className="text-gray-500 text-sm">
													{interview.interview_people?.[0]?.people?.segment || "Participant"}
												</div>
												{/* <div className="text-gray-500 text-sm">{interview.interview_date || "No date"}</div> */}
											</div>
										</Link>
									</td>
									<td className="whitespace-nowrap px-4 py-3">
										{interview.interview_people?.[0]?.people?.people_personas?.[0]?.personas ? (
											<InlinePersonaBadge persona={interview.interview_people[0].people.people_personas[0].personas} />
										) : (
											interview.interview_people?.[0]?.people?.segment || "No Persona"
										)}
									</td>
									<td className="whitespace-nowrap px-4 py-3">{interview.insightCount}</td>
									<td className="whitespace-nowrap px-4 py-3">{interview.duration}</td>
									<td className="whitespace-nowrap px-4 py-3">
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
									</td>
									<td className="whitespace-nowrap px-4 py-3">{formatDistance(interview.date, new Date())}</td>
									<td className="whitespace-nowrap px-4 py-3">
										<Link to={routes.interviews.detail(interview.id)} className="text-blue-600 hover:text-blue-800">
											View
										</Link>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	)
}
