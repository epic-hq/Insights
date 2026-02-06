/**
 * AIAssistantPanel - Collapsible AI assistant sidebar panel
 *
 * Features:
 * - Collapsible panel (384px expanded, 48px collapsed)
 * - Dismissable "Next Steps" card with smart prioritized tasks
 * - Integrated chat (no redundant header)
 */

import { CheckSquare, ChevronLeft, ChevronRight, History, Map, Plus, Search, Sparkles, X } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { Link, useFetcher } from "react-router"
import { ProjectStatusAgentChat } from "~/components/chat/ProjectStatusAgentChat"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { useCurrentProject } from "~/contexts/current-project-context"
import { getCompletedCardCount, getTotalCards } from "~/features/journey-map/journey-config"
import { useJourneyProgress } from "~/hooks/useJourneyProgress"
import { useProjectRoutesFromIds } from "~/hooks/useProjectRoutes"
import { useSidebarCounts } from "~/hooks/useSidebarCounts"
import { cn } from "~/lib/utils"
import type { RouteDefinitions } from "~/utils/route-definitions"

interface ChatThread {
	id: string
	title: string
	createdAt: string
}

interface ChatThreadSelectorProps {
	accountId: string
	projectId: string
	onSelectThread: (threadId: string) => void
	onNewChat: () => void
}

