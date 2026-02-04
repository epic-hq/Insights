/**
 * AIAssistantPanel - Collapsible AI assistant sidebar panel
 *
 * Features:
 * - Collapsible panel (320px expanded, 48px collapsed)
 * - Project selector at top
 * - Top task card with actionable buttons
 * - Context card showing relevant suggestions
 * - Integrated chat with search
 */

import { ChevronLeft, ChevronRight, Search, Sparkles } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router"
import { ProjectStatusAgentChat } from "~/components/chat/ProjectStatusAgentChat"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { useCurrentProject } from "~/contexts/current-project-context"
import { useSidebarCounts } from "~/hooks/useSidebarCounts"
import { cn } from "~/lib/utils"
import { TeamSwitcher } from "../navigation/TeamSwitcher"

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
}

interface TopTaskCardProps {
	projectPath: string
	counts: Record<string, number | undefined>
}

function TopTaskCard({ projectPath, counts }: TopTaskCardProps) {
	// Determine the top task based on counts and priorities
	const getTopTask = () => {
		const surveyResponses = counts.surveyResponses ?? 0
		const highPriorityTasks = counts.highPriorityTasks ?? 0

		if (surveyResponses > 0) {
			return {
				title: "Review survey responses",
				description: `${surveyResponses} new response${surveyResponses > 1 ? "s" : ""} to review`,
				action: `${projectPath}/ask`,
				actionLabel: "Review",
			}
		}

		if (highPriorityTasks > 0) {
			return {
				title: "Complete priority tasks",
				description: `${highPriorityTasks} high priority task${highPriorityTasks > 1 ? "s" : ""} this week`,
				action: `${projectPath}/priorities`,
				actionLabel: "View tasks",
			}
		}

		// Default task
		return {
			title: "Add your first conversation",
			description: "Upload an interview or meeting recording to get started",
			action: `${projectPath}/interviews/upload`,
			actionLabel: "Upload",
		}
	}

	const task = getTopTask()

	return (
		<Card className="border-primary/20 bg-primary/5">
			<CardHeader className="p-3 pb-1">
				<CardTitle className="flex items-center gap-2 font-medium text-sm">
					<span className="flex h-5 w-5 items-center justify-center rounded bg-primary text-primary-foreground text-xs">
						1
					</span>
					Top Task This Week
				</CardTitle>
			</CardHeader>
			<CardContent className="p-3 pt-1">
				<p className="mb-2 font-medium text-sm">{task.title}</p>
				<p className="mb-3 text-muted-foreground text-xs">{task.description}</p>
				<div className="flex gap-2">
					<Button asChild size="sm" className="flex-1">
						<Link to={task.action}>{task.actionLabel}</Link>
					</Button>
					<Button variant="outline" size="sm">
						Later
					</Button>
				</div>
			</CardContent>
		</Card>
	)
}

interface ContextCardProps {
	projectPath: string
	counts: Record<string, number | undefined>
}

function ContextCard({ projectPath, counts }: ContextCardProps) {
	const insights: Array<{ text: string; link?: string }> = []

	const themes = counts.themes ?? 0
	const encounters = counts.encounters ?? 0
	const people = counts.people ?? 0

	if (themes > 0) {
		insights.push({
			text: `${themes} theme${themes > 1 ? "s" : ""} emerging from your research`,
			link: `${projectPath}/insights/table`,
		})
	}

	if (encounters > 0 && themes === 0) {
		insights.push({
			text: `${encounters} conversation${encounters > 1 ? "s" : ""} ready for analysis`,
			link: `${projectPath}/interviews`,
		})
	}

	if (people > 0) {
		insights.push({
			text: `${people} contact${people > 1 ? "s" : ""} in your network`,
			link: `${projectPath}/people`,
		})
	}

	if (insights.length === 0) {
		return null
	}

	return (
		<Card>
			<CardHeader className="p-3 pb-1">
				<CardTitle className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
					What's happening
				</CardTitle>
			</CardHeader>
			<CardContent className="p-3 pt-1">
				<ul className="space-y-1.5">
					{insights.slice(0, 3).map((insight, index) => (
						<li key={index} className="text-sm">
							{insight.link ? (
								<Link to={insight.link} className="text-primary hover:underline">
									{insight.text}
								</Link>
							) : (
								<span className="text-muted-foreground">{insight.text}</span>
							)}
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	)
}

export function AIAssistantPanel({
	isOpen,
	onOpenChange,
	accounts = [],
	systemContext = "",
	className,
}: AIAssistantPanelProps) {
	const { accountId, projectId, projectPath } = useCurrentProject()
	const { counts } = useSidebarCounts(accountId, projectId || "")

	// Persist panel state to localStorage
	useEffect(() => {
		if (typeof window !== "undefined") {
			localStorage.setItem("ai-panel-open", String(isOpen))
		}
	}, [isOpen])

	const handleToggle = useCallback(() => {
		onOpenChange(!isOpen)
	}, [isOpen, onOpenChange])

	// Collapsed state - just show icon strip
	if (!isOpen) {
		return (
			<div
				className={cn(
					"flex h-full w-12 flex-col items-center border-r bg-muted/30 py-4",
					className
				)}
			>
				<Button
					variant="ghost"
					size="icon"
					onClick={handleToggle}
					className="mb-4"
					title="Expand AI Assistant"
				>
					<ChevronRight className="h-4 w-4" />
				</Button>

				<div className="flex flex-col items-center gap-3">
					<Button
						variant="ghost"
						size="icon"
						onClick={handleToggle}
						className="relative"
						title="Open AI Assistant"
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
		)
	}

	// Expanded state - full panel
	return (
		<div
			className={cn(
				"flex h-full w-80 flex-col border-r bg-muted/30",
				className
			)}
		>
			{/* Header with collapse button */}
			<div className="flex items-center justify-between border-b p-3">
				<div className="flex items-center gap-2">
					<Sparkles className="h-5 w-5 text-primary" />
					<span className="font-semibold text-sm">AI Assistant</span>
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

			{/* Team/Project Switcher */}
			<div className="border-b p-3">
				<TeamSwitcher accounts={accounts} collapsed={false} />
			</div>

			{/* Content area */}
			<div className="flex flex-1 flex-col gap-3 overflow-y-auto p-3">
				{/* Top Task Card */}
				{projectPath && <TopTaskCard projectPath={projectPath} counts={counts} />}

				{/* Context Card */}
				{projectPath && <ContextCard projectPath={projectPath} counts={counts} />}

				{/* AI Chat */}
				{accountId && projectId && (
					<div className="min-h-0 flex-1">
						<ProjectStatusAgentChat
							accountId={accountId}
							projectId={projectId}
							systemContext={systemContext}
						/>
					</div>
				)}
			</div>
		</div>
	)
}

export default AIAssistantPanel
