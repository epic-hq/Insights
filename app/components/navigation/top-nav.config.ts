/**
 * Top Navigation Configuration
 *
 * Defines the horizontal navigation structure with mega-menu dropdowns.
 * Categories: Plan, Sources, Insights, CRM
 */

import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Briefcase,
  Building2,
  CheckSquare,
  Compass,
  FileText,
  FolderOpen,
  Glasses,
  Lightbulb,
  Map,
  MessageSquare,
  ScrollText,
  Settings,
  Sparkles,
  Target,
  Upload,
  Users,
} from "lucide-react";
import type { RouteDefinitions } from "~/utils/route-definitions";

export interface TopNavItem {
  key: string;
  title: string;
  description?: string;
  icon: LucideIcon;
  to: (routes: RouteDefinitions) => string;
  /** Badge count key for displaying counts */
  countKey?: string;
  /** PostHog feature flag key — item hidden when flag is off */
  featureFlag?: string;
}

export interface TopNavCategory {
  key: string;
  title: string;
  description: string;
  icon: LucideIcon;
  items: TopNavItem[];
}

/**
 * Top navigation categories with mega-menu items
 */
export const TOP_NAV_CATEGORIES: TopNavCategory[] = [
  {
    key: "plan",
    title: "Plan",
    icon: Compass,
    description:
      "Set up your research: context, goals, interview guides, priorities",
    items: [
      {
        key: "context",
        title: "Context",
        description: "Company background and market info",
        icon: Building2,
        to: (routes) => routes.projects.setup(),
      },
      {
        key: "goals",
        title: "Research Goals",
        description: "What you want to learn",
        icon: Target,
        to: (routes) => routes.projects.setup(),
      },
      {
        key: "prompts",
        title: "Interview Prompts",
        description: "Conversation guides and questions",
        icon: MessageSquare,
        to: (routes) => routes.questions.index(),
      },
      {
        key: "surveys",
        title: "Create a Survey",
        description: "Collect responses via shareable links",
        icon: ScrollText,
        to: (routes) => routes.ask.new(),
      },
      {
        key: "journey",
        title: "Your Journey",
        description: "Track your research progress",
        icon: Map,
        to: (routes) => routes.journey(),
        featureFlag: "ffYourJourney",
      },
    ],
  },
  {
    key: "sources",
    title: "Sources",
    icon: Upload,
    description: "Your raw materials: conversations, surveys, notes, documents",
    items: [
      {
        key: "conversations",
        title: "Conversations",
        description: "Interviews, meetings, and calls",
        icon: MessageSquare,
        to: (routes) => routes.interviews.index(),
        countKey: "encounters",
      },
      {
        key: "notes-files",
        title: "Notes & Files",
        description: "Quick notes, documents, and uploaded files",
        icon: FolderOpen,
        to: (routes) => routes.sources.index(),
        countKey: "content",
      },
      {
        key: "surveys",
        title: "Surveys",
        description: "Create surveys and view responses",
        icon: ScrollText,
        to: (routes) => routes.ask.index(),
      },
    ],
  },
  {
    key: "insights",
    title: "Insights",
    icon: Lightbulb,
    description: "What you've learned: themes, findings, analysis",
    items: [
      {
        key: "themes",
        title: "Top Themes",
        description: "Patterns emerging from your research",
        icon: Lightbulb,
        to: (routes) => routes.insights.table(),
        countKey: "themes",
      },
      {
        key: "evidence",
        title: "Evidence",
        description: "Quotes and moments from your conversations",
        icon: FileText,
        to: (routes) => routes.evidence.index(),
        countKey: "evidence",
      },
      {
        key: "analysis",
        title: "Analysis",
        description: "Cross-lens insights by person and topic",
        icon: Glasses,
        to: (routes) => routes.lenses.library(),
      },
      // Reports page not yet implemented - hiding until shared views feature is built
      // {
      //   key: "reports",
      //   title: "Reports",
      //   description: "Share findings with your team",
      //   icon: BookOpen,
      //   to: (routes) => routes.insights.cards(),
      // },
    ],
  },
  {
    key: "crm",
    title: "CRM",
    icon: Users,
    description: "Who you're talking to: people, companies, opportunities",
    items: [
      {
        key: "people",
        title: "People",
        description: "Contacts and participants",
        icon: Users,
        to: (routes) => routes.people.index(),
        countKey: "people",
      },
      {
        key: "organizations",
        title: "Organizations",
        description: "Companies and accounts",
        icon: Building2,
        to: (routes) => routes.organizations.index(),
        countKey: "organizations",
      },
      {
        key: "opportunities",
        title: "Opportunities",
        description: "Deals and pipeline",
        icon: Briefcase,
        to: (routes) => routes.opportunities.index(),
        countKey: "opportunities",
      },
      {
        key: "tasks",
        title: "Tasks",
        description: "Research priorities this week",
        icon: CheckSquare,
        to: (routes) => routes.priorities(),
        countKey: "highPriorityTasks",
      },
    ],
  },
];

/**
 * Utility nav items (right side of top nav)
 */
export const TOP_NAV_UTILITY_ITEMS: TopNavItem[] = [
  {
    key: "settings",
    title: "Settings",
    icon: Settings,
    to: (routes) => routes.projects.setup(),
  },
];