function ChatThreadSelector({ accountId, projectId, onSelectThread, onNewChat }: ChatThreadSelectorProps) {
	const threadsFetcher = useFetcher<{ threads: ChatThread[] }>()
	const [open, setOpen] = useState(false)

	const handleOpenChange = (isOpen: boolean) => {
		setOpen(isOpen)
		if (isOpen && threadsFetcher.state === "idle" && !threadsFetcher.data) {
			threadsFetcher.load(`/a/${accountId}/${projectId}/api/chat/project-status/threads`)
		}
	}

	const threads = threadsFetcher.data?.threads ?? []
	const isLoading = threadsFetcher.state === "loading"

	const formatDate = (dateStr: string) => {
		try {
			const date = new Date(dateStr)
			const now = new Date()
			const diffMs = now.getTime() - date.getTime()
			const diffMins = Math.floor(diffMs / 60000)
			if (diffMins < 1) return "Just now"
			if (diffMins < 60) return `${diffMins}m ago`
			const diffHours = Math.floor(diffMins / 60)
			if (diffHours < 24) return `${diffHours}h ago`
			const diffDays = Math.floor(diffHours / 24)
			if (diffDays < 7) return `${diffDays}d ago`
			return date.toLocaleDateString()
		} catch {
			return ""
		}
	}

	return (
		<DropdownMenu open={open} onOpenChange={handleOpenChange}>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="icon" className="h-8 w-8" title="Chat history">
					<History className="h-4 w-4" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-64">
				<DropdownMenuItem
					onClick={() => {
						onNewChat()
						setOpen(false)
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
							onSelectThread(thread.id)
							setOpen(false)
						}}
						className="flex flex-col items-start gap-0.5"
					>
						<span className="truncate text-sm">{thread.title}</span>
						<span className="text-muted-foreground text-xs">{formatDate(thread.createdAt)}</span>
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

interface JourneyProgressBarProps {
	routes: RouteDefinitions
	counts: Record<string, number | undefined>
	projectId: string
}

function JourneyProgressBar({ routes, counts, projectId }: JourneyProgressBarProps) {
	const { progress } = useJourneyProgress(projectId)
	const totalCards = getTotalCards()
	const completedCards = getCompletedCardCount(counts, progress)
	const progressPercent = totalCards > 0 ? Math.round((completedCards / totalCards) * 100) : 0

	return (
		<Link
			to={routes.journey()}
			className="block rounded-lg border border-primary/20 bg-primary/5 p-3 transition-colors hover:bg-primary/10"
		>
			<div className="mb-1.5 flex items-center justify-between">
				<div className="flex items-center gap-1.5">
					<Map className="h-3.5 w-3.5 text-primary" />
					<span className="font-medium text-muted-foreground text-xs uppercase tracking-wider">Journey</span>
				</div>
				<span className="font-semibold text-primary text-xs">
					{completedCards}/{totalCards}
				</span>
			</div>
			<div className="h-1.5 w-full overflow-hidden rounded-full bg-primary/10">
				<div
					className="h-full rounded-full bg-primary transition-[width] duration-600"
					style={{ width: `${progressPercent}%` }}
				/>
			</div>
		</Link>
	)
}

interface AIAssistantPanelProps {
	/** Whether the panel is open/expanded */
	isOpen: boolean
	/** Callback when panel open state changes */
	onOpenChange: (open: boolean) => void
	/** Accounts for team switcher */
	accounts?: Array<{
		account_id: string
		name?: string | null
		personal_account?: boolean | null
	}>
	/** System context for AI chat */
	systemContext?: string
	/** Additional CSS classes */
	className?: string
	/** When true, don't persist panel open/close state to localStorage (used during welcome flow) */
	suppressPersistence?: boolean
}

interface TaskItem {
	title: string
	link: string
}

function getTopTasks(routes: RouteDefinitions, counts: Record<string, number | undefined>): TaskItem[] {
	const tasks: TaskItem[] = []
	const surveyResponses = counts.surveyResponses ?? 0
	const highPriorityTasks = counts.highPriorityTasks ?? 0
	const encounters = counts.encounters ?? 0
	const themes = counts.themes ?? 0
	const insights = counts.insights ?? 0
	const people = counts.people ?? 0

	// Priority 1: Actionable items that need attention
	if (surveyResponses > 0) {
		tasks.push({
			title: `Review ${surveyResponses} new survey response${surveyResponses > 1 ? "s" : ""}`,
			link: routes.ask.index(),
		})
	}

	if (highPriorityTasks > 0) {
		tasks.push({
			title: `${highPriorityTasks} priority task${highPriorityTasks > 1 ? "s" : ""} this week`,
			link: routes.priorities(),
		})
	}

	// Priority 2: Progress-based suggestions
	if (encounters > 0 && themes === 0) {
		tasks.push({
			title: `${encounters} conversation${encounters > 1 ? "s" : ""} ready — run analysis to find themes`,
			link: routes.interviews.index(),
		})
	} else if (themes > 0 && insights === 0) {
		tasks.push({
			title: `${themes} theme${themes > 1 ? "s" : ""} found — generate your first insight`,
			link: routes.insights.table(),
		})
	} else if (themes > 0 && encounters >= 3 && insights > 0) {
		tasks.push({
			title: `${themes} theme${themes > 1 ? "s" : ""} across ${encounters} conversations — synthesize findings`,
			link: routes.insights.table(),
		})
	}

	// Priority 3: Growth nudges
	if (people > 0 && tasks.length < 3) {
		tasks.push({
			title: `${people} contact${people > 1 ? "s" : ""} tracked — review & segment`,
			link: routes.people.index(),
		})
	}

	// Fallback: Get started
	if (tasks.length === 0) {
		tasks.push({
			title: "Upload a conversation or create a survey to get started",
			link: routes.interviews.upload(),
		})
	}

	return tasks.slice(0, 3)
}

interface TopTasksProps {
	routes: RouteDefinitions
	counts: Record<string, number | undefined>
}

function TopTasks({ routes, counts }: TopTasksProps) {
	const [dismissed, setDismissed] = useState(() => {
		if (typeof window === "undefined") return false
		return localStorage.getItem("ai-panel-tasks-dismissed") === "true"
	})

	const handleDismiss = useCallback(() => {
		setDismissed(true)
		localStorage.setItem("ai-panel-tasks-dismissed", "true")
	}, [])

	const handleShow = useCallback(() => {
		setDismissed(false)
		localStorage.setItem("ai-panel-tasks-dismissed", "false")
	}, [])

	const tasks = getTopTasks(routes, counts)

	if (dismissed) {
		return (
			<Button variant="ghost" size="sm" onClick={handleShow} className="justify-start gap-2 text-muted-foreground">
				<CheckSquare className="h-4 w-4" />
				Next steps
			</Button>
		)
	}

	return (
		<div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
			<div className="mb-2 flex items-center justify-between">
				<span className="font-medium text-muted-foreground text-xs uppercase tracking-wider">Next Steps</span>
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
							className="block rounded-md px-2 py-1.5 text-primary text-sm transition-colors hover:bg-primary/10 hover:underline"
						>
							{task.title}
						</Link>
					</li>
				))}
			</ul>
		</div>
	)
}

