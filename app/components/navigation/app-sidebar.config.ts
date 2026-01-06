import type { LucideIcon } from "lucide-react"
import { BookOpen, Briefcase, CheckSquare, File, Glasses, Home, Settings, Sparkles, Users } from "lucide-react"
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
				description: "Your workspace at a glance.",
				icon: Home,
				to: (routes) => routes.dashboard(),
			},
			{
				key: "relationships",
				title: "Contacts",
				description: "Key people and organizations we serve.",
				icon: Users,
				to: (routes) => routes.people.index(),
			},
			{
				key: "content",
				title: "Conversations",
				description: "Add conversations, notes, docs, or recordings.",
				icon: File,
				to: (routes) => routes.interviews.index(),
			},
			{
				key: "lenses",
				title: "Lenses",
				description: "Choose how to analyze your content.",
				icon: Glasses,
				to: (routes) => routes.lenses.library(),
			},
			{
				key: "insights",
				title: "Insights",
				description: "What we learned from your content.",
				icon: Sparkles,
				to: (routes) => routes.insights.table(),
			},
			{
				key: "tasks",
				title: "Tasks",
				description: "Top focus tasks for the next 7 days.",
				icon: CheckSquare,
				to: (routes) => routes.priorities(),
			},
			{
				key: "opportunities",
				title: "Opportunities",
				description: "Improve deal hygiene and outcomes.",
				icon: Briefcase,
				to: (routes) => routes.opportunities.index(),
			},
		],
	},
]

/** Footer / global utilities (Directory removed to avoid duplication) */
export const APP_SIDEBAR_UTILITY_LINKS: AppSidebarNavItem[] = [
	{
		key: "project-context",
		title: "Project Context",
		description: "Research goals, target audience, and background.",
		icon: Settings,
		to: (routes) => routes.projects.setup(),
	},
	{
		key: "docs",
		title: "Docs",
		description: "How UpSight works.",
		icon: BookOpen,
		to: (routes) => routes.docs(),
	},
]
