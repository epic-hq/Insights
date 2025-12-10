import type { LucideIcon } from "lucide-react"
import { BookOpen, Briefcase, Building2, CheckSquare, Compass, File, Glasses, Sparkles, Users } from "lucide-react"
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
 * Sidebar navigation - lean and focused
 * Single section with core navigation items
 */
export const APP_SIDEBAR_SECTIONS: AppSidebarSection[] = [
	{
		key: "main",
		title: "Main",
		items: [
			{
				key: "dashboard",
				title: "Dashboard",
				description: "Project overview",
				icon: Compass,
				to: (routes) => routes.dashboard(),
			},
			{
				key: "tasks",
				title: "Tasks",
				description: "Priorities & actions",
				icon: CheckSquare,
				to: (routes) => routes.priorities(),
			},
			{
				key: "insights",
				title: "Insights",
				description: "Themes & patterns",
				icon: Sparkles,
				to: (routes) => routes.insights.table(),
			},
			{
				key: "opportunities",
				title: "Opportunities",
				description: "Sales pipeline",
				icon: Briefcase,
				to: (routes) => routes.opportunities.index(),
			},
			{
				key: "organizations",
				title: "Organizations",
				description: "Companies & groups",
				icon: Building2,
				to: (routes) => routes.organizations.index(),
			},
			{
				key: "people",
				title: "People",
				description: "All individuals",
				icon: Users,
				to: (routes) => routes.people.index(),
			},
			{
				key: "conversations",
				title: "Conversations",
				description: "Calls, notes, uploads",
				icon: File,
				to: (routes) => routes.interviews.index(),
			},
			{
				key: "lenses",
				title: "Lenses",
				description: "Analysis templates",
				icon: Glasses,
				to: (routes) => routes.lenses.library(),
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
