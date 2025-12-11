"use client"

import { Plus } from "lucide-react"
import type { FormEvent, ReactNode } from "react"
import { useCallback, useEffect, useId, useState } from "react"
import { useFetcher } from "react-router"
import { Button } from "~/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "~/components/ui/dialog"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { Textarea } from "~/components/ui/textarea"
import type { Cluster, TaskPriority } from "../types"
import { PriorityBars, priorityConfig } from "./PriorityBars"

interface TaskCreateModalProps {
	open?: boolean
	onOpenChange?: (open: boolean) => void
	trigger?: ReactNode
	defaultCluster?: string
}

const CLUSTERS: Cluster[] = [
	"Core product – capture & workflow",
	"Core product – intelligence",
	"Foundation – reliability & UX",
	"Monetization & pricing",
	"Engagement & analytics",
	"Acquisition & marketing",
]

export function TaskCreateModal({
	open: controlledOpen,
	onOpenChange,
	trigger,
	defaultCluster,
}: TaskCreateModalProps) {
	const id = useId()
	const [internalOpen, setInternalOpen] = useState(false)
	const fetcher = useFetcher()

	// Support both controlled and uncontrolled modes
	const isControlled = controlledOpen !== undefined
	const open = isControlled ? controlledOpen : internalOpen
	const handleOpenChange = useCallback(
		(value: boolean) => {
			if (isControlled && onOpenChange) {
				onOpenChange(value)
			} else {
				setInternalOpen(value)
			}
		},
		[isControlled, onOpenChange]
	)

	// Form state
	const [title, setTitle] = useState("")
	const [description, setDescription] = useState("")
	const [cluster, setCluster] = useState<string>(defaultCluster || CLUSTERS[0])
	const [priority, setPriority] = useState<TaskPriority>(3)

	const isSubmitting = fetcher.state === "submitting"

	// Close modal on successful submission
	useEffect(() => {
		if (fetcher.state === "idle" && fetcher.data?.ok) {
			handleOpenChange(false)
			// Reset form
			setTitle("")
			setDescription("")
			setCluster(defaultCluster || CLUSTERS[0])
			setPriority(3)
		}
	}, [fetcher.state, fetcher.data, defaultCluster, handleOpenChange])

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault()
		if (!title.trim()) return

		fetcher.submit(
			{
				intent: "create",
				title: title.trim(),
				description: description.trim(),
				cluster,
				priority: String(priority),
			},
			{ method: "POST" }
		)
	}

	const titleId = `${id}-title`
	const descriptionId = `${id}-description`
	const clusterId = `${id}-cluster`
	const priorityId = `${id}-priority`

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			{trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
			<DialogContent className="sm:max-w-[500px]">
				<fetcher.Form onSubmit={handleSubmit}>
					<DialogHeader>
						<DialogTitle>Create Task</DialogTitle>
						<DialogDescription>

						</DialogDescription>
					</DialogHeader>

					<div className="grid gap-4 py-4">
						<div className="grid gap-2">
							<Label htmlFor={titleId}>Title</Label>
							<Input
								id={titleId}
								placeholder="What needs to be done?"
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								autoFocus
								required
							/>
						</div>

						<div className="grid gap-2">
							<Label htmlFor={descriptionId}>Description (optional)</Label>
							<Textarea
								id={descriptionId}
								placeholder="Add more details..."
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								rows={3}
							/>
						</div>

						<div className="flex flex-row justify-between gap-4">
							<div className="grid gap-2">
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
								<Select
									value={String(priority)}
									onValueChange={(v) => setPriority(Number(v) as TaskPriority)}
								>
									<SelectTrigger id={priorityId}>
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
						<Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
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

export function TaskCreateButton({ defaultCluster }: { defaultCluster?: string }) {
	return (
		<TaskCreateModal
			defaultCluster={defaultCluster}
			trigger={
				<Button size="sm">
					<Plus className="mr-1 h-4 w-4" />
					Add Task
				</Button>
			}
		/>
	)
}
