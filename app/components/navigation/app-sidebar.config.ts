import type { LucideIcon } from "lucide-react";
import {
	BookOpen,
	Briefcase,
	CheckSquare,
	File,
	FolderOpen,
	Glasses,
	Home,
	Link2,
	Map,
	MessageSquareText,
	Sparkles,
	Tag,
	Users,
} from "lucide-react";
import type { RouteDefinitions } from "~/utils/route-definitions";

export interface AppSidebarNavItem {
	key: string;
	title: string;
	description?: string;
	icon: LucideIcon;
	to: (routes: RouteDefinitions) => string;
	featureFlag?: string;
}

export interface AppSidebarSection {
	key: string;
	title: string;
	items: AppSidebarNavItem[];
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
				key: "journey",
				title: "Journey",
				description: "Your research journey progress map.",
				icon: Map,
				to: (routes) => routes.journey(),
				featureFlag: "ffYourJourney",
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
				description: "Interviews, meetings, and calls.",
				icon: File,
				to: (routes) => routes.interviews.index(),
			},
			{
				key: "notes-files",
				title: "Notes & Files",
				description: "Quick notes, documents, and uploaded files.",
				icon: FolderOpen,
				to: (routes) => routes.sources.index(),
			},
			{
				key: "responses",
				title: "Responses",
				description: "Survey and chat responses.",
				icon: MessageSquareText,
				to: (routes) => routes.responses.index(),
			},
			{
				key: "ask",
				title: "Surveys",
				description: "Send shareable links to collect responses.",
				icon: Link2,
				to: (routes) => routes.ask.index(),
			},
			{
				key: "lenses",
				title: "Analysis",
				description: "Cross-lens insights by person and topic.",
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
				key: "vocabulary",
				title: "Vocabulary",
				description: "AI-discovered labels from your conversations.",
				icon: Tag,
				to: (routes) => routes.facetsExplorer(),
			},
			{
				key: "opportunities",
				title: "Opportunities",
				description: "Improve deal hygiene and outcomes.",
				icon: Briefcase,
				to: (routes) => routes.opportunities.index(),
			},
			{
				key: "tasks",
				title: "Tasks",
				description: "Top focus tasks for the next 7 days.",
				icon: CheckSquare,
				to: (routes) => routes.priorities(),
			},
		],
	},
];

/** Footer / global utilities (Directory removed to avoid duplication) */
export const APP_SIDEBAR_UTILITY_LINKS: AppSidebarNavItem[] = [
	{
		key: "docs",
		title: "Docs",
		description: "How UpSight works.",
		icon: BookOpen,
		to: (routes) => routes.docs(),
	},
];
