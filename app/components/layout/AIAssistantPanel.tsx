/**
 * AIAssistantPanel - Floating AI assistant widget
 *
 * Features:
 * - Collapsed: Prominent floating action button (bottom-left) with color pop
 * - Expanded: Floating panel overlay with chat, journey progress, and tasks
 * - Positioned outside the layout flow (fixed positioning)
 */

import {
  CheckSquare,
  ChevronDown,
  History,
  Map,
  Minus,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useFetcher } from "react-router";
import { ProjectStatusAgentChat } from "~/components/chat/ProjectStatusAgentChat";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { useCurrentProject } from "~/contexts/current-project-context";
import {
  getCompletedCardCount,
  getTotalCards,
} from "~/features/journey-map/journey-config";
import { useJourneyProgress } from "~/hooks/useJourneyProgress";
import { useProjectRoutesFromIds } from "~/hooks/useProjectRoutes";
import { useSidebarCounts } from "~/hooks/useSidebarCounts";
import { cn } from "~/lib/utils";
import type { RouteDefinitions } from "~/utils/route-definitions";

interface ChatThread {
  id: string;
  title: string;
  createdAt: string;
}

interface ChatThreadSelectorProps {
  accountId: string;
  projectId: string;
  onSelectThread: (threadId: string) => void;
  onNewChat: () => void;
}

