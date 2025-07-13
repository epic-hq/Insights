import { type MetaFunction, useLoaderData } from "react-router"
import { Link } from "react-router-dom"

export const meta: MetaFunction = () => {
	return [{ title: "Interviews | Insights" }, { name: "description", content: "Research interviews and transcripts" }]
}

// Mock data for demonstration purposes
export function loader() {
	return {
		interviews: [
			{
				id: "int-001",
				date: "2025-07-10",
				participant: "Alex Johnson",
				status: "ready" as const,
				role: "Student",
				duration: "45 minutes",
				insightCount: 12,
			},
			{
				id: "int-002",
				date: "2025-07-08",
				participant: "Maria Garcia",
				status: "ready" as const,
				role: "Teacher",
				duration: "60 minutes",
				insightCount: 15,
			},
			{
				id: "int-003",
				date: "2025-07-05",
				participant: "Sam Taylor",
				status: "transcribed" as const,
				role: "Student",
				duration: "30 minutes",
				insightCount: 8,
			},
			{
				id: "int-004",
				date: "2025-07-01",
				participant: "Jamie Smith",
				status: "processing" as const,
				role: "Admin",
				duration: "50 minutes",
				insightCount: 0,
			},
			{
				id: "int-005",
				date: "2025-06-28",
				participant: "Pat Wilson",
				status: "ready" as const,
				role: "Teacher",
				duration: "55 minutes",
				insightCount: 14,
			},
			{
				id: "int-006",
				date: "2025-06-25",
				participant: "Jordan Lee",
				status: "ready" as const,
				role: "Student",
				duration: "40 minutes",
				insightCount: 10,
			},
			{
				id: "int-007",
				date: "2025-06-20",
				participant: "Casey Brown",
				status: "ready" as const,
				role: "Parent",
				duration: "35 minutes",
				insightCount: 9,
			},
			{
				id: "int-008",
				date: "2025-06-15",
				participant: "Riley Martinez",
				status: "ready" as const,
				role: "IT Staff",
				duration: "65 minutes",
				insightCount: 18,
			},
		],
		stats: {
			total: 8,
			byStatus: {
				ready: 6,
				transcribed: 1,
				processing: 1,
			},
			byRole: {
				Student: 3,
				Teacher: 2,
				Admin: 1,
				Parent: 1,
				"IT Staff": 1,
			},
			totalInsights: 86,
			averageInsightsPerInterview: 10.75,
		},
	}
}

export default function Interviews() {
	const { interviews, stats } = useLoaderData<typeof loader>()

	return (
		<div className="mx-auto max-w-[1440px] px-4 py-4">
			<div className="mb-6 flex items-center justify-between">
				<h1 className="font-bold text-2xl">Interviews</h1>
				<Link to="/" className="text-blue-600 hover:text-blue-800">
					Back to Dashboard
				</Link>
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
				<h2 className="mb-4 font-semibold text-xl">Interview Distribution</h2>
				<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
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
									ID
								</th>
								<th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400">
									Date
								</th>
								<th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400">
									Participant
								</th>
								<th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400">
									Role
								</th>
								<th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400">
									Duration
								</th>
								<th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400">
									Status
								</th>
								<th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400">
									Insights
								</th>
								<th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400">
									Actions
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-gray-200 dark:divide-gray-700">
							{interviews.map((interview) => (
								<tr key={interview.id}>
									<td className="whitespace-nowrap px-4 py-3">{interview.id}</td>
									<td className="whitespace-nowrap px-4 py-3">{interview.date}</td>
									<td className="whitespace-nowrap px-4 py-3">{interview.participant}</td>
									<td className="whitespace-nowrap px-4 py-3">{interview.role}</td>
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
									<td className="whitespace-nowrap px-4 py-3">{interview.insightCount}</td>
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
