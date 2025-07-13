import type { MetaFunction } from "react-router"
import { useLoaderData } from "react-router"
import { Link } from "react-router-dom"
import OpportunityKanban from "~/components/dashboard/OpportunityKanban"

export const meta: MetaFunction = () => {
	return [
		{ title: "Opportunities | Insights" },
		{ name: "description", content: "Product opportunities based on research insights" },
	]
}

// Mock data for demonstration purposes
export function loader() {
	const opportunities = [
		{ id: "opp-1", title: "Improve onboarding flow", owner: "Alex", status: "explore" },
		{ id: "opp-2", title: "Simplify grading system", owner: "Maria", status: "explore" },
		{ id: "opp-3", title: "Add mobile notifications", owner: "Jamie", status: "explore" },
		{ id: "opp-4", title: "Enhance search functionality", owner: "Sam", status: "validate" },
		{ id: "opp-5", title: "Streamline assignment submission", owner: "Alex", status: "validate" },
		{ id: "opp-6", title: "Improve calendar integration", owner: "Maria", status: "validate" },
		{ id: "opp-7", title: "Add collaborative editing", owner: "Jamie", status: "build" },
		{ id: "opp-8", title: "Enhance reporting dashboard", owner: "Sam", status: "build" },
		{ id: "opp-9", title: "Implement dark mode", owner: "Alex", status: "build" },
		{ id: "opp-10", title: "Add accessibility features", owner: "Maria", status: "explore" },
		{ id: "opp-11", title: "Improve notification settings", owner: "Jamie", status: "validate" },
		{ id: "opp-12", title: "Create student analytics dashboard", owner: "Sam", status: "build" },
	]

	// Group opportunities by status
	const kanbanColumns = [
		{
			title: "Explore",
			items: opportunities.filter((opp) => opp.status === "explore").map((opp) => ({ ...opp, id: opp.id })),
		},
		{
			title: "Validate",
			items: opportunities.filter((opp) => opp.status === "validate").map((opp) => ({ ...opp, id: opp.id })),
		},
		{
			title: "Build",
			items: opportunities.filter((opp) => opp.status === "build").map((opp) => ({ ...opp, id: opp.id })),
		},
	]

	return {
		kanbanColumns,
		opportunitiesByOwner: {
			Alex: opportunities.filter((opp) => opp.owner === "Alex"),
			Maria: opportunities.filter((opp) => opp.owner === "Maria"),
			Jamie: opportunities.filter((opp) => opp.owner === "Jamie"),
			Sam: opportunities.filter((opp) => opp.owner === "Sam"),
		},
		opportunitiesByStatus: {
			explore: opportunities.filter((opp) => opp.status === "explore").length,
			validate: opportunities.filter((opp) => opp.status === "validate").length,
			build: opportunities.filter((opp) => opp.status === "build").length,
		},
	}
}

export default function Opportunities() {
	const { kanbanColumns, opportunitiesByOwner, opportunitiesByStatus } = useLoaderData<typeof loader>()

	return (
		<div className="mx-auto max-w-[1440px] px-4 py-4">
			<div className="mb-6 flex items-center justify-between">
				<h1 className="font-bold text-2xl">Opportunities</h1>
				<Link to="/" className="text-blue-600 hover:text-blue-800">
					Back to Dashboard
				</Link>
			</div>

			<div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
				<div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-900">
					<h3 className="mb-2 font-medium text-lg">Status Overview</h3>
					<div className="space-y-2">
						<div className="flex justify-between">
							<span>Explore</span>
							<span className="font-medium">{opportunitiesByStatus.explore}</span>
						</div>
						<div className="flex justify-between">
							<span>Validate</span>
							<span className="font-medium">{opportunitiesByStatus.validate}</span>
						</div>
						<div className="flex justify-between">
							<span>Build</span>
							<span className="font-medium">{opportunitiesByStatus.build}</span>
						</div>
					</div>
				</div>

				<div className="rounded-lg bg-white p-4 shadow-sm md:col-span-2 dark:bg-gray-900">
					<h3 className="mb-2 font-medium text-lg">Ownership</h3>
					<div className="grid grid-cols-2 gap-4">
						{Object.entries(opportunitiesByOwner).map(([owner, opps]) => (
							<div key={owner} className="flex justify-between">
								<span>{owner}</span>
								<span className="font-medium">{opps.length} opportunities</span>
							</div>
						))}
					</div>
				</div>
			</div>

			<div className="rounded-lg bg-white p-6 shadow-sm dark:bg-gray-900">
				<h2 className="mb-4 font-semibold text-xl">Opportunity Kanban</h2>
				<OpportunityKanban columns={kanbanColumns} />
			</div>

			<div className="mt-6 rounded-lg bg-white p-6 shadow-sm dark:bg-gray-900">
				<h2 className="mb-4 font-semibold text-xl">All Opportunities</h2>
				<div className="overflow-x-auto">
					<table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
						<thead>
							<tr>
								<th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400">
									Title
								</th>
								<th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400">
									Owner
								</th>
								<th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400">
									Status
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-gray-200 dark:divide-gray-700">
							{kanbanColumns.flatMap((col) =>
								col.items.map((item) => (
									<tr key={item.id}>
										<td className="whitespace-nowrap px-4 py-3">{item.title}</td>
										<td className="whitespace-nowrap px-4 py-3">{item.owner}</td>
										<td className="whitespace-nowrap px-4 py-3">
											<span
												className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-medium text-xs ${
													item.status === "explore"
														? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
														: item.status === "validate"
															? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"
															: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
												}`}
											>
												{item.status.charAt(0).toUpperCase() + item.status.slice(1)}
											</span>
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	)
}
