import type { LucideIcon } from "lucide-react"
import { BookOpen, Briefcase, CheckSquare, File, Glasses, Home, Sparkles, Users } from "lucide-react"
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
				title: "Home",
				description: "Project overview",
				icon: Home,
				to: (routes) => routes.dashboard(),
			},
			{
				key: "content",
				title: "Content",
				description: "Conversations, notes, files",
				icon: File,
				to: (routes) => routes.interviews.index(),
			},
			{
				key: "insights",
				title: "Insights",
				description: "Add content to unlock",
				icon: Sparkles,
				to: (routes) => routes.insights.table(),
			},
			{
				key: "lenses",
				title: "Lenses",
				description: "Generate insights first",
				icon: Glasses,
				to: (routes) => routes.lenses.library(),
			},
			{
				key: "relationships",
				title: "Relationships",
				description: "People & organizations",
				icon: Users,
				to: (routes) => routes.people.index(),
			},
			{
				key: "opportunities",
				title: "Opportunities",
				description: "Track deals from relationships",
				icon: Briefcase,
				to: (routes) => routes.opportunities.index(),
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