function ChatThreadSelector({
  accountId,
  projectId,
  onSelectThread,
  onNewChat,
}: ChatThreadSelectorProps) {
  const threadsFetcher = useFetcher<{ threads: ChatThread[] }>();
  const [open, setOpen] = useState(false);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && threadsFetcher.state === "idle" && !threadsFetcher.data) {
      threadsFetcher.load(
        `/a/${accountId}/${projectId}/api/chat/project-status/threads`,
      );
    }
  };

  const threads = threadsFetcher.data?.threads ?? [];
  const isLoading = threadsFetcher.state === "loading";

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString();
    } catch {
      return "";
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-slate-400 hover:text-white"
          title="Chat history"
        >
          <History className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuItem
          onClick={() => {
            onNewChat();
            setOpen(false);
          }}
          className="gap-2 font-medium"
        >
          <Plus className="h-4 w-4" />
          New Chat
        </DropdownMenuItem>
        {threads.length > 0 && <DropdownMenuSeparator />}
        {isLoading && (
          <div className="px-2 py-2 text-center text-muted-foreground text-xs">
            Loading...
          </div>
        )}
        {!isLoading && threads.length === 0 && threadsFetcher.data && (
          <div className="px-2 py-2 text-center text-muted-foreground text-xs">
            No previous chats
          </div>
        )}
        {threads.map((thread) => (
          <DropdownMenuItem
            key={thread.id}
            onClick={() => {
              onSelectThread(thread.id);
              setOpen(false);
            }}
            className="flex flex-col items-start gap-0.5"
          >
            <span className="truncate text-sm">{thread.title}</span>
            <span className="text-muted-foreground text-xs">
              {formatDate(thread.createdAt)}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface JourneyProgressBarProps {
  routes: RouteDefinitions;
  counts: Record<string, number | undefined>;
  projectId: string;
}

function JourneyProgressBar({
  routes,
  counts,
  projectId,
}: JourneyProgressBarProps) {
  const { progress } = useJourneyProgress(projectId);
  const totalCards = getTotalCards();
  const completedCards = getCompletedCardCount(counts, progress);
  const progressPercent =
    totalCards > 0 ? Math.round((completedCards / totalCards) * 100) : 0;

  return (
    <Link
      to={routes.journey()}
      className="block rounded-lg border border-white/10 bg-white/5 p-2.5 transition-colors hover:bg-white/10"
    >
      <div className="mb-1.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Map className="h-3 w-3 text-blue-400" />
          <span className="font-medium text-slate-400 text-[10px] uppercase tracking-wider">
            Journey
          </span>
        </div>
        <span className="font-semibold text-blue-400 text-[10px]">
          {completedCards}/{totalCards}
        </span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-blue-500 transition-[width] duration-600"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </Link>
  );
}

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

  if (encounters > 0 && themes === 0) {
    tasks.push({
      title: `${encounters} conversation${encounters > 1 ? "s" : ""} ready — run analysis`,
      link: routes.interviews.index(),
    });
  } else if (themes > 0 && insights === 0) {
    tasks.push({
      title: `${themes} theme${themes > 1 ? "s" : ""} found — generate insights`,
      link: routes.insights.table(),
    });
  } else if (themes > 0 && encounters >= 3 && insights > 0) {
    tasks.push({
      title: `${themes} theme${themes > 1 ? "s" : ""} across ${encounters} conversations`,
      link: routes.insights.table(),
    });
  }

  if (people > 0 && tasks.length < 3) {
    tasks.push({
      title: `${people} contact${people > 1 ? "s" : ""} — review & segment`,
      link: routes.people.index(),
    });
  }

  if (tasks.length === 0) {
    tasks.push({
      title: "Upload a conversation or create a survey",
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
      <button
        type="button"
        onClick={handleShow}
        className="flex items-center gap-1.5 text-slate-400 text-xs hover:text-slate-200"
      >
        <CheckSquare className="h-3 w-3" />
        Show next steps
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="font-medium text-slate-400 text-[10px] uppercase tracking-wider">
          Next Steps
        </span>
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded p-0.5 text-slate-500 hover:text-slate-300"
          title="Dismiss"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      <ul className="space-y-0.5">
        {tasks.map((task) => (
          <li key={task.link}>
            <Link
              to={task.link}
              className="block rounded-md px-2 py-1 text-blue-400 text-xs transition-colors hover:bg-white/10 hover:text-blue-300"
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
  const { accountId, projectId, projectPath } = useCurrentProject();
  const routes = useProjectRoutesFromIds(accountId, projectId);
  const { counts } = useSidebarCounts(accountId, projectId);

  // Persist panel state to localStorage
  useEffect(() => {
    if (typeof window !== "undefined" && !suppressPersistence) {
      localStorage.setItem("ai-panel-open", String(isOpen));
    }
  }, [isOpen, suppressPersistence]);

  const handleToggle = useCallback(() => {
    onOpenChange(!isOpen);
  }, [isOpen, onOpenChange]);

  // Ref to the chat's clearChat function
  const clearChatRef = useRef<(() => void) | null>(null);
  const handleClearChatRef = useCallback((fn: (() => void) | null) => {
    clearChatRef.current = fn;
  }, []);

  // Ref to load a specific thread's messages
  const loadThreadRef = useRef<((threadId: string) => void) | null>(null);
  const handleLoadThreadRef = useCallback(
    (fn: ((threadId: string) => void) | null) => {
      loadThreadRef.current = fn;
    },
    [],
  );

  const handleNewChat = useCallback(() => {
    clearChatRef.current?.();
  }, []);

  const handleSelectThread = useCallback((threadId: string) => {
    loadThreadRef.current?.(threadId);
  }, []);

  const taskCount = counts.highPriorityTasks ?? 0;

  // Collapsed state — floating action button
  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={handleToggle}
        className={cn(
          "group fixed bottom-6 left-6 z-50 flex h-14 w-14 items-center justify-center",
          "rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700",
          "shadow-lg shadow-blue-600/25 ring-1 ring-white/20",
          "transition-all duration-200 hover:scale-105 hover:shadow-xl hover:shadow-blue-600/30",
          "active:scale-95",
          className,
        )}
        title="Open Uppy Assistant"
      >
        <Sparkles className="h-6 w-6 text-white transition-transform group-hover:rotate-12" />
        {taskCount > 0 && (
          <Badge
            variant="destructive"
            className="-top-1.5 -right-1.5 absolute flex h-5 w-5 items-center justify-center p-0 text-[10px]"
          >
            {taskCount}
          </Badge>
        )}
      </button>
    );
  }

  // Expanded state — floating panel overlay
  return (
    <div
      className={cn(
        "fixed bottom-6 left-6 z-50 flex w-[400px] flex-col",
        "rounded-2xl bg-slate-900 text-slate-100",
        "shadow-2xl shadow-black/40 ring-1 ring-white/10",
        "animate-in fade-in slide-in-from-bottom-4 duration-200",
        className,
      )}
      style={{ maxHeight: "calc(100vh - 120px)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="font-semibold text-sm text-white">
            Uppy Assistant
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          {accountId && projectId && (
            <ChatThreadSelector
              accountId={accountId}
              projectId={projectId}
              onSelectThread={handleSelectThread}
              onNewChat={handleNewChat}
            />
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNewChat}
            className="h-7 w-7 text-slate-400 hover:text-white"
            title="New chat"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleToggle}
            className="h-7 w-7 text-slate-400 hover:text-white"
            title="Minimize"
          >
            <Minus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* Journey progress + next steps (collapsible) */}
        <div className="flex flex-shrink-0 flex-col gap-2 border-b border-white/5 px-4 py-3">
          {projectId && (
            <JourneyProgressBar
              routes={routes}
              counts={counts}
              projectId={projectId}
            />
          )}
          {projectPath && <TopTasks routes={routes} counts={counts} />}
        </div>

        {/* Chat */}
        {accountId && projectId && (
          <div className="min-h-0 flex-1">
            <ProjectStatusAgentChat
              accountId={accountId}
              projectId={projectId}
              systemContext={systemContext}
              embedded
              onClearChatRef={handleClearChatRef}
              onLoadThreadRef={handleLoadThreadRef}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default AIAssistantPanel;
