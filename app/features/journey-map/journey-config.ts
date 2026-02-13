/**
 * Static configuration defining journey phases, cards, and completion criteria.
 * Maps card completion to sidebar count keys and card CTAs to route definitions.
 */

import type { LucideIcon } from "lucide-react";
import {
  CheckCircle,
  FileText,
  FolderOpen,
  Layers,
  Lightbulb,
  Link2,
  Mic,
  Settings,
  Share2,
  Upload,
  Users,
} from "lucide-react";
import type { RouteDefinitions } from "~/utils/route-definitions";

export type PhaseState = "completed" | "active" | "upcoming" | "locked";

export interface JourneyCardConfig {
  id: string;
  title: string;
  icon: LucideIcon;
  cta: string;
  /** Function that returns route from route definitions */
  getRoute: (routes: RouteDefinitions) => string;
  /** Key from useSidebarCounts to check completion */
  completionKey?: string;
  /** Alternative: custom completion check function */
  completionCheck?: (
    counts: Record<string, number | undefined>,
    journeyProgress: {
      contextComplete: boolean;
      promptsComplete: boolean;
      hasConversations: boolean;
      hasInsights: boolean;
    },
  ) => boolean;
}

export interface JourneyPhaseConfig {
  id: string;
  number: number;
  title: string;
  icon: LucideIcon;
  cards: JourneyCardConfig[];
  /** Check if this phase is complete using counts + journey progress */
  isComplete: (
    counts: Record<string, number | undefined>,
    journeyProgress: {
      contextComplete: boolean;
      promptsComplete: boolean;
      hasConversations: boolean;
      hasInsights: boolean;
    },
  ) => boolean;
}

export const JOURNEY_PHASES: JourneyPhaseConfig[] = [
  {
    id: "setup",
    number: 1,
    title: "Get Set Up",
    icon: Settings,
    isComplete: (counts, jp) =>
      jp.contextComplete &&
      jp.promptsComplete &&
      (counts.surveyResponses ?? 0) > 0 &&
      (counts.people ?? 0) > 0,
    cards: [
      {
        id: "context-goals",
        title: "Context & Goals",
        icon: Settings,
        cta: "Set Up",
        getRoute: (routes) => routes.projects.setup(),
        completionCheck: (_counts, jp) =>
          jp.contextComplete && jp.promptsComplete,
      },
      {
        id: "create-survey",
        title: "Create a survey",
        icon: Link2,
        cta: "Create Survey",
        getRoute: (routes) => routes.ask.new(),
        completionKey: "surveyResponses",
      },
      {
        id: "upload-contacts",
        title: "Upload contacts",
        icon: Users,
        cta: "Add Contacts",
        getRoute: (routes) => routes.people.index(),
        completionKey: "people",
      },
    ],
  },
  {
    id: "gather",
    number: 2,
    title: "Gather Sources",
    icon: Upload,
    isComplete: (counts) => (counts.encounters ?? 0) >= 3,
    cards: [
      {
        id: "upload-conversation",
        title: "Upload a conversation",
        icon: Upload,
        cta: "Upload",
        getRoute: (routes) => routes.interviews.upload(),
        completionKey: "encounters",
      },
      {
        id: "run-interview",
        title: "Run an interview",
        icon: Mic,
        cta: "Start Interview",
        getRoute: (routes) => routes.interviews.index(),
        completionCheck: (counts) => (counts.encounters ?? 0) >= 3,
      },
      {
        id: "add-notes-files",
        title: "Add notes & files",
        icon: FolderOpen,
        cta: "Add Notes",
        getRoute: (routes) => routes.sources.index(),
        completionKey: "content",
      },
      {
        id: "review-evidence",
        title: "Review what AI found",
        icon: Lightbulb,
        cta: "View Evidence",
        getRoute: (routes) => routes.evidence.index(),
        completionCheck: (counts) => (counts.encounters ?? 0) >= 1,
      },
    ],
  },
  {
    id: "patterns",
    number: 3,
    title: "Find Patterns",
    icon: Layers,
    isComplete: (counts) =>
      (counts.themes ?? 0) > 0 && (counts.insights ?? 0) > 0,
    cards: [
      {
        id: "explore-themes",
        title: "Explore themes & insights",
        icon: Layers,
        cta: "Explore",
        getRoute: (routes) => routes.insights.table(),
        completionKey: "themes",
      },
      {
        id: "create-insight",
        title: "Create your first insight",
        icon: Lightbulb,
        cta: "Create Insight",
        getRoute: (routes) => routes.insights.new(),
        completionKey: "insights",
      },
    ],
  },
  {
    id: "action",
    number: 4,
    title: "Take Action",
    icon: CheckCircle,
    isComplete: (counts) => (counts.highPriorityTasks ?? 0) > 0,
    cards: [
      {
        id: "share-finding",
        title: "Share a finding",
        icon: Share2,
        cta: "Share",
        getRoute: (routes) => routes.insights.table(),
        completionCheck: () => false,
      },
      {
        id: "create-task",
        title: "Create a task from an insight",
        icon: CheckCircle,
        cta: "Create Task",
        getRoute: (routes) => routes.priorities(),
        completionKey: "highPriorityTasks",
      },
    ],
  },
];

