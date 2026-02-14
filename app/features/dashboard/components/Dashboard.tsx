import { Settings2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import type { TreeNode } from "~/components/charts/TreeMap";
// import type { TreeNode } from "~/components/charts/TreeMap"
// import TreeMap from "~/components/charts/TreeMap"
import TagCountSelector from "~/components/TagCountSelector";
import TagDisplay from "~/components/TagDisplay";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { useCurrentProject } from "~/contexts/current-project-context";
import EnhancedPersonaCard from "~/features/personas/components/EnhancedPersonaCard";
import AddInterviewButton from "~/features/upload/components/AddInterviewButton";
import { useProjectRoutes } from "~/hooks/useProjectRoutes";
import type { OpportunityView, Project } from "~/types";
import type { KPI } from "./KPIBar";
import KPIBar from "./KPIBar";
import RecentInterviewsTable from "./RecentInterviewsTable";

interface DashboardProps {
	kpis: KPI[];
	personas: {
		name: string;
		percentage: number;
		count: number;
		color: string;
		href?: string;
	}[];
	interviews: {
		id: string;
		date: string;
		participant: string;
		status: "transcribed" | "processing" | "ready";
	}[];
	opportunities: OpportunityView[];
	themeTree: TreeNode[]; // hierarchical data for treemap
	project: Project;
	tags: { name: string; frequency: number }[]; // tags with frequency for TagDisplay
}

export default function Dashboard({
	project,
	kpis,
	personas,
	interviews,
	opportunities,
	themeTree,
	tags,
}: DashboardProps) {
	const { projectPath } = useCurrentProject();
	const routes = useProjectRoutes(projectPath || "");

	// State for controlling tag count
	const [tagCount, setTagCount] = useState(10);

	// Dynamically update the opportunities KPI
	const dynamicKpis = kpis.map((kpi) => {
		if (kpi.label === "Opportunities") {
			return { ...kpi, value: opportunities.length.toString() };
		}
		return kpi;
	});

	// Transform OpportunityView items to match OpportunityItem interface requirements
	const transformToKanbanItem = (
		o: OpportunityView
	): { id: string; title: string; owner: string; priority?: "high" | "medium" | "low" } => ({
		id: o.id || "",
		title: o.title || "Untitled Opportunity",
		owner: o.owner || "Unassigned",
		// Add a default priority based on impact if available
		...(o.impact ? { priority: o.impact > 7 ? "high" : o.impact > 4 ? "medium" : "low" } : {}),
	});

	const _kanbanCols = [
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
	];

	return (
		<div className="mx-auto max-w-[1440px] px-4 py-4">
			{/* Filter bar - full width above sticky KPI bar */}

			<div className="mr-10 mb-4 ml-4 flex items-center justify-between">
				<div className="flex flex-col justify-start">
					<div className="ml-2 text-muted-foreground text-xs">Project</div>
					<div className="flex flex-row">
						<Link to={routes.projects.index()}>
							<Tooltip>
								<TooltipTrigger>
									<div className="ml-2 font-bold text-xl">{project.name}</div>
								</TooltipTrigger>
								<TooltipContent>
									<p>{project.description}</p>
								</TooltipContent>
							</Tooltip>
						</Link>
						<Link to={routes.projects.edit(project.id)}>
							<Settings2 className="mt-1 ml-4 h-5 w-5" />
						</Link>
					</div>
				</div>
				<div className="flex items-center gap-3">
					<AddInterviewButton />
				</div>
				{/* <FilterBar segments={["Students", "Teachers", "Admins"]} /> */}
			</div>
			{interviews.length > 0 && (
				<div>
					{/* Sticky KPI Bar */}
					<KPIBar kpis={dynamicKpis} />
					{/* Main dashboard grid with 12-column layout */}
					<div className="mt-4 grid grid-cols-12 gap-4">
						{/* Insight Categories section - spans 8 columns on large screens, full width on smaller screens */}
						<div className="col-span-12 rounded-lg bg-white p-4 shadow-sm lg:col-span-4 dark:bg-gray-900">
							<div className="mb-3 flex items-center justify-between">
								<h2 className="font-semibold text-lg">Insight Categories</h2>
								<div className="flex items-center gap-4">
									<TagCountSelector value={tagCount} onChange={setTagCount} min={5} max={20} />
									<Link to={routes.insights.map()} className="text-blue-600 text-xs hover:text-blue-800">
										Explore themes
									</Link>
								</div>
							</div>
							<TagDisplay tags={tags} maxTags={tagCount} />
							{/* <TreeMap
						data={themeTree}
						onClick={(node) => {
							// Only navigate for child nodes (actual themes, not categories)
							if (node && !node.children) {
								// TODO: Implement theme navigation when themes routes are available
							}
						}}
					/> */}
						</div>

						{/* Personas section - spans 4 columns on large screens, full width on smaller screens */}
						<div className="col-span-12 rounded-lg bg-white p-4 shadow-sm lg:col-span-8 dark:bg-gray-900">
							<div className="mb-3 flex items-center justify-between">
								<h2 className="font-semibold text-lg">Personas</h2>
								<Link to={routes.personas.index()} className="text-blue-600 text-xs hover:text-blue-800">
									View all
								</Link>
							</div>
							<div className="grid grid-cols-2 gap-4">
								{personas.map((persona, index) => (
									<EnhancedPersonaCard key={`persona-${index}`} persona={persona} />
								))}
							</div>
						</div>
						{/* Opportunity Kanban - spans full width */}
						<div className="col-span-12 rounded-lg bg-white p-4 shadow-sm dark:bg-gray-900">
							<div className="mb-3 flex items-center justify-between">
								<h2 className="font-semibold text-lg">Opportunities</h2>
								<Link to={routes.opportunities.index()} className="text-blue-600 text-xs hover:text-blue-800">
									View all
								</Link>
							</div>
							<OpportunityKanban columns={_kanbanCols} />
						</div>

						{/* Recent Interviews - spans 6 columns on large screens, full width on smaller screens */}
						<div className="col-span-12 rounded-lg bg-white p-4 shadow-sm lg:col-span-6 dark:bg-gray-900">
							<div className="mb-3 flex items-center justify-between">
								<h2 className="font-semibold text-lg">Recent Interviews</h2>
								<div className="flex gap-4">
									<Link to={routes.interviews.index()} className="text-blue-600 text-xs hover:text-blue-800">
										View all interviews
									</Link>
									<Link to={routes.insights.withSort("latest")} className="text-blue-600 text-xs hover:text-blue-800">
										Latest insights
									</Link>
								</div>
							</div>
							<RecentInterviewsTable rows={interviews} />
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
