import type { LucideIcon } from "lucide-react"
import {
	BookOpen,
	Building2,
	Compass,
	File,
	Lightbulb,
	ListChecks,
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
				title: "Guide",
				description: "Interview & prompt sets",
				icon: ListChecks,
				to: (routes) => routes.questions.index(),
			},
			{
				// keep key "conversations" for count mapping; label is Encounters
				key: "conversations",
				title: "Encounters",
				description: "Calls, meetings, uploads",
				icon: File,
				to: (routes) => routes.interviews.index(),
			},
		],
	},
	{
		key: "analyze",
		title: "Analyze",
		items: [
			{
				key: "personas",
				title: "Personas",
				description: "Segments & patterns",
				icon: UserCircle,
				to: (routes) => routes.personas.index(),
			},
			{
				key: "topics",
				title: "Topics",
				description: "Signals & themes",
				icon: Sparkles,
				to: (routes) => routes.themes.index(),
			},
			{
				key: "insights",
				title: "Findings",
				description: "Published insights & next steps",
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
				to: (routes) => routes.people.index(), // implement tab switching inside the page
			},
			{
				key: "organizations",
				title: "Organizations",
				description: "Companies & groups",
				icon: Building2,
				// Simple deep-link via query param (adjust if you add a helper)
				to: (routes) => `${routes.people.index()}?tab=orgs`,
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
