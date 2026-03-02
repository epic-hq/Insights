/**
 * SplitPaneLayout - Agent-first layout
 *
 * Two layout states driven by whether the agent has active canvas content:
 *
 * State A — Agent Centered (no canvas):
 * ┌──────────────────────────────────┐
 * │           TopNavigation          │
 * ├──────────────────────────────────┤
 * │     ┌────────────────────┐      │
 * │     │  Agent Chat         │      │
 * │     │  (max-w-2xl)        │      │
 * │     └────────────────────┘      │
 * └──────────────────────────────────┘
 *
 * State B — Two Column (canvas has content):
 * ┌──────────────────────────────────┐
 * │           TopNavigation          │
 * ├──────────┬───────────────────────┤
 * │  Agent   │                       │
 * │  Chat    │  Canvas / Outlet      │
 * │  (380px) │                       │
 * └──────────┴───────────────────────┘
 *
 * Mobile: full-screen chat → tab-based Chat/Canvas when canvas is active.
 */

import { AnimatePresence, motion } from "framer-motion";
import {
  CheckSquare,
  History,
  Map,
  MessageSquare,
  Minus,
  PanelLeft,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  Outlet,
  useFetcher,
  useLocation,
  useRouteLoaderData,
  useSearchParams,
} from "react-router";
import {
  ProjectStatusAgentChat,
  type TTSState,
} from "~/components/chat/ProjectStatusAgentChat";
import { TTSToggle } from "~/components/chat/TTSToggle";
import { CanvasPanel } from "~/components/gen-ui/CanvasPanel";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { SidebarProvider } from "~/components/ui/sidebar";
import {
  A2UISurfaceProvider,
  useA2UISurfaceOptional,
} from "~/contexts/a2ui-surface-context";
import { useCurrentProject } from "~/contexts/current-project-context";
import {
  ProjectStatusAgentProvider,
  useProjectStatusAgent,
} from "~/contexts/project-status-agent-context";
import {
  getCompletedCardCount,
  getTotalCards,
} from "~/features/journey-map/journey-config";
import { useDeviceDetection } from "~/hooks/useDeviceDetection";
import { useJourneyProgress } from "~/hooks/useJourneyProgress";
import { useProjectRoutesFromIds } from "~/hooks/useProjectRoutes";
import { useSidebarCounts } from "~/hooks/useSidebarCounts";
import { cn } from "~/lib/utils";
import type { RouteDefinitions } from "~/utils/route-definitions";
import { BottomTabBar } from "../navigation/BottomTabBar";
import { TopNavigation } from "../navigation/TopNavigation";
import { useOnboarding } from "../onboarding";

// ─── Constants ───────────────────────────────────────────────────────────────

const AGENT_WIDTH_MIN = 360;
const AGENT_WIDTH_MAX = 600;
const AGENT_WIDTH_DEFAULT = 380;
const AGENT_WIDTH_KEY = "agent-column-width";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AccountRecord {
  account_id: string;
  name?: string | null;
  personal_account?: boolean | null;
  projects?: Array<{
    id: string;
    account_id: string;
    name?: string | null;
    slug?: string | null;
  }> | null;
}

interface ProtectedLayoutData {
  accounts?: AccountRecord[] | null;
  user_settings?: {
    last_used_account_id?: string | null;
    last_used_project_id?: string | null;
  } | null;
}

interface SplitPaneLayoutProps {
  systemContext?: string;
  showJourneyNav?: boolean;
}

// ─── Spring transition config ────────────────────────────────────────────────

const layoutSpring = {
  type: "spring" as const,
  stiffness: 300,
  damping: 30,
  mass: 0.8,
};

// ─── Main Layout ─────────────────────────────────────────────────────────────

export function SplitPaneLayout({
  systemContext = "",
  showJourneyNav = true,
}: SplitPaneLayoutProps) {
  const { isMobile } = useDeviceDetection();
  const [searchParams] = useSearchParams();
  const { accountId, projectId } = useCurrentProject();
  const protectedData = useRouteLoaderData(
    "routes/_ProtectedLayout",
  ) as ProtectedLayoutData | null;
  const { aiContext: onboardingContext } = useOnboarding();

  const combinedSystemContext = [systemContext, onboardingContext]
    .filter(Boolean)
    .join("\n\n");

  const isOnboarding = searchParams.get("onboarding") === "true";
  const isWelcomeFlow = searchParams.get("welcome") === "1";
  const showMainNav = !isOnboarding;
  const showMobileNav = isMobile && showJourneyNav && showMainNav;

  const accounts = protectedData?.accounts?.filter(Boolean) ?? [];

  return (
    <SidebarProvider>
      <ProjectStatusAgentProvider>
        <A2UISurfaceProvider>
          <div className="flex min-h-0 w-full flex-1 flex-col">
            {showMainNav && <TopNavigation accounts={accounts} />}

            {isMobile ? (
              <MobileLayout
                accountId={accountId}
                projectId={projectId}
                systemContext={combinedSystemContext}
                showMobileNav={showMobileNav}
              />
            ) : (
              <DesktopLayout
                accountId={accountId}
                projectId={projectId}
                systemContext={combinedSystemContext}
                showMainNav={showMainNav}
              />
            )}

            {showMobileNav && (
              <BottomTabBar
                routes={{
                  chat: `/a/${accountId}/${projectId}/assistant`,
                  upload: `/a/${accountId}/${projectId}/interviews/upload`,
                  people: `/a/${accountId}/${projectId}/people`,
                }}
              />
            )}
          </div>
        </A2UISurfaceProvider>
      </ProjectStatusAgentProvider>
    </SidebarProvider>
  );
}

