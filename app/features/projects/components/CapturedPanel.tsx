/**
 * CapturedPanel - Floating progress panel for voice/chat setup
 *
 * Shows captured fields in real-time during voice or chat-based setup.
 * Collapsible, draggable position, and allows inline editing.
 */

import { AnimatePresence, motion } from "framer-motion"
import { Check, ChevronDown, ChevronUp, Edit2, Loader2, Sparkles } from "lucide-react"
import { useState } from "react"
import { Button } from "~/components/ui/button"
import { cn } from "~/lib/utils"

export type CapturedItemStatus = "pending" | "in_progress" | "complete"

export interface CapturedItem {
	/** Unique key for the field */
	key: string
	/** Display label */
	label: string
	/** Current status */
	status: CapturedItemStatus
	/** Preview of captured value (truncated) */
	preview?: string
	/** Whether this field is required */
	required?: boolean
}

export interface CapturedPanelProps {
	/** Items being captured */
	items: CapturedItem[]
	/** Callback when an item is clicked for editing */
	onItemClick?: (key: string) => void
	/** Whether panel is collapsed */
	collapsed?: boolean
	/** Toggle collapsed state */
	onToggle?: () => void
	/** Custom className */
	className?: string
	/** Position on screen */
	position?: "top-right" | "bottom-right" | "top-left" | "bottom-left"
}

const statusIcons = {
	pending: null,
	in_progress: <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />,
	complete: <Check className="h-3.5 w-3.5 text-emerald-500" />,
}

const positionClasses = {
	"top-right": "top-4 right-4",
	"bottom-right": "bottom-4 right-4",
	"top-left": "top-4 left-4",
	"bottom-left": "bottom-4 left-4",
}