export function AIAssistantPanel({
	isOpen,
	onOpenChange,
	accounts = [],
	systemContext = "",
	className,
	suppressPersistence = false,
}: AIAssistantPanelProps) {
	const { accountId, projectId, projectPath } = useCurrentProject()
	const routes = useProjectRoutesFromIds(accountId, projectId)
	const { counts } = useSidebarCounts(accountId, projectId)

	// Persist panel state to localStorage (skip during welcome flow to avoid overwriting user's preference)
	useEffect(() => {
		if (typeof window !== "undefined" && !suppressPersistence) {
			localStorage.setItem("ai-panel-open", String(isOpen))
		}
	}, [isOpen, suppressPersistence])

	const handleToggle = useCallback(() => {
		onOpenChange(!isOpen)
	}, [isOpen, onOpenChange])

	// Ref to the chat's clearChat function, registered via callback
	const clearChatRef = useRef<(() => void) | null>(null)
	const handleClearChatRef = useCallback((fn: (() => void) | null) => {
		clearChatRef.current = fn
	}, [])

	// Ref to load a specific thread's messages
	const loadThreadRef = useRef<((threadId: string) => void) | null>(null)
	const handleLoadThreadRef = useCallback((fn: ((threadId: string) => void) | null) => {
		loadThreadRef.current = fn
	}, [])

	const handleNewChat = useCallback(() => {
		clearChatRef.current?.()
	}, [])

	const handleSelectThread = useCallback((threadId: string) => {
		loadThreadRef.current?.(threadId)
	}, [])

	// Collapsed state - just show icon strip
	if (!isOpen) {
		return (
			<div
				className={cn(
					"flex h-full w-12 flex-col items-center border-r bg-muted/50 py-4 shadow-[1px_0_6px_-2px_rgba(0,0,0,0.06)]",
					className
				)}
			>
				<Button variant="ghost" size="icon" onClick={handleToggle} className="mb-4" title="Expand Uppy Assistant">
					<ChevronRight className="h-4 w-4" />
				</Button>

				<div className="flex flex-col items-center gap-3">
					<Button variant="ghost" size="icon" onClick={handleToggle} className="relative" title="Open Uppy Assistant">
						<Sparkles className="h-5 w-5 text-primary" />
						{(counts.highPriorityTasks ?? 0) > 0 && (
							<Badge
								variant="destructive"
								className="-top-1 -right-1 absolute flex h-4 w-4 items-center justify-center p-0 text-[10px]"
							>
								{counts.highPriorityTasks}
							</Badge>
						)}
					</Button>

					<Button variant="ghost" size="icon" onClick={handleToggle} title="Search">
						<Search className="h-5 w-5 text-muted-foreground" />
					</Button>
				</div>
			</div>
		)
	}

	// Expanded state - full panel (width controlled by parent ResizablePanel)
	return (
		<div
			className={cn(
				"flex h-full min-w-[280px] flex-col border-r bg-muted/50 shadow-[1px_0_6px_-2px_rgba(0,0,0,0.06)]",
				className
			)}
		>
			{/* Header with new chat + collapse buttons */}
			<div className="flex items-center justify-between border-b bg-background/60 p-3">
				<div className="flex items-center gap-2">
					<Sparkles className="h-5 w-5 text-primary" />
					<span className="font-semibold text-sm">Uppy Assistant</span>
				</div>
				<div className="flex items-center gap-1">
					{accountId && projectId && (
						<ChatThreadSelector
							accountId={accountId}
							projectId={projectId}
							onSelectThread={handleSelectThread}
							onNewChat={handleNewChat}
						/>
					)}
					<Button variant="ghost" size="icon" onClick={handleNewChat} className="h-8 w-8" title="New chat">
						<Plus className="h-4 w-4" />
					</Button>
					<Button variant="ghost" size="icon" onClick={handleToggle} className="h-8 w-8" title="Collapse panel">
						<ChevronLeft className="h-4 w-4" />
					</Button>
				</div>
			</div>

			{/* Content area */}
			<div className="flex flex-1 flex-col gap-2 overflow-hidden p-3">
				{/* Journey progress + next steps */}
				<div className="flex flex-col gap-2">
					{projectId && <JourneyProgressBar routes={routes} counts={counts} projectId={projectId} />}
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
							onClearChatRef={handleClearChatRef}
							onLoadThreadRef={handleLoadThreadRef}
						/>
					</div>
				)}
			</div>
		</div>
	)
}

export default AIAssistantPanel