// ─── Desktop Layout ──────────────────────────────────────────────────────────

function DesktopLayout({
  accountId,
  projectId,
  systemContext,
  showMainNav,
}: {
  accountId: string;
  projectId: string;
  systemContext: string;
  showMainNav: boolean;
}) {
  const a2ui = useA2UISurfaceOptional();
  const hasCanvas = a2ui?.hasCanvasContent ?? false;

  // Navigation-away tracking for right column
  const location = useLocation();
  const [userNavigatedAway, setUserNavigatedAway] = useState(false);
  const surfaceIdWhenShown = useRef<string | null>(null);

  useEffect(() => {
    if (a2ui?.isActive && surfaceIdWhenShown.current) {
      setUserNavigatedAway(true);
    }
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (a2ui?.isActive && a2ui.surface) {
      const currentId = a2ui.surface.surfaceId;
      if (currentId !== surfaceIdWhenShown.current) {
        surfaceIdWhenShown.current = currentId;
        setUserNavigatedAway(false);
      }
    }
    if (!a2ui?.isActive) {
      surfaceIdWhenShown.current = null;
      setUserNavigatedAway(false);
    }
  }, [a2ui?.isActive, a2ui?.surface, a2ui?.surface?.surfaceId]);

  const showCanvas = hasCanvas && !userNavigatedAway;

  // Detect if user is on a content page (not the project index/home)
  // Project base path: /a/:accountId/:projectId — if pathname has more segments, it's a content page
  const projectBasePath = `/a/${accountId}/${projectId}`;
  const isOnContentPage =
    location.pathname !== projectBasePath &&
    location.pathname !== `${projectBasePath}/` &&
    // Also treat assistant/project-chat as "home" (centered chat)
    !location.pathname.endsWith("/assistant") &&
    !location.pathname.endsWith("/project-chat");

  // Two-column mode: content page navigation OR canvas is active
  const isTwoColumn = hasCanvas || isOnContentPage;

  // Agent column width (persisted to localStorage)
  const [agentWidth, setAgentWidth] = useState(AGENT_WIDTH_DEFAULT);

  useEffect(() => {
    const stored = localStorage.getItem(AGENT_WIDTH_KEY);
    if (stored) {
      const parsed = Number.parseInt(stored, 10);
      if (
        !Number.isNaN(parsed) &&
        parsed >= AGENT_WIDTH_MIN &&
        parsed <= AGENT_WIDTH_MAX
      ) {
        setAgentWidth(parsed);
      }
    }
  }, []);

  // Resize drag handling
  const isResizing = useRef(false);
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isResizing.current = true;
      const startX = e.clientX;
      const startWidth = agentWidth;

      const onMouseMove = (ev: MouseEvent) => {
        const delta = ev.clientX - startX;
        const newWidth = Math.min(
          AGENT_WIDTH_MAX,
          Math.max(AGENT_WIDTH_MIN, startWidth + delta),
        );
        setAgentWidth(newWidth);
      };

      const onMouseUp = () => {
        isResizing.current = false;
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        setAgentWidth((w) => {
          localStorage.setItem(AGENT_WIDTH_KEY, String(w));
          return w;
        });
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [agentWidth],
  );

  return (
    <div className="flex min-h-0 flex-1">
      <AnimatePresence mode="wait" initial={false}>
        {isTwoColumn ? (
          // ── State B: Two-column layout ──
          <motion.div
            key="two-column"
            className="flex min-h-0 flex-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Agent column */}
            <motion.div
              className="relative flex min-h-0 flex-shrink-0 flex-col border-border border-r bg-slate-900/50"
              style={{ width: agentWidth }}
              layout
              transition={layoutSpring}
            >
              <AgentColumn
                accountId={accountId}
                projectId={projectId}
                systemContext={systemContext}
              />

              {/* Resize handle */}
              <div
                onMouseDown={handleResizeStart}
                className="group absolute top-0 right-0 z-10 h-full w-1.5 cursor-col-resize transition-colors hover:bg-primary/20"
                title="Drag to resize"
              >
                <div className="-translate-y-1/2 absolute top-1/2 right-0.5 h-8 w-0.5 rounded-full bg-white/20 opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
            </motion.div>

            {/* Right column: Canvas or Outlet */}
            <main className="flex min-h-0 flex-1 flex-col overflow-auto">
              {showCanvas ? <CanvasPanel /> : <Outlet />}
            </main>
          </motion.div>
        ) : (
          // ── State A: Agent centered ──
          <motion.main
            key="centered"
            className="flex min-h-0 flex-1 flex-col"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <AgentCentered
              accountId={accountId}
              projectId={projectId}
              systemContext={systemContext}
            />
          </motion.main>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Agent Centered (State A) ────────────────────────────────────────────────

function AgentCentered({
  accountId,
  projectId,
  systemContext,
}: {
  accountId: string;
  projectId: string;
  systemContext: string;
}) {
  const routes = useProjectRoutesFromIds(accountId, projectId);
  const { counts } = useSidebarCounts(accountId, projectId);

  const clearChatRef = useRef<(() => void) | null>(null);
  const loadThreadRef = useRef<((threadId: string) => void) | null>(null);
  const [ttsState, setTTSState] = useState<TTSState | null>(null);

  const handleNewChat = useCallback(() => {
    clearChatRef.current?.();
  }, []);

  const handleSelectThread = useCallback((threadId: string) => {
    loadThreadRef.current?.(threadId);
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center">
      <div className="flex min-h-0 w-full max-w-4xl flex-1 flex-col px-4">
        {/* Header bar */}
        <div className="flex flex-shrink-0 items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 shadow-blue-500/20 shadow-sm">
              <Sparkles className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-semibold text-sm">Uppy</span>
            {ttsState && (
              <TTSToggle
                isEnabled={ttsState.isEnabled}
                isPlaying={ttsState.isPlaying}
                isDisabledByVoiceChat={ttsState.isDisabledByVoiceChat}
                onToggle={ttsState.toggleEnabled}
              />
            )}
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
              className="h-7 w-7"
              title="New chat"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* TopTasks deprecated — agent suggestion badges replace this */}

        {/* Chat fills remaining space */}
        {accountId && projectId && (
          <div className="min-h-0 flex-1">
            <ProjectStatusAgentChat
              accountId={accountId}
              projectId={projectId}
              systemContext={systemContext}
              embedded
              onClearChatRef={(fn) => {
                clearChatRef.current = fn;
              }}
              onLoadThreadRef={(fn) => {
                loadThreadRef.current = fn;
              }}
              onTTSStateRef={setTTSState}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Agent Column (State B - left panel) ─────────────────────────────────────

function AgentColumn({
  accountId,
  projectId,
  systemContext,
}: {
  accountId: string;
  projectId: string;
  systemContext: string;
}) {
  const routes = useProjectRoutesFromIds(accountId, projectId);
  const { counts } = useSidebarCounts(accountId, projectId);

  const clearChatRef = useRef<(() => void) | null>(null);
  const loadThreadRef = useRef<((threadId: string) => void) | null>(null);
  const [ttsState, setTTSState] = useState<TTSState | null>(null);

  const handleNewChat = useCallback(() => {
    clearChatRef.current?.();
  }, []);

  const handleSelectThread = useCallback((threadId: string) => {
    loadThreadRef.current?.(threadId);
  }, []);

  return (
    <>
      {/* Header */}
      <div className="flex flex-shrink-0 items-center justify-between border-border border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-blue-500 to-indigo-600">
            <Sparkles className="h-3 w-3 text-white" />
          </div>
          <span className="font-semibold text-sm">Uppy</span>
          {ttsState && (
            <TTSToggle
              isEnabled={ttsState.isEnabled}
              isPlaying={ttsState.isPlaying}
              isDisabledByVoiceChat={ttsState.isDisabledByVoiceChat}
              onToggle={ttsState.toggleEnabled}
            />
          )}
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
            className="h-7 w-7"
            title="New chat"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* TopTasks deprecated — agent suggestion badges replace this */}

      {/* Chat */}
      {accountId && projectId && (
        <div className="min-h-0 flex-1">
          <ProjectStatusAgentChat
            accountId={accountId}
            projectId={projectId}
            systemContext={systemContext}
            embedded
            onClearChatRef={(fn) => {
              clearChatRef.current = fn;
            }}
            onLoadThreadRef={(fn) => {
              loadThreadRef.current = fn;
            }}
            onTTSStateRef={setTTSState}
          />
        </div>
      )}
    </>
  );
}

// ─── Mobile Layout ───────────────────────────────────────────────────────────

function MobileLayout({
  accountId,
  projectId,
  systemContext,
  showMobileNav,
}: {
  accountId: string;
  projectId: string;
  systemContext: string;
  showMobileNav: boolean;
}) {
  const a2ui = useA2UISurfaceOptional();
  const hasCanvas = a2ui?.hasCanvasContent ?? false;
  const [activeTab, setActiveTab] = useState<"chat" | "canvas">("chat");

  // Auto-switch to canvas when new content arrives
  useEffect(() => {
    if (hasCanvas) {
      setActiveTab("canvas");
    }
  }, [hasCanvas]);

  // Reset to chat when canvas goes away
  useEffect(() => {
    if (!hasCanvas) {
      setActiveTab("chat");
    }
  }, [hasCanvas]);

  const clearChatRef = useRef<(() => void) | null>(null);
  const loadThreadRef = useRef<((threadId: string) => void) | null>(null);

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col",
        showMobileNav ? "pb-[72px]" : "",
      )}
    >
      {/* Tab bar when canvas is active */}
      {hasCanvas && (
        <div className="flex flex-shrink-0 border-border border-b">
          <button
            type="button"
            onClick={() => setActiveTab("chat")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 px-4 py-2.5 text-sm transition-colors",
              activeTab === "chat"
                ? "border-primary border-b-2 font-semibold text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <MessageSquare className="h-4 w-4" />
            Chat
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("canvas")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 px-4 py-2.5 text-sm transition-colors",
              activeTab === "canvas"
                ? "border-primary border-b-2 font-semibold text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <PanelLeft className="h-4 w-4" />
            Canvas
          </button>
        </div>
      )}

      {/* Content */}
      {activeTab === "chat" || !hasCanvas ? (
        <div className="min-h-0 flex-1">
          {accountId && projectId && (
            <ProjectStatusAgentChat
              accountId={accountId}
              projectId={projectId}
              systemContext={systemContext}
              embedded
              onClearChatRef={(fn) => {
                clearChatRef.current = fn;
              }}
              onLoadThreadRef={(fn) => {
                loadThreadRef.current = fn;
              }}
            />
          )}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <CanvasPanel />
        </div>
      )}
    </div>
  );
}

// ─── Chat Thread Selector (extracted from AIAssistantPanel) ──────────────────

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
    if (isOpen && threadsFetcher.state === "idle") {
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
          className="h-7 w-7"
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

// ─── Top Tasks (extracted from AIAssistantPanel) ─────────────────────────────

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
  projectId?: string;
}

function TopTasks({ routes, counts, projectId }: TopTasksProps) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("ai-panel-tasks-dismissed") === "true") {
      setDismissed(true);
    }
  }, []);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    localStorage.setItem("ai-panel-tasks-dismissed", "true");
  }, []);

  const handleShow = useCallback(() => {
    setDismissed(false);
    localStorage.setItem("ai-panel-tasks-dismissed", "false");
  }, []);

  const tasks = getTopTasks(routes, counts);

  const { progress } = useJourneyProgress(projectId || "");
  const totalCards = getTotalCards();
  const completedCards = getCompletedCardCount(counts, progress);
  const progressPercent =
    totalCards > 0 ? Math.round((completedCards / totalCards) * 100) : 0;

  const journeyBadge = projectId ? (
    <Link
      to={routes.journey()}
      className="flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[10px] transition-colors hover:bg-muted"
      title="View journey map"
    >
      <Map className="h-2.5 w-2.5 text-blue-400" />
      <div className="flex items-center gap-1">
        <div className="h-1 w-12 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-blue-500 transition-[width] duration-600"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <span className="font-semibold text-blue-400">
          {completedCards}/{totalCards}
        </span>
      </div>
    </Link>
  ) : null;

  if (dismissed) {
    return (
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handleShow}
          className="flex items-center gap-1.5 text-muted-foreground text-xs hover:text-foreground"
        >
          <CheckSquare className="h-3 w-3" />
          Show next steps
        </button>
        {journeyBadge}
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-muted/50 p-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
          Next Steps
        </span>
        <div className="flex items-center gap-1">
          {journeyBadge}
          <button
            type="button"
            onClick={handleDismiss}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground"
            title="Dismiss"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>
      <ul className="space-y-0.5">
        {tasks.map((task) => (
          <li key={task.link}>
            <Link
              to={task.link}
              className="block rounded-md px-2 py-1 text-blue-400 text-xs transition-colors hover:bg-muted hover:text-blue-300"
            >
              {task.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default SplitPaneLayout;