export function CapturedPanel({
	items,
	onItemClick,
	collapsed = false,
	onToggle,
	className,
	position = "top-right",
}: CapturedPanelProps) {
	const [hoveredItem, setHoveredItem] = useState<string | null>(null)

	const completedCount = items.filter((i) => i.status === "complete").length
	const requiredItems = items.filter((i) => i.required)
	const requiredCompleted = requiredItems.filter((i) => i.status === "complete").length

	// Progress percentage (based on required items if any, otherwise all)
	const progressBase = requiredItems.length > 0 ? requiredItems : items
	const progressPercent =
		progressBase.length > 0
			? Math.round((progressBase.filter((i) => i.status === "complete").length / progressBase.length) * 100)
			: 0

	return (
		<motion.div
			initial={{ opacity: 0, scale: 0.95, y: -10 }}
			animate={{ opacity: 1, scale: 1, y: 0 }}
			exit={{ opacity: 0, scale: 0.95, y: -10 }}
			className={cn(
				"fixed z-50 w-72 overflow-hidden rounded-xl border border-border bg-card/95 shadow-lg backdrop-blur-sm",
				positionClasses[position],
				className
			)}
		>
			{/* Header */}
			<button
				type="button"
				onClick={onToggle}
				className="flex w-full items-center justify-between border-border border-b bg-muted/50 px-4 py-3 transition-colors hover:bg-muted"
			>
				<div className="flex items-center gap-2">
					<Sparkles className="h-4 w-4 text-primary" />
					<span className="font-medium text-sm">Captured</span>
					<span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary text-xs">
						{completedCount}/{items.length}
					</span>
				</div>
				{collapsed ? (
					<ChevronDown className="h-4 w-4 text-muted-foreground" />
				) : (
					<ChevronUp className="h-4 w-4 text-muted-foreground" />
				)}
			</button>

			{/* Progress Bar */}
			<div className="h-1 w-full bg-muted">
				<motion.div
					className="h-full bg-primary"
					initial={{ width: 0 }}
					animate={{ width: `${progressPercent}%` }}
					transition={{ duration: 0.5, ease: "easeOut" }}
				/>
			</div>

			{/* Content */}
			<AnimatePresence>
				{!collapsed && (
					<motion.div
						initial={{ height: 0, opacity: 0 }}
						animate={{ height: "auto", opacity: 1 }}
						exit={{ height: 0, opacity: 0 }}
						transition={{ duration: 0.2 }}
						className="overflow-hidden"
					>
						<div className="max-h-80 space-y-1 overflow-y-auto p-2">
							{items.map((item) => (
								<motion.button
									key={item.key}
									type="button"
									onClick={() => onItemClick?.(item.key)}
									onMouseEnter={() => setHoveredItem(item.key)}
									onMouseLeave={() => setHoveredItem(null)}
									className={cn(
										"group flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition-colors",
										item.status === "complete"
											? "hover:bg-muted/80"
											: item.status === "in_progress"
												? "bg-primary/5"
												: "hover:bg-muted/50"
									)}
									initial={{ opacity: 0, x: -10 }}
									animate={{ opacity: 1, x: 0 }}
									transition={{ duration: 0.2 }}
								>
									{/* Status Icon */}
									<div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
										{statusIcons[item.status] || <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />}
									</div>

									{/* Content */}
									<div className="min-w-0 flex-1">
										<div className="flex items-center gap-1.5">
											<span
												className={cn(
													"truncate text-sm",
													item.status === "complete"
														? "font-medium text-foreground"
														: item.status === "in_progress"
															? "font-medium text-primary"
															: "text-muted-foreground"
												)}
											>
												{item.label}
											</span>
											{item.required && item.status !== "complete" && (
												<span className="text-destructive text-xs">*</span>
											)}
										</div>
										{item.preview && item.status === "complete" && (
											<p className="mt-0.5 truncate text-muted-foreground text-xs">{item.preview}</p>
										)}
									</div>

									{/* Edit Button */}
									{item.status === "complete" && hoveredItem === item.key && (
										<motion.div
											initial={{ opacity: 0, scale: 0.8 }}
											animate={{ opacity: 1, scale: 1 }}
											className="shrink-0"
										>
											<Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
										</motion.div>
									)}
								</motion.button>
							))}
						</div>

						{/* Footer with status */}
						{requiredItems.length > 0 && requiredCompleted < requiredItems.length && (
							<div className="border-border border-t bg-muted/30 px-4 py-2">
								<p className="text-muted-foreground text-xs">
									{requiredItems.length - requiredCompleted} required field
									{requiredItems.length - requiredCompleted > 1 ? "s" : ""} remaining
								</p>
							</div>
						)}

						{/* All Complete */}
						{completedCount === items.length && items.length > 0 && (
							<motion.div
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								className="border-border border-t bg-emerald-50 px-4 py-2 dark:bg-emerald-950/30"
							>
								<p className="flex items-center gap-1.5 font-medium text-emerald-600 text-xs dark:text-emerald-400">
									<Check className="h-3.5 w-3.5" />
									All fields captured
								</p>
							</motion.div>
						)}
					</motion.div>
				)}
			</AnimatePresence>
		</motion.div>
	)
}

/**
 * Hook to manage captured panel state
 */
export function useCapturedPanel(initialItems: CapturedItem[]) {
	const [items, setItems] = useState<CapturedItem[]>(initialItems)
	const [collapsed, setCollapsed] = useState(false)

	const updateItem = (key: string, updates: Partial<Omit<CapturedItem, "key">>) => {
		setItems((prev) => prev.map((item) => (item.key === key ? { ...item, ...updates } : item)))
	}

	const setStatus = (key: string, status: CapturedItemStatus) => {
		updateItem(key, { status })
	}

	const setPreview = (key: string, preview: string) => {
		updateItem(key, { preview })
	}

	const markComplete = (key: string, preview?: string) => {
		updateItem(key, { status: "complete", preview })
	}

	const markInProgress = (key: string) => {
		updateItem(key, { status: "in_progress" })
	}

	const toggle = () => setCollapsed((prev) => !prev)

	return {
		items,
		collapsed,
		setItems,
		updateItem,
		setStatus,
		setPreview,
		markComplete,
		markInProgress,
		toggle,
		setCollapsed,
	}
}
