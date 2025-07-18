import { formatDistanceToNow } from "date-fns"
import { type MetaFunction, useLoaderData } from "react-router"
import { Link } from "react-router-dom"
import { Bar, BarChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import type { Database } from "~/../supabase/types"
import AddInterviewButton from "~/components/upload/AddInterviewButton"
import type { InterviewStatus } from "~/types"
import { InterviewStatus as InterviewStatusEnum } from "~/types"
import { db } from "~/utils/supabase.server"

// Define interview view type if not in centralized types
interface InterviewView {
	id: string
	date: string
	participant: string
	role: string
	duration: string
	status: InterviewStatus
	insightCount: number
	title: string
	interviewer: string
	createdAt: string
}
export const meta: MetaFunction = () => {
	return [{ title: "Interviews | Insights" }, { name: "description", content: "Research interviews and transcripts" }]
}

export async function loader({ request }: { request: Request }) {
	const url = new URL(request.url)

	const _sort = url.searchParams.get("sort") || "default"
	const _interviewFilter = url.searchParams.get("interview") || null
	const _themeFilter = url.searchParams.get("theme") || null
	const _personaFilter = url.searchParams.get("persona") || null

	type InterviewRow = Database["public"]["Tables"]["interviews"]["Row"]
	const query = db.from("interviews").select("*").order("created_at", { ascending: false })

	const { data: rows, error } = await query
	if (error) throw new Response(error.message, { status: 500 })

	const { data: allInsights, error: insightsError } = await db
		.from("insights")
		.select("interview_id")
		.not("interview_id", "is", null)

	if (insightsError) {
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

	const interviews: InterviewView[] = (rows || []).map((interview: InterviewRow) => ({
		id: interview.id,
		date: interview.interview_date || interview.created_at.split("T")[0],
		participant: interview.participant_pseudonym || "Anonymous",
		role: interview.segment || "User",
		duration: interview.duration_min ? `${interview.duration_min} min` : "N/A",
		status: interview.status as InterviewStatus,
		insightCount: insightCountMap.get(interview.id) || 0,
		title: interview.title || "",
		interviewer: interview.interviewer_id || "",
		createdAt: interview.created_at,
	}))

	const statusOptions = InterviewStatusEnum.options
	const roleMap: Record<string, { role: string } & Record<InterviewStatus, number>> = {}
	const roleCounts: Record<string, number> = {}
	const statusCounts: Record<InterviewStatus, number> = Object.fromEntries(statusOptions.map((s) => [s, 0])) as Record<
		InterviewStatus,
		number
	>
	let totalInsights = 0

	interviews.forEach((interview) => {
		const role = interview.role || "Unknown"
		const status = interview.status
		const count = interview.insightCount || 0

		if (!roleMap[role]) {
			roleMap[role] = { role, ...Object.fromEntries(statusOptions.map((s) => [s, 0])) } as any
		}
		roleMap[role][status]++
		statusCounts[status]++
		roleCounts[role] = (roleCounts[role] || 0) + 1
		totalInsights += count
	})

	const stats = {
		total: interviews.length,
		byStatus: statusCounts,
		byRole: roleCounts,
		totalInsights,
		averageInsightsPerInterview: interviews.length > 0 ? (totalInsights / interviews.length).toFixed(1) : 0,
	}

	return {
		interviews,
		stackedData: (() => {
			const roleMap: Record<string, { role: string } & Record<InterviewStatus, number>> = {}

			interviews.forEach((interview) => {
				const role = interview.role || "Unknown"
				const status = interview.status

				if (!roleMap[role]) {
					roleMap[role] = {
						role,
						...(Object.fromEntries(InterviewStatusEnum.options.map((s) => [s, 0])) as Record<InterviewStatus, number>),
					}
				}

				if (InterviewStatusEnum.options.includes(status)) {
					roleMap[role][status]++
				}
			})

			return Object.values(roleMap)
		})(),
		stats,
	}
}

export default function Interviews() {
	const { interviews, stackedData, stats } = useLoaderData<typeof loader>()

	const statusColors: Partial<Record<InterviewStatus, string>> = {
		draft: "#0acf00",
		scheduled: "#a855f7",
		uploaded: "#06b6d4",
		transcribed: "#facc15",
		processing: "#60a5fa",
		ready: "#4ade80",
		tagged: "#f97316",
		archived: "#9ca3af",
	}

	return (
		<div className="mx-auto max-w-[1440px] px-4 py-4">
			<div className="mb-6 flex items-center justify-between">
				<h1 className="font-bold text-2xl">Interviews</h1>
				<AddInterviewButton />
			</div>

			<div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
				<div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-900">
					<p className="text-gray-500 text-sm dark:text-gray-400">Total Interviews</p>
					<p className="font-bold text-2xl">{stats.total}</p>
				</div>
				<div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-900">
					<p className="text-gray-500 text-sm dark:text-gray-400">Total Insights</p>
					<p className="font-bold text-2xl">{stats.totalInsights}</p>
				</div>
				<div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-900">
					<p className="text-gray-500 text-sm dark:text-gray-400">Avg. Insights per Interview</p>
					<p className="font-bold text-2xl">{stats.averageInsightsPerInterview}</p>
				</div>
				<div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-900">
					<p className="text-gray-500 text-sm dark:text-gray-400">Ready for Analysis</p>
					<p className="font-bold text-2xl">
						{stats.byStatus.ready} / {stats.total}
					</p>
				</div>
			</div>

			<div className="mb-6 rounded-lg bg-white p-6 shadow-sm dark:bg-gray-900">
				{/* <h2 className="mb-4 font-semibold text-xl">Interview Distribution</h2> */}
				{/* <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
					<div>
						<h3 className="mb-2 font-medium">By Status</h3>
						<div className="space-y-2">
							{Object.entries(stats.byStatus).map(([status, count]) => (
								<div key={status} className="flex justify-between">
									<span className="capitalize">{status}</span>
									<span className="font-medium">{count}</span>
								</div>
							))}
						</div>
					</div>
					<div>
						<h3 className="mb-2 font-medium">By Role</h3>
						<div className="space-y-2">
							{Object.entries(stats.byRole).map(([role, count]) => (
								<div key={role} className="flex justify-between">
									<span>{role}</span>
									<span className="font-medium">{count}</span>
								</div>
							))}
						</div>
					</div>
				</div> */}
				<div className="mt-6">
					<h2 className="mb-4 font-semibold text-xl">Interview Segments by Status</h2>
					<ResponsiveContainer width="100%" height={200}>
						<BarChart data={stackedData}>
							<XAxis dataKey="role" />
							<YAxis allowDecimals={false} />
							<Tooltip />
							<Legend />

							{InterviewStatusEnum.options.map((status) => (
								<Bar
									key={status}
									dataKey={status}
									stackId="a"
									fill={statusColors[status] || "#d1d5db"} // fallback gray
								/>
							))}
						</BarChart>
					</ResponsiveContainer>
				</div>
			</div>

			<div className="rounded-lg bg-white p-6 shadow-sm dark:bg-gray-900">
				<div className="mb-4 flex items-center justify-between">
					<h2 className="font-semibold text-xl">All Interviews</h2>
					<Link to="/insights?sort=latest" className="text-blue-600 hover:text-blue-800">
						View all insights
					</Link>
				</div>
				<div className="overflow-x-auto">
					<table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
						<thead>
							<tr>
								<th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400">
									Participant
								</th>
								<th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400">
									Role
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
										<Link to={`/interviews/${interview.id}`}>{interview.participant}</Link>
									</td>
									<td className="whitespace-nowrap px-4 py-3">{interview.role}</td>
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
									<td className="whitespace-nowrap px-4 py-3">
										{formatDistanceToNow(interview.date, { addSuffix: true })}
									</td>
									<td className="whitespace-nowrap px-4 py-3">
										<Link to={`/interviews/${interview.id}`} className="text-blue-600 hover:text-blue-800">
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
