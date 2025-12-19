/**
 * CreateTaskFromInsightModal - Create a task from an insight with HMW framing
 *
 * Provides a seamless transition from problem insight to a "How might we..." card.
 * Pre-fills task data from the insight and lets user adjust before submission.
 */

import { Lightbulb } from "lucide-react"
import { type FormEvent, useCallback, useEffect, useId, useState } from "react"
import { useFetcher } from "react-router"
import { toast } from "sonner"
import { Button } from "~/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { Textarea } from "~/components/ui/textarea"
import { PriorityBars, priorityConfig } from "~/features/tasks/components/PriorityBars"
import type { TaskPriority } from "~/features/tasks/types"

interface Insight {
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

interface CreateTaskFromInsightModalProps {
	insight: Insight | null
	open: boolean
	onOpenChange: (open: boolean) => void
	projectPath: string
	/** Called when task is successfully created, with the new task ID */
	onTaskCreated?: (taskId: string) => void
}

const CLUSTERS = [
	"Product",
	"Usability",
	"Value",
	"Engagement",
	"Acquisition",
	"Sales",
	"Support",
	"Trust & Risk",
	"Ops & Scale",
	"Other",
] as const

/** Convert insight into HMW (How Might We) format using desired outcome */
function toHowMightWe(insight: Insight): string {
	// Use desired_outcome as primary source, fallback to statement/name
	const outcome = insight.desired_outcome || insight.name || insight.statement || ""

	if (outcome) {
		// Remove trailing period, keep original capitalization
		const cleanOutcome = outcome.replace(/\.$/, "")
		return `HMW address: ${cleanOutcome}`
	}

	return ""
}

/** Build description from insight fields */
function buildDescription(insight: Insight): string {
	const parts: string[] = []

	// Original insight
	if (insight.statement) {
		parts.push(`**Insight:** ${insight.statement}`)
	}

	// Pain points
	if (insight.pain) {
		parts.push(`**Pain:** ${insight.pain}`)
	}

	// JTBD
	if (insight.jtbd) {
		parts.push(`**JTBD:** ${insight.jtbd}`)
	}

	// Desired outcome as acceptance criteria
	if (insight.desired_outcome) {
		parts.push(`**Success looks like:** ${insight.desired_outcome}`)
	}

	// Segments
	const segments = insight.persona_insights
		?.map((p) => p.personas?.name)
		.filter(Boolean)
		.join(", ")
	if (segments) {
		parts.push(`**Who:** ${segments}`)
	}

	return parts.join("\n\n")
}

export function CreateTaskFromInsightModal({
	insight,
	open,
	onOpenChange,
	projectPath,
	onTaskCreated,
}: CreateTaskFromInsightModalProps) {
	const id = useId()
	const fetcher = useFetcher()

	// Form state - initialize from insight when modal opens
	const [title, setTitle] = useState("")
	const [description, setDescription] = useState("")
	const [cluster, setCluster] = useState<string>("Product")
	const [priority, setPriority] = useState<TaskPriority>(2) // Default: Medium

	const isSubmitting = fetcher.state === "submitting"

	// Initialize form when insight changes or modal opens
	useEffect(() => {
		if (insight && open) {
			setTitle(toHowMightWe(insight))
			setDescription(buildDescription(insight))
			setCluster(insight.category || "Product")
			// Keep default medium priority unless insight has high priority (1)
			setPriority(insight.priority === 1 ? 1 : 2)
		}
	}, [insight, open])

	// Handle successful submission
	useEffect(() => {
		if (fetcher.state === "idle" && fetcher.data) {
			const data = fetcher.data as {
				ok?: boolean
				success?: boolean
				error?: string
				taskId?: string
			}
			if (data.ok || data.success) {
				toast.success("Task created successfully")
				onOpenChange(false)
				// Notify parent of created task
				if (data.taskId) {
					onTaskCreated?.(data.taskId)
				}
				// Reset form
				setTitle("")
				setDescription("")
				setCluster("Product")
				setPriority(2)
			} else if (data.error) {
				toast.error(data.error)
			}
		}
	}, [fetcher.state, fetcher.data, onOpenChange, onTaskCreated])

	const handleSubmit = useCallback(
		(e: FormEvent) => {
			e.preventDefault()
			if (!title.trim()) return

			fetcher.submit(
				{
					intent: "create",
					title: title.trim(),
					description: description.trim(),
					cluster,
					priority: String(priority),
					source_theme_id: insight?.id ?? "",
				},
				{
					method: "POST",
					action: `${projectPath}/priorities`,
				}
			)
		},
		[title, description, cluster, priority, projectPath, fetcher]
	)

	const titleId = `${id}-title`
	const descriptionId = `${id}-description`
	const clusterId = `${id}-cluster`
	const priorityId = `${id}-priority`

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[550px]">
				<fetcher.Form onSubmit={handleSubmit}>
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<Lightbulb className="h-5 w-5 text-amber-500" />
							Create Task from Insight
						</DialogTitle>
						<DialogDescription>
							Turn this insight into an actionable task. The title uses HMW (How Might We) framing to inspire solutions.
						</DialogDescription>
					</DialogHeader>

					<div className="grid gap-4 py-4">
						{/* Source insight preview */}
						{insight?.name && (
							<div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
								<span className="text-amber-700 text-xs uppercase dark:text-amber-400">From insight</span>
								<p className="mt-1 font-medium text-amber-900 text-sm dark:text-amber-100">{insight.name}</p>
							</div>
						)}

						{/* HMW Title */}
						<div className="grid gap-2">
							<Label htmlFor={titleId}>Title</Label>
							<Input
								id={titleId}
								placeholder="HMW: ..."
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								autoFocus
								required
							/>
						</div>

						{/* Description */}
						<div className="grid gap-2">
							<Label htmlFor={descriptionId}>Context & Details</Label>
							<Textarea
								id={descriptionId}
								placeholder="Background context, acceptance criteria..."
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								rows={5}
								className="font-mono text-sm"
							/>
						</div>

						{/* Category & Priority row */}
						<div className="flex flex-row justify-between gap-4">
							<div className="grid flex-1 gap-2">
								<Label htmlFor={clusterId}>Category</Label>
								<Select value={cluster} onValueChange={setCluster}>
									<SelectTrigger id={clusterId}>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{CLUSTERS.map((c) => (
											<SelectItem key={c} value={c}>
												{c}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							<div className="grid gap-2">
								<Label htmlFor={priorityId}>Priority</Label>
								<Select value={String(priority)} onValueChange={(v) => setPriority(Number(v) as TaskPriority)}>
									<SelectTrigger id={priorityId} className="w-[140px]">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{[3, 2, 1].map((p) => (
											<SelectItem key={p} value={String(p)}>
												<div className="flex items-center gap-2">
													<PriorityBars priority={p} size="sm" />
													<span>{priorityConfig[p as 1 | 2 | 3].label}</span>
												</div>
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>
					</div>

					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
							Cancel
						</Button>
						<Button type="submit" disabled={isSubmitting || !title.trim()}>
							{isSubmitting ? "Creating..." : "Create Task"}
						</Button>
					</DialogFooter>
				</fetcher.Form>
			</DialogContent>
		</Dialog>
	)
}
