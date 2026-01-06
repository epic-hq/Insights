/**
 * CapturedPane - Minimal progress indicator for onboarding
 *
 * Design philosophy:
 * - Hidden when nothing is captured (no "checklist of failures")
 * - Minimal floating pill that celebrates progress
 * - Expands on click to show captured values
 * - Feels like achievement, not a todo list
 */

import { AnimatePresence, motion } from "framer-motion"
import { Check, ChevronUp, Sparkles } from "lucide-react"
import { useState } from "react"
import { cn } from "~/lib/utils"

export interface CapturedField {
	key: string
	label: string
	value: string | string[] | null
	required?: boolean
}

interface CapturedPaneProps {
	fields: CapturedField[]
	className?: string
	onFieldClick?: (fieldKey: string) => void
}

function hasValue(value: string | string[] | null): boolean {
	if (value === null || value === undefined) return false
	if (Array.isArray(value)) return value.length > 0
	return typeof value === "string" && value.trim().length > 0
}

function formatValue(value: string | string[] | null): string {
	if (!hasValue(value)) return ""
	if (Array.isArray(value)) {
		if (value.length === 0) return ""
		if (value.length <= 2) return value.join(", ")
		return `${value.slice(0, 2).join(", ")} +${value.length - 2} more`
	}
	if (typeof value === "string") {
		return value.length > 60 ? `${value.slice(0, 60)}...` : value
	}
	return ""
}

export function CapturedPane({ fields, className, onFieldClick }: CapturedPaneProps) {
	const [expanded, setExpanded] = useState(false)

	const filledFields = fields.filter((f) => hasValue(f.value))
	const filledCount = filledFields.length
	const totalCount = fields.length

	// Hide entirely when nothing captured - no sad empty states
	if (filledCount === 0) {
		return null
	}

	const allComplete = filledCount === totalCount

	return (
		<AnimatePresence>
			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				exit={{ opacity: 0, y: 20 }}
				className={cn("fixed right-6 bottom-6 z-50", className)}
			>
				{/* Expanded Panel */}
				<AnimatePresence>
					{expanded && (
						<motion.div
							initial={{ opacity: 0, y: 10, scale: 0.95 }}
							animate={{ opacity: 1, y: 0, scale: 1 }}
							exit={{ opacity: 0, y: 10, scale: 0.95 }}
							transition={{ duration: 0.2 }}
							className="mb-3 w-80 overflow-hidden rounded-2xl border bg-card/95 shadow-xl backdrop-blur-sm"
						>
							<div className="border-b px-4 py-3">
								<div className="flex items-center justify-between">
									<span className="font-medium text-foreground text-sm">Your progress</span>
									<span className="text-muted-foreground text-xs">
										{filledCount} of {totalCount}
									</span>
								</div>
							</div>

							<div className="max-h-64 space-y-1 overflow-y-auto p-2">
								{filledFields.map((field, index) => (
									<motion.div
										key={field.key}
										initial={{ opacity: 0, x: -10 }}
										animate={{ opacity: 1, x: 0 }}
										transition={{ delay: index * 0.05 }}
										className="group rounded-lg p-3 transition-colors hover:bg-muted/50"
									>
										<div className="flex items-start gap-3">
											<div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
												<Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
											</div>
											<div className="min-w-0 flex-1">
												<p className="font-medium text-foreground text-sm">{field.label}</p>
												<p className="mt-0.5 truncate text-muted-foreground text-xs">{formatValue(field.value)}</p>
											</div>
										</div>
									</motion.div>
								))}
							</div>

							{/* Remaining fields hint */}
							{!allComplete && (
								<div className="border-t px-4 py-3">
									<p className="text-center text-muted-foreground text-xs">
										{totalCount - filledCount} more {totalCount - filledCount === 1 ? "field" : "fields"} to go
									</p>
								</div>
							)}
						</motion.div>
					)}
				</AnimatePresence>

				{/* Collapsed Pill Button */}
				<motion.button
					type="button"
					onClick={() => setExpanded(!expanded)}
					whileHover={{ scale: 1.02 }}
					whileTap={{ scale: 0.98 }}
					className={cn(
						"flex items-center gap-3 rounded-full border px-4 py-2.5 shadow-lg transition-all",
						"bg-card/95 backdrop-blur-sm hover:shadow-xl",
						allComplete && "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/50"
					)}
				>
					{/* Progress Dots */}
					<div className="flex items-center gap-1">
						{fields.map((field, i) => (
							<motion.div
								key={field.key}
								initial={false}
								animate={{
									scale: hasValue(field.value) ? 1 : 0.8,
									opacity: hasValue(field.value) ? 1 : 0.3,
								}}
								className={cn(
									"h-2 w-2 rounded-full transition-colors",
									hasValue(field.value) ? "bg-emerald-500" : "bg-muted-foreground/30"
								)}
							/>
						))}
					</div>

					{/* Label */}
					<span
						className={cn(
							"font-medium text-sm",
							allComplete ? "text-emerald-700 dark:text-emerald-400" : "text-foreground"
						)}
					>
						{allComplete ? (
							<span className="flex items-center gap-1.5">
								<Sparkles className="h-3.5 w-3.5" />
								All set
							</span>
						) : (
							`${filledCount} captured`
						)}
					</span>

					{/* Expand Indicator */}
					<ChevronUp className={cn("h-4 w-4 text-muted-foreground transition-transform", expanded && "rotate-180")} />
				</motion.button>
			</motion.div>
		</AnimatePresence>
	)
}
