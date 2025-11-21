import type { LucideIcon } from "lucide-react"
import {
	BookOpen,
	Briefcase,
	Building2,
	Compass,
	DollarSign,
	File,
	Grid3x3,
	Lightbulb,
	ListChecks,
	ListTodo,
	Sparkles,
	Target,
	UserCircle,
	Users,
} from "lucide-react"
import type { RouteDefinitions } from "~/utils/route-definitions"

export interface AppSidebarNavItem {
	key: string
	title: string
	description?: string
	icon: LucideIcon
	to: (routes: RouteDefinitions) => string
	featureFlag?: string
}

export interface AppSidebarSection {
	key: string
	title: string
	items: AppSidebarNavItem[]
}

/**
 * Order:
 * 1) Discovery
 * 2) Analyze
 * 3) Directory  ⟵ moved here (above any Revenue-specific controls in the sidebar)
 */
export const APP_SIDEBAR_SECTIONS: AppSidebarSection[] = [
	{
		key: "discovery",
		title: "Discovery",
		items: [
			{
				key: "overview",
				title: "Overview",
				description: "Running report",
				icon: Compass,
				to: (routes) => routes.projects.dashboard(),
			},
			{
				key: "objectives",
				title: "Objectives",
				description: "Learning goals & signals",
				icon: Target,
				to: (routes) => routes.projects.setup(),
			},
			{
				key: "guide",
				title: "Prompts",
				description: "Interview & prompt sets",
				icon: ListChecks,
				to: (routes) => routes.questions.index(),
			},
			{
				key: "conversations",
				// keep key "conversations" for count mapping; label is Encounters
				title: "Calls & Notes",
				description: "Calls, meetings, uploads",
				icon: File,
				to: (routes) => routes.interviews.index(),
			},
		],
	},
	{
		key: "analyze",
		title: "Analysis",
		items: [
			{
				key: "product-lens",
				title: "ICP Discovery",
				description: "Pain × user segments matrix",
				icon: Grid3x3,
				to: (routes) => routes.productLens(),
			},
			{
				key: "segments",
				title: "Segments",
				description: "Customer groups",
				icon: Target,
				to: (routes) => routes.segments.index(),
			},
			{
				key: "topics",
				title: "Themes",
				description: "Signals & themes",
				icon: Sparkles,
				to: (routes) => routes.themes.index(),
			},
			{
				key: "personas",
				title: "Personas",
				description: "Segments & patterns",
				icon: UserCircle,
				to: (routes) => routes.personas.index(),
			},
			{
				key: "bant-lens",
				title: "BANT Lens",
				description: "Budget × authority matrix",
				icon: DollarSign,
				to: (routes) => routes.bantLens(),
			},
			{
				key: "insights",
				title: "Findings",
				description: "Published insights & next steps",
				icon: Lightbulb,
				to: (routes) => routes.insights.index(),
			},
			{
				key: "priorities",
				title: "Priorities",
				description: "Task planning & roadmap",
				icon: ListTodo,
				to: (routes) => routes.priorities(),
				featureFlag: "ffPriorities",
			},
		],
	},
	{
		key: "directory",
		title: "CRM",
		items: [
			{
				key: "people",
				title: "People",
				description: "All individuals",
				icon: Users,
				to: (routes) => routes.people.index(), // implement tab switching inside the page
			},
			{
				key: "organizations",
				title: "Organizations",
				description: "Companies & groups",
				icon: Building2,
				// Simple deep-link via query param (adjust if you add a helper)
				to: (routes) => {
					return routes.organizations.index()
				},
			},
			{
				key: "opportunities",
				title: "Opportunities",
				description: "Sales pipeline & deals",
				icon: Briefcase,
				to: (routes) => routes.opportunities.index(),
			},
		],
	},
]

/** Footer / global utilities (Directory removed to avoid duplication) */
export const APP_SIDEBAR_UTILITY_LINKS: AppSidebarNavItem[] = [
	{
		key: "docs",
		title: "Docs",
		description: "Help & guides",
		icon: BookOpen,
		to: (routes) => routes.docs(),
	},
]
