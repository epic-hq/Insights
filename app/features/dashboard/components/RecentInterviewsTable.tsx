interface InterviewRow {
	id: string
	date: string
	participant: string
	status: "transcribed" | "processing" | "ready"
}

interface RecentInterviewsTableProps {
	rows: InterviewRow[]
	className?: string
}

const statusColors: Record<string, string> = {
	transcribed: "bg-amber-100 text-amber-800",
	processing: "bg-blue-100 text-blue-800",
	ready: "bg-emerald-100 text-emerald-800",
}

export default function RecentInterviewsTable({ rows, className }: RecentInterviewsTableProps) {
	return (
		<div className={`overflow-x-auto rounded-lg border bg-white dark:bg-gray-900 ${className ?? ""}`}>
			<table className="min-w-full text-sm">
				<thead>
					<tr className="bg-gray-50 dark:bg-gray-800">
						<th className="px-4 py-2 text-left font-semibold">Participant</th>
						<th className="px-4 py-2 text-left font-semibold">Status</th>
						<th className="px-4 py-2 text-left font-semibold">Date</th>
					</tr>
				</thead>
				<tbody>
					{rows.map((r) => (
						<tr key={r.id} className="odd:bg-white even:bg-gray-50 dark:even:bg-gray-800 dark:odd:bg-gray-900">
							<td className="px-4 py-2">{r.participant}</td>
							<td className="px-4 py-2">
								<span className={`rounded px-2 py-0.5 font-medium text-xs ${statusColors[r.status]}`}>{r.status}</span>
							</td>
							<td className="px-4 py-2">{r.date}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	)
}
