/**
 * InsightActions - Reusable action buttons for insights
 *
 * Shows Create Task button if no linked task exists,
 * or View Task link if a task has been created from this insight.
 */

import { CheckSquareIcon, Loader2, Plus } from "lucide-react"
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { createClient } from "~/lib/supabase/client"
import { CreateTaskFromInsightModal } from "./CreateTaskFromInsightModal"

export interface InsightForAction {
	id: string
	name: string | null
	statement?: string | null
	category?: string | null
	jtbd?: string | null
	pain?: string | null
	desired_outcome?: string | null
	priority?: number
	persona_insights?: Array<{ personas: { id: string; name: string | null } }>
}

interface InsightActionsProps {
	insight: InsightForAction
	projectPath: string
	/** Size variant */
	size?: "sm" | "default"
	/** Show label text or just icon */
	showLabel?: boolean
	/** Initial linked task ID if known */
	linkedTaskId?: string | null
	/** Callback when a task is created */
	onTaskCreated?: (taskId: string) => void
	/** If true, will query tasks to detect an existing linked task. Defaults to false to avoid per-card request storms. */
	enableLinkedTaskLookup?: boolean
}

export function InsightActions({
	insight,
	projectPath,
	size = "default",
	showLabel = true,
	linkedTaskId: initialLinkedTaskId,
	onTaskCreated,
	enableLinkedTaskLookup = false,
}: InsightActionsProps) {
	const routes = useProjectRoutes(projectPath)
	const [modalOpen, setModalOpen] = useState(false)
	const [linkedTaskId, setLinkedTaskId] = useState<string | null>(initialLinkedTaskId ?? null)
	const [isLoading, setIsLoading] = useState(enableLinkedTaskLookup && initialLinkedTaskId === undefined)

	// Fetch linked task if not provided
	useEffect(() => {
		if (!enableLinkedTaskLookup) {
			setIsLoading(false)
			return
		}

		if (initialLinkedTaskId !== undefined) {
			setLinkedTaskId(initialLinkedTaskId)
			setIsLoading(false)
			return
		}

		let cancelled = false

		async function checkLinkedTask() {
			try {
				const supabase = createClient()
				const { data } = await supabase.from("tasks").select("id").eq("source_theme_id", insight.id).limit(1)

				const id = (data as Array<{ id: string }> | null)?.[0]?.id
				if (!cancelled && id) {
					setLinkedTaskId(id)
				}
			} catch {
				// No linked task found - that's fine
			} finally {
				if (!cancelled) {
					setIsLoading(false)
				}
			}
		}

		checkLinkedTask()

		return () => {
			cancelled = true
		}
	}, [enableLinkedTaskLookup, insight.id, initialLinkedTaskId])

	// Handle task creation success
	const handleTaskCreated = (taskId: string) => {
		setLinkedTaskId(taskId)
		onTaskCreated?.(taskId)
	}

	if (isLoading) {
		return (
			<Button variant="ghost" size={size === "sm" ? "sm" : "default"} disabled>
				<Loader2 className="h-4 w-4 animate-spin" />
			</Button>
		)
	}

	// Task already exists - show blue badge with link
	if (linkedTaskId) {
		return (
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<Link to={routes.tasks.detail(linkedTaskId)}>
							<Badge variant="default" className="cursor-pointer gap-1.5 bg-primary hover:bg-blue-700">
								{/* <LinkIcon className="h-3 w-3" /> */}
								<CheckSquareIcon className="h-3 w-3" />
								{showLabel && <span>Task</span>}
							</Badge>
						</Link>
					</TooltipTrigger>
					<TooltipContent>View linked task</TooltipContent>
				</Tooltip>
			</TooltipProvider>
		)
	}

	// No task - show create button
	return (
		<>
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size={size === "sm" ? "sm" : "default"}
							onClick={() => setModalOpen(true)}
							// className="gap-2"
							className="cursor-pointer gap-2 bg-muted-background text-muted-foreground hover:bg-blue-700 hover:text-foreground"
						>
							<Plus className="h-4 w-4" />
							{/* <CheckSquareIcon className="h-4 w-4" /> */}
							{showLabel && <span>Create Task</span>}
						</Button>
					</TooltipTrigger>
					<TooltipContent>Create a task from this insight</TooltipContent>
				</Tooltip>
			</TooltipProvider>

			<CreateTaskFromInsightModal
				insight={insight}
				open={modalOpen}
				onOpenChange={setModalOpen}
				projectPath={projectPath}
				onTaskCreated={handleTaskCreated}
			/>
		</>
	)
}
