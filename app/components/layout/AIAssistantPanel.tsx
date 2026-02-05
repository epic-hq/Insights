/**
 * AIAssistantPanel - Collapsible AI assistant sidebar panel
 *
 * Features:
 * - Collapsible panel (384px expanded, 48px collapsed)
 * - Dismissable "Next Steps" card with smart prioritized tasks
 * - Integrated chat (no redundant header)
 */

import {
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { ProjectStatusAgentChat } from "~/components/chat/ProjectStatusAgentChat";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { useProjectRoutesFromIds } from "~/hooks/useProjectRoutes";
import { useSidebarCounts } from "~/hooks/useSidebarCounts";
import { cn } from "~/lib/utils";
import type { RouteDefinitions } from "~/utils/route-definitions";

interface AIAssistantPanelProps {
  /** Whether the panel is open/expanded */
  isOpen: boolean;
  /** Callback when panel open state changes */
  onOpenChange: (open: boolean) => void;
  /** Accounts for team switcher */
  accounts?: Array<{
    account_id: string;
    name?: string | null;
    personal_account?: boolean | null;
  }>;
  /** System context for AI chat */
  systemContext?: string;
  /** Additional CSS classes */
  className?: string;
  /** When true, don't persist panel open/close state to localStorage (used during welcome flow) */
  suppressPersistence?: boolean;
}

interface TaskItem {
  title: string;
  link: string;
}

function getTopTasks(
  routes: RouteDefinitions,
  counts: Record<string, number | undefined>,
): TaskItem[] {
  const tasks: TaskItem[] = [];
  const surveyResponses = counts.surveyResponses ?? 0;
  const highPriorityTasks = counts.highPriorityTasks ?? 0;
  const encounters = counts.encounters ?? 0;
  const themes = counts.themes ?? 0;
  const insights = counts.insights ?? 0;
  const people = counts.people ?? 0;

  // Priority 1: Actionable items that need attention
  if (surveyResponses > 0) {
    tasks.push({
      title: `Review ${surveyResponses} new survey response${surveyResponses > 1 ? "s" : ""}`,
      link: routes.ask.index(),
    });
  }

  if (highPriorityTasks > 0) {
    tasks.push({
      title: `${highPriorityTasks} priority task${highPriorityTasks > 1 ? "s" : ""} this week`,
      link: routes.priorities(),
    });
  }

  // Priority 2: Progress-based suggestions
  if (encounters > 0 && themes === 0) {
    tasks.push({
      title: `${encounters} conversation${encounters > 1 ? "s" : ""} ready — run analysis to find themes`,
      link: routes.interviews.index(),
    });
  } else if (themes > 0 && insights === 0) {
    tasks.push({
      title: `${themes} theme${themes > 1 ? "s" : ""} found — generate your first insight`,
      link: routes.insights.table(),
    });
  } else if (themes > 0 && encounters >= 3 && insights > 0) {
    tasks.push({
      title: `${themes} theme${themes > 1 ? "s" : ""} across ${encounters} conversations — synthesize findings`,
      link: routes.insights.table(),
    });
  }

  // Priority 3: Growth nudges
  if (people > 0 && tasks.length < 3) {
    tasks.push({
      title: `${people} contact${people > 1 ? "s" : ""} tracked — review & segment`,
      link: routes.people.index(),
    });
  }

  // Fallback: Get started
  if (tasks.length === 0) {
    tasks.push({
      title: "Upload a conversation or create a survey to get started",
      link: routes.interviews.upload(),
    });
  }

  return tasks.slice(0, 3);
}

interface TopTasksProps {
  routes: RouteDefinitions;
  counts: Record<string, number | undefined>;
}

function TopTasks({ routes, counts }: TopTasksProps) {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("ai-panel-tasks-dismissed") === "true";
  });

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    localStorage.setItem("ai-panel-tasks-dismissed", "true");
  }, []);

  const handleShow = useCallback(() => {
    setDismissed(false);
    localStorage.setItem("ai-panel-tasks-dismissed", "false");
  }, []);

  const tasks = getTopTasks(routes, counts);

  if (dismissed) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={handleShow}
        className="justify-start gap-2 text-muted-foreground"
      >
        <CheckSquare className="h-4 w-4" />
        Next steps
      </Button>
    );
  }

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium text-xs text-muted-foreground uppercase tracking-wider">
          Next Steps
        </span>
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded p-0.5 text-muted-foreground hover:text-foreground"
          title="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <ul className="space-y-1.5">
        {tasks.map((task) => (
          <li key={task.link}>
            <Link
              to={task.link}
              className="block rounded-md px-2 py-1.5 text-sm text-primary transition-colors hover:bg-primary/10 hover:underline"
            >
              {task.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AIAssistantPanel({
  isOpen,
  onOpenChange,
  accounts = [],
  systemContext = "",
  className,
  suppressPersistence = false,
}: AIAssistantPanelProps) {
  const params = useParams();
  const accountId = params.accountId || "";
  const projectId = params.projectId || "";
  const projectPath =
    accountId && projectId ? `/a/${accountId}/${projectId}` : "";
  const routes = useProjectRoutesFromIds(accountId, projectId);
  const { counts } = useSidebarCounts(accountId, projectId);

  // Persist panel state to localStorage (skip during welcome flow to avoid overwriting user's preference)
  useEffect(() => {
    if (typeof window !== "undefined" && !suppressPersistence) {
      localStorage.setItem("ai-panel-open", String(isOpen));
    }
  }, [isOpen, suppressPersistence]);

  const handleToggle = useCallback(() => {
    onOpenChange(!isOpen);
  }, [isOpen, onOpenChange]);

  // Collapsed state - just show icon strip
  if (!isOpen) {
    return (
      <div
        className={cn(
          "flex h-full w-12 flex-col items-center border-r bg-muted/50 py-4 shadow-[1px_0_6px_-2px_rgba(0,0,0,0.06)]",
          className,
        )}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={handleToggle}
          className="mb-4"
          title="Expand Uppy Assistant"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        <div className="flex flex-col items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleToggle}
            className="relative"
            title="Open Uppy Assistant"
          >
            <Sparkles className="h-5 w-5 text-primary" />
            {(counts.highPriorityTasks ?? 0) > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center p-0 text-[10px]"
              >
                {counts.highPriorityTasks}
              </Badge>
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleToggle}
            title="Search"
          >
            <Search className="h-5 w-5 text-muted-foreground" />
          </Button>
        </div>
      </div>
    );
  }

  // Expanded state - full panel
  return (
    <div
      className={cn(
        "flex h-full w-96 flex-col border-r bg-muted/50 shadow-[1px_0_6px_-2px_rgba(0,0,0,0.06)]",
        className,
      )}
    >
      {/* Header with collapse button */}
      <div className="flex items-center justify-between border-b bg-background/60 p-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="font-semibold text-sm">Uppy Assistant</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleToggle}
          className="h-8 w-8"
          title="Collapse panel"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      {/* Content area */}
      <div className="flex flex-1 flex-col gap-2 overflow-hidden p-3">
        {/* Dismissable cards */}
        <div className="flex flex-col gap-2">
          {projectPath && <TopTasks routes={routes} counts={counts} />}
        </div>

        {/* Chat - goes directly into chat interface, no extra header */}
        {accountId && projectId && (
          <div className="min-h-0 flex-1">
            <ProjectStatusAgentChat
              accountId={accountId}
              projectId={projectId}
              systemContext={systemContext}
              embedded
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default AIAssistantPanel;