// --- Steps to Wow configuration ---

export type WowPath = "discover" | "reach_out";

export interface WowStepConfig {
  title: string;
  description: string;
  cta: string;
  timeHint?: string;
  getRoute: (routes: RouteDefinitions) => string;
  /** Key from useSidebarCounts to check completion (value > 0 means done) */
  completionKey: string;
}

export interface WowPathConfig {
  label: string;
  tagline: string;
  accentColor: string;
  steps: WowStepConfig[];
}

export const WOW_PATHS: Record<WowPath, WowPathConfig> = {
  discover: {
    label: "Discover",
    tagline: "Upload a conversation, see AI findings, click for receipts",
    accentColor: "blue",
    steps: [
      {
        title: "Upload a conversation",
        description:
          "Drop in a recording, transcript, or notes. AI analyzes immediately.",
        cta: "Upload now",
        timeHint: "30 sec",
        getRoute: (routes) => routes.interviews.upload(),
        completionKey: "encounters",
      },
      {
        title: "See what AI found",
        description:
          "Themes, pain points, and opportunities — each linked to exact quotes.",
        cta: "View evidence",
        timeHint: "~2 min",
        getRoute: (routes) => routes.evidence.index(),
        completionKey: "themes",
      },
      {
        title: "Click an insight — see the receipts",
        description: "Every claim traces back to who said it, when, and why.",
        cta: "Explore insights",
        getRoute: (routes) => routes.insights.table(),
        completionKey: "insights",
      },
    ],
  },
  reach_out: {
    label: "Reach Out",
    tagline: "Send a smart survey, watch responses, see patterns",
    accentColor: "amber",
    steps: [
      {
        title: "Send a smart survey",
        description:
          "Tell AI what you want to learn and get personalized multimedia questions in a shareable link.",
        cta: "Create survey",
        timeHint: "2 min",
        getRoute: (routes) => routes.ask.new(),
        completionKey: "surveys",
      },
      {
        title: "Watch responses roll in",
        description:
          "Share the link anywhere. AI analyzes each answer as it arrives.",
        cta: "View responses",
        getRoute: (routes) => routes.ask.index(),
        completionKey: "surveyResponses",
      },
      {
        title: "See patterns with receipts",
        description:
          "Themes and opportunities extracted automatically, each linked to who said it.",
        cta: "Explore insights",
        getRoute: (routes) => routes.insights.table(),
        completionKey: "themes",
      },
    ],
  },
};

export interface WowSettings {
  wow_path?: WowPath | "full_setup" | null;
  wow_steps_completed?: number[];
}

/** Get total number of cards across all phases */
export function getTotalCards(): number {
  return JOURNEY_PHASES.reduce((sum, phase) => sum + phase.cards.length, 0);
}

/** Check if a card is complete */
export function isCardComplete(
  card: JourneyCardConfig,
  counts: Record<string, number | undefined>,
  journeyProgress: {
    contextComplete: boolean;
    promptsComplete: boolean;
    hasConversations: boolean;
    hasInsights: boolean;
  },
): boolean {
  if (card.completionCheck) {
    return card.completionCheck(counts, journeyProgress);
  }
  if (card.completionKey) {
    return (counts[card.completionKey] ?? 0) > 0;
  }
  return false;
}

/** Get the number of completed cards across all phases */
export function getCompletedCardCount(
  counts: Record<string, number | undefined>,
  journeyProgress: {
    contextComplete: boolean;
    promptsComplete: boolean;
    hasConversations: boolean;
    hasInsights: boolean;
  },
): number {
  return JOURNEY_PHASES.reduce((sum, phase) => {
    return (
      sum +
      phase.cards.filter((card) =>
        isCardComplete(card, counts, journeyProgress),
      ).length
    );
  }, 0);
}

/** Determine the state of each phase */
export function getPhaseState(
  phaseIndex: number,
  counts: Record<string, number | undefined>,
  journeyProgress: {
    contextComplete: boolean;
    promptsComplete: boolean;
    hasConversations: boolean;
    hasInsights: boolean;
  },
): PhaseState {
  const phases = JOURNEY_PHASES;

  // Check if this phase is complete
  if (phases[phaseIndex].isComplete(counts, journeyProgress)) {
    return "completed";
  }

  // Check if this is the first incomplete phase (active)
  for (let i = 0; i < phaseIndex; i++) {
    if (!phases[i].isComplete(counts, journeyProgress)) {
      // A previous phase is incomplete, so this one is upcoming or locked
      return phaseIndex - i > 1 ? "locked" : "upcoming";
    }
  }

  // All previous phases complete, this is active
  return "active";
}
