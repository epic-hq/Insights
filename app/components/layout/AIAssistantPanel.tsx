/**
 * AIAssistantPanel - Floating AI assistant widget
 *
 * Features:
 * - Collapsed: Prominent floating action button (bottom-left) with color pop
 * - Expanded: Floating panel overlay with chat, journey progress, and tasks
 * - Positioned outside the layout flow (fixed positioning)
 */

import { CheckSquare, History, Map, Minus, Plus, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useFetcher } from "react-router";
import { ProjectStatusAgentChat, type TTSState } from "~/components/chat/ProjectStatusAgentChat";
import { TTSToggle } from "~/components/chat/TTSToggle";
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
import { useProjectStatusAgent } from "~/contexts/project-status-agent-context";
import { getCompletedCardCount, getTotalCards } from "~/features/journey-map/journey-config";
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

function ChatThreadSelector({ accountId, projectId, onSelectThread, onNewChat }: ChatThreadSelectorProps) {
	const threadsFetcher = useFetcher<{ threads: ChatThread[] }>();
	const [open, setOpen] = useState(false);

	const handleOpenChange = (isOpen: boolean) => {
		setOpen(isOpen);
		if (isOpen && threadsFetcher.state === "idle") {
			threadsFetcher.load(`/a/${accountId}/${projectId}/api/chat/project-status/threads`);
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
				<Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-white" title="Chat history">
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
				{isLoading && <div className="px-2 py-2 text-center text-muted-foreground text-xs">Loading...</div>}
				{!isLoading && threads.length === 0 && threadsFetcher.data && (
					<div className="px-2 py-2 text-center text-muted-foreground text-xs">No previous chats</div>
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
						<span className="text-muted-foreground text-xs">{formatDate(thread.createdAt)}</span>
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

const PANEL_WIDTH_MIN = 360;
const PANEL_WIDTH_MAX = 600;
const PANEL_WIDTH_DEFAULT = 440;
const PANEL_WIDTH_KEY = "ai-panel-width";

interface AIAssistantPanelProps {
	/** Whether the panel is open/expanded */
	isOpen: boolean;
	/** Callback when panel open state changes */
	onOpenChange: (open: boolean) => void;
	/** Callback when panel width changes (for layout padding) */
	onWidthChange?: (width: number) => void;
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

function getTopTasks(routes: RouteDefinitions, counts: Record<string, number | undefined>): TaskItem[] {
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

	// Compact journey progress for inline display
	const { progress } = useJourneyProgress(projectId || "");
	const totalCards = getTotalCards();
	const completedCards = getCompletedCardCount(counts, progress);
	const progressPercent = totalCards > 0 ? Math.round((completedCards / totalCards) * 100) : 0;

	const journeyBadge = projectId ? (
		<Link
			to={routes.journey()}
			className="flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[10px] transition-colors hover:bg-white/[0.08]"
			title="View journey map"
		>
			<Map className="h-2.5 w-2.5 text-blue-400" />
			<div className="flex items-center gap-1">
				<div className="h-1 w-12 overflow-hidden rounded-full bg-white/10">
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
					className="flex items-center gap-1.5 text-slate-400 text-xs hover:text-slate-200"
				>
					<CheckSquare className="h-3 w-3" />
					Show next steps
				</button>
				{journeyBadge}
			</div>
		);
	}

	return (
		<div className="rounded-lg bg-white/[0.06] p-2.5">
			<div className="mb-1.5 flex items-center justify-between">
				<span className="font-medium text-[10px] text-slate-400 uppercase tracking-wider">Next Steps</span>
				<div className="flex items-center gap-1">
					{journeyBadge}
					<button
						type="button"
						onClick={handleDismiss}
						className="rounded p-0.5 text-slate-500 hover:text-slate-300"
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
							className="block rounded-md px-2 py-1 text-blue-400 text-xs transition-colors hover:bg-white/[0.06] hover:text-blue-300"
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
	onWidthChange,
	accounts = [],
	systemContext = "",
	className,
	suppressPersistence = false,
}: AIAssistantPanelProps) {
	const { accountId, projectId, projectPath } = useCurrentProject();
	const routes = useProjectRoutesFromIds(accountId, projectId);
	const { counts } = useSidebarCounts(accountId, projectId);
	const { isExpanded, setIsExpanded } = useProjectStatusAgent();

	// Sync context isExpanded → panel open state (skip initial mount to respect localStorage)
	const isInitialMount = useRef(true);
	useEffect(() => {
		if (isInitialMount.current) {
			isInitialMount.current = false;
			// On mount, sync context to match panel state (from localStorage)
			setIsExpanded(isOpen);
			return;
		}
		// After mount, context changes drive the panel
		if (isExpanded !== isOpen) {
			onOpenChange(isExpanded);
		}
	}, [isExpanded]); // eslint-disable-line react-hooks/exhaustive-deps

	// Sync panel open state → context (when toggled via panel controls)
	useEffect(() => {
		if (isOpen !== isExpanded) {
			setIsExpanded(isOpen);
		}
	}, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

	// Panel width state with localStorage persistence
	const [panelWidth, setPanelWidth] = useState(() => {
		if (typeof window === "undefined") return PANEL_WIDTH_DEFAULT;
		const stored = localStorage.getItem(PANEL_WIDTH_KEY);
		if (stored) {
			const parsed = Number.parseInt(stored, 10);
			if (!Number.isNaN(parsed) && parsed >= PANEL_WIDTH_MIN && parsed <= PANEL_WIDTH_MAX) {
				return parsed;
			}
		}
		return PANEL_WIDTH_DEFAULT;
	});

	// Emit width on mount and when it changes
	useEffect(() => {
		onWidthChange?.(panelWidth);
	}, [panelWidth, onWidthChange]);

	// Persist panel state to localStorage
	useEffect(() => {
		if (typeof window !== "undefined" && !suppressPersistence) {
			localStorage.setItem("ai-panel-open", String(isOpen));
		}
	}, [isOpen, suppressPersistence]);

	const handleToggle = useCallback(() => {
		onOpenChange(!isOpen);
	}, [isOpen, onOpenChange]);

	// Resize drag handling
	const isResizing = useRef(false);
	const handleResizeStart = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			isResizing.current = true;
			const startX = e.clientX;
			const startWidth = panelWidth;

			const onMouseMove = (ev: MouseEvent) => {
				const delta = ev.clientX - startX;
				const newWidth = Math.min(PANEL_WIDTH_MAX, Math.max(PANEL_WIDTH_MIN, startWidth + delta));
				setPanelWidth(newWidth);
			};

			const onMouseUp = () => {
				isResizing.current = false;
				document.removeEventListener("mousemove", onMouseMove);
				document.removeEventListener("mouseup", onMouseUp);
				document.body.style.cursor = "";
				document.body.style.userSelect = "";
				// Persist final width
				setPanelWidth((w) => {
					localStorage.setItem(PANEL_WIDTH_KEY, String(w));
					return w;
				});
			};

			document.body.style.cursor = "col-resize";
			document.body.style.userSelect = "none";
			document.addEventListener("mousemove", onMouseMove);
			document.addEventListener("mouseup", onMouseUp);
		},
		[panelWidth]
	);

	// Ref to the chat's clearChat function
	const clearChatRef = useRef<(() => void) | null>(null);
	const handleClearChatRef = useCallback((fn: (() => void) | null) => {
		clearChatRef.current = fn;
	}, []);

	// Ref to load a specific thread's messages
	const loadThreadRef = useRef<((threadId: string) => void) | null>(null);
	const handleLoadThreadRef = useCallback((fn: ((threadId: string) => void) | null) => {
		loadThreadRef.current = fn;
	}, []);

	// TTS state exposed from chat component
	const [ttsState, setTTSState] = useState<TTSState | null>(null);
	const handleTTSStateRef = useCallback((state: TTSState | null) => {
		setTTSState(state);
	}, []);

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
					"group fixed top-[60px] left-4 z-50 flex h-14 w-14 items-center justify-center",
					"rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700",
					"shadow-blue-600/25 shadow-lg ring-1 ring-white/20",
					"transition-all duration-200 hover:scale-105 hover:shadow-blue-600/30 hover:shadow-xl",
					"active:scale-95",
					className
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
				"fixed top-[60px] left-4 z-50 flex flex-col",
				"overflow-hidden rounded-2xl bg-slate-800/95 backdrop-blur-xl",
				"shadow-black/20 shadow-xl ring-1 ring-white/[0.08]",
				"fade-in slide-in-from-top-4 animate-in duration-200",
				className
			)}
			style={{ width: panelWidth, height: "calc(100vh - 72px)" }}
		>
			{/* Resize handle — right edge */}
			<div
				onMouseDown={handleResizeStart}
				className="group absolute top-0 right-0 z-10 h-full w-1.5 cursor-col-resize transition-colors hover:bg-white/15"
				title="Drag to resize"
			>
				<div className="-translate-y-1/2 absolute top-1/2 right-0.5 h-8 w-0.5 rounded-full bg-white/20 opacity-0 transition-opacity group-hover:opacity-100" />
			</div>
			{/* Header */}
			<div className="flex flex-shrink-0 items-center justify-between border-white/[0.08] border-b px-4 py-2.5">
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={handleToggle}
						className="flex cursor-pointer items-center gap-2.5 transition-opacity hover:opacity-80"
					>
						<div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 shadow-blue-500/20 shadow-sm">
							<Sparkles className="h-3.5 w-3.5 text-white" />
						</div>
						<span className="font-semibold text-sm text-white">Uppy Assistant</span>
					</button>
					{ttsState && (
						<TTSToggle
							isEnabled={ttsState.isEnabled}
							isPlaying={ttsState.isPlaying}
							isDisabledByVoiceChat={ttsState.isDisabledByVoiceChat}
							onToggle={ttsState.toggleEnabled}
							variant="dark"
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

			{/* Next steps with inline journey progress */}
			{projectPath && (
				<div className="flex flex-shrink-0 flex-col gap-2 border-white/[0.06] border-b px-4 py-2.5">
					<TopTasks routes={routes} counts={counts} projectId={projectId} />
				</div>
			)}

			{/* Chat — fills remaining space */}
			{accountId && projectId && (
				<div className="min-h-0 flex-1">
					<ProjectStatusAgentChat
						accountId={accountId}
						projectId={projectId}
						systemContext={systemContext}
						embedded
						onClearChatRef={handleClearChatRef}
						onLoadThreadRef={handleLoadThreadRef}
						onTTSStateRef={handleTTSStateRef}
					/>
				</div>
			)}
		</div>
	);
}

export default AIAssistantPanel;
