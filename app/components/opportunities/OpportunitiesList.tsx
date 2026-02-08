// Component for displaying a list of opportunities

import type { OpportunityView as Opportunity } from "~/types";
import PageHeader from "../navigation/PageHeader";

interface OpportunitiesListProps {
	opportunities: Opportunity[];
	title?: string;
}

export default function OpportunitiesList({ opportunities, title = "Opportunities" }: OpportunitiesListProps) {
	return (
		<div className="space-y-6">
			<PageHeader title={title} />
			<div className="flex items-center justify-between">
				<div /> {/* Empty div to maintain flex spacing */}
				<button className="text-blue-600 text-sm hover:text-blue-800">+ Add Opportunity</button>
			</div>

			<div className="overflow-hidden rounded-lg bg-white shadow dark:bg-gray-900">
				<table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
					<thead className="bg-gray-50 dark:bg-gray-800">
						<tr>
							<th
								scope="col"
								className="px-6 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400"
							>
								Title
							</th>
							<th
								scope="col"
								className="px-6 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400"
							>
								Owner
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
								Impact/Effort
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
						{opportunities.map((opportunity, index) => (
							<tr key={opportunity.id || index} className="hover:bg-gray-50 dark:hover:bg-gray-800">
								<td className="whitespace-nowrap px-6 py-4 font-medium text-gray-900 text-sm dark:text-white">
									<a href={`/opportunities/${opportunity.id || index}`} className="text-blue-600 hover:text-blue-800">
										{opportunity.title}
									</a>
								</td>
								<td className="whitespace-nowrap px-6 py-4 text-gray-500 text-sm dark:text-gray-400">
									{opportunity.owner}
								</td>
								<td className="whitespace-nowrap px-6 py-4 text-sm">
									<span
										className={`inline-flex rounded-full px-2 font-semibold text-xs leading-5 ${
											opportunity.status === "Build"
												? "bg-green-100 text-green-800"
												: opportunity.status === "Validate"
													? "bg-blue-100 text-blue-800"
													: "bg-yellow-100 text-yellow-800"
										}`}
									>
										{opportunity.status || "Explore"}
									</span>
								</td>
								<td className="whitespace-nowrap px-6 py-4 text-gray-500 text-sm dark:text-gray-400">
									{opportunity.impact ? `${opportunity.impact}/${opportunity.effort || "-"}` : "-"}
								</td>
								<td className="whitespace-nowrap px-6 py-4 text-gray-500 text-sm dark:text-gray-400">
									<a
										href={`/opportunities/${opportunity.id || index}`}
										className="mr-3 text-blue-600 hover:text-blue-800"
									>
										View
									</a>
									<button className="text-gray-600 hover:text-gray-800">Edit</button>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
