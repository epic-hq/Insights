import consola from "consola"
import { formatDistance } from "date-fns"
import { Grid, List, Upload } from "lucide-react"
import { useState } from "react"
import type { LoaderFunctionArgs, MetaFunction } from "react-router"
import { Link, useLoaderData } from "react-router-dom"
import { Button } from "~/components/ui/button"
import { PrettySegmentPie } from "~/components/charts/PieSemgents"
import { useCurrentProject } from "~/contexts/current-project-context"
import { getInterviews } from "~/features/interviews/db"
import InterviewCard from "~/features/interviews/components/InterviewCard"
import InlinePersonaBadge from "~/features/personas/components/InlinePersonaBadge"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { userContext } from "~/server/user-context"

export const meta: MetaFunction = () => {
	return [{ title: "Interviews | Insights" }, { name: "description", content: "Research interviews and transcripts" }]
}

export async function loader({ context, params }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase

	// Both from URL params - consistent, explicit, RESTful
	const accountId = params.accountId
	const projectId = params.projectId

	if (!accountId || !projectId) {
		throw new Response("Account ID and Project ID are required", { status: 400 })
	}

	const { data: rows, error } = await getInterviews({
		supabase,
		accountId,
		projectId,
	})

	if (error) {
		consola.error("Interviews query error:", error)
		throw new Response(`Error fetching interviews: ${error.message}`, { status: 500 })
	}

	// consola.log(`Found ${rows?.length || 0} interviews`)

	// Fetch insights count for each interview
	const { data: allInsights, error: insightsError } = await supabase
		.from("insights")
		.select("id, interview_id")
		// .eq("account_id", accountId)
		.eq("project_id", projectId)

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

export default function InterviewsIndex({ showPie = false }: { showPie?: boolean }) {
	const { interviews, segmentData } = useLoaderData<typeof loader>()
	const { projectPath } = useCurrentProject()
	const routes = useProjectRoutes(projectPath)
	const [viewMode, setViewMode] = useState<"cards" | "table">("cards")

	return (
		<div className="relative min-h-screen bg-gray-50 dark:bg-gray-950">
			{/* Clean Header - Metro Style */}
			<div className="border-b border-gray-200 bg-white px-6 py-8 dark:border-gray-800 dark:bg-gray-950">
				<div className="mx-auto max-w-6xl">
					<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<h1 className="text-3xl font-light tracking-tight text-gray-900 dark:text-white">Sources</h1>
							<p className="mt-2 text-lg text-gray-600 dark:text-gray-400">
								Conversations, interviews, and transcripts
							</p>
						</div>
						<div className="flex flex-wrap gap-3">
							{/* View Toggle */}
							<div className="flex rounded-lg border border-gray-300 dark:border-gray-600">
								<Button
									variant={viewMode === "cards" ? "default" : "ghost"}
									size="sm"
									onClick={() => setViewMode("cards")}
									className="rounded-r-none"
								>
									<Grid className="h-4 w-4" />
								</Button>
								<Button
									variant={viewMode === "table" ? "default" : "ghost"}
									size="sm"
									onClick={() => setViewMode("table")}
									className="rounded-l-none"
								>
									<List className="h-4 w-4" />
								</Button>
							</div>
							<Button asChild variant="default" className="gap-2">
								<Link to={routes.interviews.onboard()}>
									<Upload className="h-4 w-4" />
									Add Interview
								</Link>
							</Button>
							<Button asChild variant="outline" className="border-gray-300 dark:border-gray-600">
								<Link to={routes.insights.withSort("latest")}>View All Insights</Link>
							</Button>
						</div>
					</div>
				</div>
			</div>

			{/* Segment Chart Section - Fixed */}
			{showPie && segmentData.length > 0 && (
				<div className="border-b border-gray-200 bg-white px-6 py-6 dark:border-gray-800 dark:bg-gray-950">
					<div className="mx-auto max-w-6xl">
						<div className="flex justify-center">
							<PrettySegmentPie data={segmentData} />
						</div>
					</div>
				</div>
			)}

			{/* Main Content */}
			<div className="mx-auto max-w-6xl px-6 py-12">
				{interviews.length === 0 ? (
					<div className="py-16 text-center">
						<div className="mx-auto max-w-md">
							<div className="mb-6 flex justify-center">
								<div className="rounded-full bg-gray-100 p-6 dark:bg-gray-800">
									<Upload className="h-12 w-12 text-gray-400 dark:text-gray-500" />
								</div>
							</div>
							<h3 className="mb-3 text-xl font-semibold text-gray-900 dark:text-white">No interviews yet</h3>
							<p className="mb-8 text-gray-600 dark:text-gray-400">
								Upload your first interview recording or transcript to start gathering insights from your research.
							</p>
							<Button asChild className="gap-2">
								<Link to={routes.interviews.onboard()}>
									<Upload className="h-4 w-4" />
									Add Your First Interview
								</Link>
							</Button>
						</div>
					</div>
				) : viewMode === "cards" ? (
					<div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
						{interviews.map((interview) => (
							<InterviewCard key={interview.id} interview={interview} />
						))}
					</div>
				) : (
					<div className="rounded-lg bg-white p-6 shadow-sm dark:bg-gray-900">
						<div className="overflow-x-auto">
							<table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
								<thead>
									<tr>
										<th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
											Interview
										</th>
										<th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
											Participant
										</th>
										<th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
											Persona
										</th>
										<th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
											Evidence
										</th>
										<th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
											Duration
										</th>
										<th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
											Status
										</th>
										<th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
											Date
										</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-gray-200 dark:divide-gray-700">
									{interviews.map((interview) => (
										<tr key={interview.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
											<td className="px-4 py-3">
												<Link to={routes.interviews.detail(interview.id)} className="hover:text-blue-600">
													<div className="font-medium text-gray-900 dark:text-white">
														{interview.title || `Interview with ${interview.participant}`}
													</div>
												</Link>
											</td>
											<td className="px-4 py-3">
												<div className="text-sm text-gray-900 dark:text-white">
													{interview.interview_people?.[0]?.people?.name || interview.participant}
												</div>
												<div className="text-sm text-gray-500 dark:text-gray-400">
													{interview.interview_people?.[0]?.people?.segment || "Participant"}
												</div>
											</td>
											<td className="whitespace-nowrap px-4 py-3">
												{interview.interview_people?.[0]?.people?.people_personas?.[0]?.personas ? (
													<InlinePersonaBadge
														persona={interview.interview_people[0].people.people_personas[0].personas}
													/>
												) : (
													<span className="text-sm text-gray-500">No Persona</span>
												)}
											</td>
											<td className="whitespace-nowrap px-4 py-3">
												<span className="font-medium text-purple-600">{interview.insightCount}</span>
											</td>
											<td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900 dark:text-white">
												{interview.duration}
											</td>
											<td className="whitespace-nowrap px-4 py-3">
												<span
													className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
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
											<td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
												{formatDistance(new Date(interview.date), new Date(), { addSuffix: true })}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</div>
				)}
			</div>
		</div>
	)
}
