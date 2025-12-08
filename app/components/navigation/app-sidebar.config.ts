import type { LucideIcon } from "lucide-react"
import {
	BookOpen,
	Briefcase,
	Building2,
	CheckSquare,
	Compass,
	DollarSign,
	File,
	Glasses,
	Grid3x3,
	Lightbulb,
	Search,
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
 * Sidebar sections organized for clarity:
 * 1) Discovery - Setup, content, conversations
 * 2) Results - Lens analysis outputs (key differentiator)
 * 3) Directory - CRM entities
 */
export const APP_SIDEBAR_SECTIONS: AppSidebarSection[] = [
	{
		key: "discovery",
		title: "Discovery",
		items: [
			{
				key: "dashboard",
				title: "Dashboard",
				description: "Project overview",
				icon: Compass,
				to: (routes) => routes.projects.dashboard(),
			},
			{
				key: "objectives",
				title: "Objectives",
				description: "Research goals",
				icon: Target,
				to: (routes) => routes.projects.setup(),
			},
			{
				key: "conversations",
				title: "Conversations",
				description: "Calls, notes, uploads",
				icon: File,
				to: (routes) => routes.interviews.index(),
			},
			{
				key: "tasks",
				title: "Tasks",
				description: "Priorities & actions",
				icon: CheckSquare,
				to: (routes) => routes.priorities(),
			},
		],
	},
	{
		key: "results",
		title: "Results",
		items: [
			{
				key: "lenses",
				title: "Lens Library",
				description: "Configure analysis lenses",
				icon: Glasses,
				to: (routes) => routes.lensLibrary(),
			},
			{
				key: "sales-bant",
				title: "Sales BANT",
				description: "Deal qualification",
				icon: DollarSign,
				to: (routes) => routes.lenses.salesBant(),
			},
			{
				key: "customer-discovery",
				title: "Customer Discovery",
				description: "Problem validation",
				icon: Search,
				to: (routes) => routes.lenses.customerDiscovery(),
			},
			{
				key: "product-lens",
				title: "ICP Discovery",
				description: "Pain × user matrix",
				icon: Grid3x3,
				to: (routes) => routes.productLens(),
			},
			{
				key: "topics",
				title: "Themes",
				description: "Signals & patterns",
				icon: Sparkles,
				to: (routes) => routes.themes.index(),
			},
			{
				key: "personas",
				title: "Personas",
				description: "User segments",
				icon: UserCircle,
				to: (routes) => routes.personas.index(),
			},
			{
				key: "insights",
				title: "Findings",
				description: "Published insights",
				icon: Lightbulb,
				to: (routes) => routes.insights.index(),
			},
		],
	},
	{
		key: "directory",
		title: "Directory",
		items: [
			{
				key: "people",
				title: "People",
				description: "All individuals",
				icon: Users,
				to: (routes) => routes.people.index(),
			},
			{
				key: "organizations",
				title: "Organizations",
				description: "Companies & groups",
				icon: Building2,
				to: (routes) => routes.organizations.index(),
			},
			{
				key: "opportunities",
				title: "Opportunities",
				description: "Sales pipeline",
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
