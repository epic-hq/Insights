// Component for displaying a list of interviews
import PageHeader from "../navigation/PageHeader"

// Extended interface for UI-specific interview display needs
export interface InterviewListItem {
	id: string
	date: string
	participant: string
	status: "transcribed" | "processing" | "ready"
}

interface InterviewsListProps {
	interviews: InterviewListItem[]
	title?: string
}

export default function InterviewsList({ interviews, title = "Interviews" }: InterviewsListProps) {
	return (
		<div className="space-y-4">
			<PageHeader title={title} />
			<div className="flex items-center justify-between">
				<div /> {/* Empty div to maintain flex spacing */}
				<button type="button" className="text-blue-600 text-sm hover:text-blue-800">
					+ Add Interview
				</button>
			</div>

			<div className="overflow-hidden rounded-lg bg-white shadow dark:bg-gray-900">
				<table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
					<thead className="bg-gray-50 dark:bg-gray-800">
						<tr>
							<th
								scope="col"
								className="px-6 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400"
							>
								ID
							</th>
							<th
								scope="col"
								className="px-6 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400"
							>
								Date
							</th>
							<th
								scope="col"
								className="px-6 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400"
							>
								Participant
							</th>
							<th
								scope="col"
								className="px-6 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400"
							>
								Status
							</th>
							<th
								scope="col"
								className="px-6 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400"
							>
								Actions
							</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
						{interviews.map((interview) => (
							<tr key={interview.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
								<td className="whitespace-nowrap px-6 py-4 font-medium text-gray-900 text-sm dark:text-white">
									<a href={`/interviews/${interview.id}`} className="text-blue-600 hover:text-blue-800">
										{interview.id}
									</a>
								</td>
								<td className="whitespace-nowrap px-6 py-4 text-gray-500 text-sm dark:text-gray-400">
									{interview.date}
								</td>
								<td className="whitespace-nowrap px-6 py-4 text-gray-500 text-sm dark:text-gray-400">
									{interview.participant}
								</td>
								<td className="whitespace-nowrap px-6 py-4 text-sm">
									<span
										className={`inline-flex rounded-full px-2 font-semibold text-xs leading-5 ${
											interview.status === "ready"
												? "bg-green-100 text-green-800"
												: interview.status === "transcribed"
													? "bg-blue-100 text-blue-800"
													: "bg-yellow-100 text-yellow-800"
										}`}
									>
										{interview.status}
									</span>
								</td>
								<td className="whitespace-nowrap px-6 py-4 text-gray-500 text-sm dark:text-gray-400">
									<a href={`/interviews/${interview.id}`} className="mr-3 text-blue-600 hover:text-blue-800">
										View
									</a>
									<button type="button" className="text-gray-600 hover:text-gray-800">
										Edit
									</button>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	)
}
