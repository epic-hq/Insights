import { Link, useNavigate } from "react-router-dom"
import type { OpportunityView } from "~/types"
import type { TreeNode } from "../charts/TreeMap"
import TreeMap from "../charts/TreeMap"
import type { InsightCardProps } from "../insights/InsightCard"
import UploadButton from "../upload/UploadButton"
import FilterBar from "./FilterBar"
import type { KPI } from "./KPIBar"
import KPIBar from "./KPIBar"
import OpportunityKanban from "./OpportunityKanban"
import PersonaCard from "./PersonaCard"
import RecentInterviewsTable from "./RecentInterviewsTable"

interface DashboardProps {
	kpis: KPI[]
	personas: {
		name: string
		percentage: number
		count: number
		color: string
		href?: string
	}[]
	interviews: {
		id: string
		date: string
		participant: string
		status: "transcribed" | "processing" | "ready"
	}[]
	opportunities: OpportunityView[]
	themeTree: TreeNode[] // hierarchical data for treemap
	insights: InsightCardProps[] // for filters/search later
}

export default function Dashboard({ kpis, personas, interviews, opportunities, themeTree }: DashboardProps) {
	const navigate = useNavigate()

	// Dynamically update the opportunities KPI
	const dynamicKpis = kpis.map((kpi) => {
		if (kpi.label === "Opportunities") {
			return { ...kpi, value: opportunities.length.toString() }
		}
		return kpi
	})

	// Transform OpportunityView items to match OpportunityItem interface requirements
	const transformToKanbanItem = (
		o: OpportunityView
	): { id: string; title: string; owner: string; priority?: "high" | "medium" | "low" } => ({
		id: o.id || "",
		title: o.title || "Untitled Opportunity",
		owner: o.owner || "Unassigned",
		// Add a default priority based on impact if available
		...(o.impact ? { priority: o.impact > 7 ? "high" : o.impact > 4 ? "medium" : "low" } : {}),
	})

	const kanbanCols = [
		{
			title: "Explore",
			items: opportunities.filter((o) => o.status === "Explore" && !!o.id).map(transformToKanbanItem),
		},
		{
			title: "Validate",
			items: opportunities.filter((o) => o.status === "Validate" && !!o.id).map(transformToKanbanItem),
		},
		{
			title: "Build",
			items: opportunities.filter((o) => o.status === "Build" && !!o.id).map(transformToKanbanItem),
		},
	]

	return (
		<div className="mx-auto max-w-[1440px] px-4 py-4">
			{/* Filter bar - full width above sticky KPI bar */}
			<div className="mb-4 flex items-center justify-between">
				<FilterBar segments={["Students", "Teachers", "Admins"]} />
				<UploadButton />
			</div>

			{/* Sticky KPI Bar */}
			<KPIBar kpis={dynamicKpis} />

			{/* Main dashboard grid with 12-column layout */}
			<div className="mt-4 grid grid-cols-12 gap-4">
				{/* Insight Categories section - spans 8 columns on large screens, full width on smaller screens */}
				<div className="col-span-12 rounded-lg bg-white p-4 shadow-sm lg:col-span-8 dark:bg-gray-900">
					<div className="mb-3 flex items-center justify-between">
						<h2 className="font-semibold text-lg">Insight Categories</h2>
						<Link to="/themes" className="text-blue-600 text-xs hover:text-blue-800">
							Explore themes
						</Link>
					</div>
					<TreeMap
						data={themeTree}
						onClick={(node) => {
							// Only navigate for child nodes (actual themes, not categories)
							if (node && !node.children) {
								navigate(`/themes/${node.name.toLowerCase().replace(/\s+/g, "-")}`)
							}
						}}
					/>
				</div>

				{/* Personas section - spans 4 columns on large screens, full width on smaller screens */}
				<div className="col-span-12 rounded-lg bg-white p-4 shadow-sm lg:col-span-4 dark:bg-gray-900">
					<div className="mb-3 flex items-center justify-between">
						<h2 className="font-semibold text-lg">Personas</h2>
						<Link to="/personas" className="text-blue-600 text-xs hover:text-blue-800">
							View all
						</Link>
					</div>
					<div className="grid gap-4">
						{personas.map((p) => (
							<PersonaCard key={p.name} {...p} />
						))}
					</div>
				</div>
				{/* Opportunity Kanban - spans full width */}
				<div className="col-span-12 rounded-lg bg-white p-4 shadow-sm dark:bg-gray-900">
					<div className="mb-3 flex items-center justify-between">
						<h2 className="font-semibold text-lg">Opportunities</h2>
						<Link to="/opportunities" className="text-blue-600 text-xs hover:text-blue-800">
							View all
						</Link>
					</div>
					<OpportunityKanban columns={kanbanCols} />
				</div>

				{/* Recent Interviews - spans 6 columns on large screens, full width on smaller screens */}
				<div className="col-span-12 rounded-lg bg-white p-4 shadow-sm lg:col-span-6 dark:bg-gray-900">
					<div className="mb-3 flex items-center justify-between">
						<h2 className="font-semibold text-lg">Recent Interviews</h2>
						<div className="flex gap-4">
							<Link to="/interviews" className="text-blue-600 text-xs hover:text-blue-800">
								View all interviews
							</Link>
							<Link to="/insights?sort=latest" className="text-blue-600 text-xs hover:text-blue-800">
								Latest insights
							</Link>
						</div>
					</div>
					<RecentInterviewsTable rows={interviews} />
				</div>
			</div>
		</div>
	)
}
