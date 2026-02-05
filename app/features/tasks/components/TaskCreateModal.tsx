"use client"

import { format } from "date-fns"
import { CalendarIcon, Plus, X } from "lucide-react"
import type { FormEvent, ReactNode } from "react"
import { useCallback, useEffect, useId, useRef, useState } from "react"
import { useFetcher } from "react-router"
import { Button } from "~/components/ui/button"
import { Calendar } from "~/components/ui/calendar"
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
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { Textarea } from "~/components/ui/textarea"
import { cn } from "~/lib/utils"
import type { Cluster, TaskPriority } from "../types"
import { PriorityBars, priorityConfig } from "./PriorityBars"

interface TaskCreateModalProps {
	open?: boolean
	onOpenChange?: (open: boolean) => void
	trigger?: ReactNode
	defaultCluster?: string
}

const CLUSTERS: Cluster[] = [
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
]

export function TaskCreateModal({ open: controlledOpen, onOpenChange, trigger, defaultCluster }: TaskCreateModalProps) {
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
	const [dueDate, setDueDate] = useState<Date | undefined>(undefined)
	const [datePickerOpen, setDatePickerOpen] = useState(false)

	const isSubmitting = fetcher.state === "submitting"
	const wasSubmitting = useRef(false)

	// Track submission state
	useEffect(() => {
		if (fetcher.state === "submitting") {
			wasSubmitting.current = true
		}
	}, [fetcher.state])

	// Close modal when submission completes successfully
	useEffect(() => {
		// Check if we just finished submitting and got success response
		if (wasSubmitting.current && fetcher.state === "idle" && fetcher.data) {
			// Only close if success (not on error)
			if (fetcher.data.success) {
				handleOpenChange(false)
				// Reset form
				setTitle("")
				setDescription("")
				setCluster(defaultCluster || CLUSTERS[0])
				setPriority(3)
				setDueDate(undefined)
			}
			wasSubmitting.current = false
		}
	}, [fetcher.state, fetcher.data, defaultCluster, handleOpenChange])

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault()
		if (!title.trim()) return

		const formData: Record<string, string> = {
			intent: "create",
			title: title.trim(),
			description: description.trim(),
			cluster,
			priority: String(priority),
		}
		if (dueDate) {
			formData.due_date = dueDate.toISOString().split("T")[0]
		}
		// Submit to current page - which should have the create action
		fetcher.submit(formData, { method: "POST", action: "." })
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
						<DialogDescription />
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
								<Select value={String(priority)} onValueChange={(v) => setPriority(Number(v) as TaskPriority)}>
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

							<div className="grid gap-2">
								<Label>Due Date</Label>
								<Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
									<PopoverTrigger asChild>
										<Button
											variant="outline"
											className={cn(
												"w-[140px] justify-start text-left font-normal",
												!dueDate && "text-muted-foreground"
											)}
										>
											<CalendarIcon className="mr-2 h-4 w-4" />
											{dueDate ? format(dueDate, "MMM d, yyyy") : "Select"}
										</Button>
									</PopoverTrigger>
									<PopoverContent className="w-auto p-0" align="start">
										<Calendar
											mode="single"
											selected={dueDate}
											onSelect={(date) => {
												setDueDate(date)
												setDatePickerOpen(false)
											}}
											initialFocus
										/>
										{dueDate && (
											<div className="border-t p-2">
												<Button
													variant="ghost"
													size="sm"
													onClick={() => {
														setDueDate(undefined)
														setDatePickerOpen(false)
													}}
													className="w-full"
												>
													<X className="mr-2 h-4 w-4" />
													Clear date
												</Button>
											</div>
										)}
									</PopoverContent>
								</Popover>
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
