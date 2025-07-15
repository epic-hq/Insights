import type { MetaFunction } from "react-router"
import { useLoaderData } from "react-router"
import { Link } from "react-router-dom"
import type { Database } from "~/../supabase/types"
import OpportunityKanban from "~/components/dashboard/OpportunityKanban"
import type { OpportunityView } from "~/types"
import { db } from "~/utils/supabase.server"

// Define interfaces to match the OpportunityKanban component's expected types
interface OpportunityItem {
	id: string
	title: string
	owner: string
	priority?: "high" | "medium" | "low"
}

interface ColumnData {
	title: string
	items: OpportunityItem[]
}

export const meta: MetaFunction = () => {
	return [
		{ title: "Opportunities | Insights" },
		{ name: "description", content: "Product opportunities based on research insights" },
	]
}

// export const handle = {
// 	crumb: () => <Link to="/opportunities">Opportunities</Link>,
// }

// Load opportunities from Supabase
export async function loader() {
	type OpportunityRow = Database["public"]["Tables"]["opportunities"]["Row"]

	// Fetch all opportunities from the database
	const { data: rows, error } = await db.from("opportunities").select("*")
	if (error) throw new Response(error.message, { status: 500 })

	// Map database rows to OpportunityView type
	const opportunities: OpportunityView[] = (rows || []).map((r: OpportunityRow) => ({
		id: r.id,
		title: r.title || "",
		// Include all required fields from the database
		created_at: r.created_at,
		kanban_status: r.kanban_status,
		org_id: r.org_id,
		owner_id: r.owner_id,
		related_insight_ids: r.related_insight_ids,
		// Add UI-specific fields
		owner: r.owner_id || "", // Use owner_id as owner name for now
		status: r.kanban_status || "explore", // Use kanban_status as status
		impact: 3, // Default value for now
		effort: 2, // Default value for now
		description: "", // Default value for now
	}))

	// Group opportunities by status and map to the format expected by OpportunityKanban
	const kanbanColumns: ColumnData[] = [
		{
			title: "Explore",
			items: opportunities
				.filter((opp) => opp.status?.toLowerCase() === "explore")
				.map((opp) => ({
					id: opp.id,
					title: opp.title || "",
					owner: opp.owner || "",
					// Map impact to priority for visualization
					priority:
						typeof opp.impact === "number" && opp.impact > 3
							? "high"
							: typeof opp.impact === "number" && opp.impact > 1
								? "medium"
								: "low",
				})),
		},
		{
			title: "Validate",
			items: opportunities
				.filter((opp) => opp.status?.toLowerCase() === "validate")
				.map((opp) => ({
					id: opp.id,
					title: opp.title || "",
					owner: opp.owner || "",
					priority:
						typeof opp.impact === "number" && opp.impact > 3
							? "high"
							: typeof opp.impact === "number" && opp.impact > 1
								? "medium"
								: "low",
				})),
		},
		{
			title: "Build",
			items: opportunities
				.filter((opp) => opp.status?.toLowerCase() === "build")
				.map((opp) => ({
					id: opp.id,
					title: opp.title || "",
					owner: opp.owner || "",
					priority:
						typeof opp.impact === "number" && opp.impact > 3
							? "high"
							: typeof opp.impact === "number" && opp.impact > 1
								? "medium"
								: "low",
				})),
		},
	]

	// Get unique owners from the data
	const uniqueOwners = Array.from(new Set(opportunities.map((opp) => opp.owner_id || "").filter(Boolean)))

	// Create a dynamic object with owners as keys
	const opportunitiesByOwner: Record<string, OpportunityView[]> = {}
	uniqueOwners.forEach((owner) => {
		opportunitiesByOwner[owner] = opportunities.filter((opp) => opp.owner_id === owner)
	})

	return {
		kanbanColumns,
		opportunitiesByOwner,
		opportunitiesByStatus: {
			explore: opportunities.filter((opp) => opp.status?.toLowerCase() === "explore").length,
			validate: opportunities.filter((opp) => opp.status?.toLowerCase() === "validate").length,
			build: opportunities.filter((opp) => opp.status?.toLowerCase() === "build").length,
		},
	}
}

export default function Opportunities() {
	const { kanbanColumns, opportunitiesByOwner, opportunitiesByStatus } = useLoaderData<typeof loader>()

	return (
		<div className="mx-auto max-w-[1440px] ">
			{/* <div className="mb-6 flex items-center justify-between">
				<h1 className="font-bold text-2xl">Opportunities</h1>
				<Link to="/" className="text-blue-600 hover:text-blue-800">
					Back to Dashboard
				</Link>
			</div> */}

			{/*
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
			</div>*/}

			<div className="rounded-lg bg-white p-6 shadow-sm dark:bg-gray-900">
				<h2 className="mb-4 font-semibold text-xl">Opportunity Kanban</h2>
				<OpportunityKanban columns={kanbanColumns} />
			</div>

			<div className="rounded-lg bg-white p-6 shadow-sm dark:bg-gray-900">
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
										<td className="whitespace-nowrap px-4 py-3">
											<Link
												to={`/opportunities/${item.id}`}
												className="text-blue-600 hover:text-blue-800 hover:underline"
											>
												{item.title}
											</Link>
										</td>
										<td className="whitespace-nowrap px-4 py-3">{item.owner}</td>
										<td className="whitespace-nowrap px-4 py-3">
											<span
												className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-medium text-xs ${
													col.title.toLowerCase() === "explore"
														? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
														: col.title.toLowerCase() === "validate"
															? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"
															: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
												}`}
											>
												{col.title.charAt(0).toUpperCase() + col.title.slice(1)}
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
