import type { LucideIcon } from "lucide-react"
import {
	BookOpen,
	Compass,
	File,
	Home,
	Lightbulb,
	ListChecks,
	Mic,
	Sparkles,
	Target,
	UserCircle,
	Users,
} from "lucide-react"
import type { RouteDefinitions } from "~/utils/route-definitions"

interface AppSidebarNavItem {
	key: string
	title: string
	description?: string
	icon: LucideIcon
	to: (routes: RouteDefinitions) => string
}

interface AppSidebarSection {
	key: string
	title: string
	items: AppSidebarNavItem[]
}

export const APP_SIDEBAR_SECTIONS: AppSidebarSection[] = [
	{
		key: "home",
		title: "Home",
		items: [
			{
				key: "dashboard",
				title: "Home",
				icon: Home,
				to: (routes) => routes.dashboard(),
			},
		],
	},
	{
		key: "plan",
		title: "Plan",
		items: [
			{
				key: "research-goal",
				title: "Research Goal",
				description: "Set objectives & success signals",
				icon: Target,
				to: (routes) => routes.projects.setup(),
			},
			{
				key: "interview-questions",
				title: "Interview Questions",
				description: "Design prompts for interviews",
				icon: ListChecks,
				to: (routes) => routes.questions.index(),
			},
		],
	},
	{
		key: "engage",
		title: "Connect",
		items: [
			{
				key: "people",
				title: "People",
				description: "See who you met",
				icon: Users,
				to: (routes) => routes.people.index(),
			},
			{
				key: "record-upload-media",
				title: "Record or Upload",
				description: "Import calls, clips & decks",
				icon: Mic,
				to: (routes) => routes.interviews.upload(),
			},
			{
				key: "interactions",
				title: "Interactions",
				description: "See what you recorded",
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
				key: "status",
				title: "Status",
				description: "Running Report",
				icon: Compass,
				to: (routes) => routes.projects.dashboard(),
			},
			{
				key: "personas",
				title: "Personas",
				description: "Group patterns by segment",
				icon: UserCircle,
				to: (routes) => routes.personas.index(),
			},
			{
				key: "themes",
				title: "Themes",
				description: "Track signals & resonance",
				icon: Sparkles,
				to: (routes) => routes.themes.index(),
			},
			{
				key: "insights",
				title: "Insights",
				description: "Publish findings & next steps",
				icon: Lightbulb,
				to: (routes) => routes.insights.index(),
			},
		],
	},
]

export const APP_SIDEBAR_UTILITY_LINKS: AppSidebarNavItem[] = [
	{
		key: "docs",
		title: "Docs",
		description: "Documentation & Help",
		icon: BookOpen,
		to: (routes) => routes.docs(),
	},
]
