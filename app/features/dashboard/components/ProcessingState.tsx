/**
 * ProcessingState - Shows when conversations are being analyzed
 *
 * Displays progress indicator and status for ongoing processing.
 * Keeps users informed while background tasks complete.
 * Includes a reset button for stuck processing states.
 */

import { CheckCircle2, Loader2, RotateCcw } from "lucide-react"
import { useEffect, useState } from "react"
import { useFetcher, useRevalidator } from "react-router"
import { Button } from "~/components/ui/button"
import { Card, CardContent } from "~/components/ui/card"
import { Progress } from "~/components/ui/progress"
import { cn } from "~/lib/utils"

export interface ProcessingItem {
	id: string
	name: string
	status: "queued" | "processing" | "completed" | "failed"
}

export interface ProcessingStateProps {
	/** Number of items currently processing */
	processingCount: number
	/** Total items in queue */
	totalCount: number
	/** Optional list of processing items with status */
	items?: ProcessingItem[]
	/** Additional CSS classes */
	className?: string
	/** Callback when reset is successful */
	onReset?: () => void
}

export function ProcessingState({ processingCount, totalCount, items, className, onReset }: ProcessingStateProps) {
	const completedCount = totalCount - processingCount
	const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0
	const [showResetConfirm, setShowResetConfirm] = useState(false)
	const [isResetting, setIsResetting] = useState(false)
	const fetcher = useFetcher()
	const revalidator = useRevalidator()

	// Revalidate page data when reset completes successfully
	useEffect(() => {
		if (fetcher.state === "idle" && fetcher.data?.success && isResetting) {
			revalidator.revalidate()
			onReset?.()
		}
	}, [fetcher.state, fetcher.data, revalidator, onReset, isResetting])

	// Track when revalidation completes
	useEffect(() => {
		if (revalidator.state === "idle" && isResetting && fetcher.data?.success) {
			setIsResetting(false)
			setShowResetConfirm(false)
		}
	}, [revalidator.state, isResetting, fetcher.data])

	const handleReset = () => {
		setIsResetting(true)
		fetcher.submit(
			{ fixAll: true },
			{
				method: "POST",
				action: "/api/fix-stuck-interview",
				encType: "application/json",
			}
		)
	}

	if (processingCount === 0) {
		return null
	}

	return (
		<Card className={cn("border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20", className)}>
			<CardContent className="p-4">
				<div className="flex items-start gap-3">
					{/* Animated icon */}
					<div className="mt-0.5 flex-shrink-0">
						<Loader2 className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400" />
					</div>

					{/* Content */}
					<div className="min-w-0 flex-1">
						<div className="mb-2 flex items-center justify-between">
							<h3 className="font-medium text-blue-900 dark:text-blue-100">
								Processing {processingCount} conversation{processingCount !== 1 ? "s" : ""}
							</h3>
							<span className="text-blue-700 text-sm dark:text-blue-300">{Math.round(progressPercent)}%</span>
						</div>

						{/* Progress bar */}
						<Progress value={progressPercent} className="h-2 bg-blue-200 dark:bg-blue-900" />

						{/* Item list (if provided) */}
						{items && items.length > 0 && (
							<div className="mt-3 space-y-1.5">
								{items.slice(0, 3).map((item) => (
									<div key={item.id} className="flex items-center gap-2 text-sm">
										{item.status === "completed" ? (
											<CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
										) : item.status === "processing" ? (
											<Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600 dark:text-blue-400" />
										) : (
											<div className="h-3.5 w-3.5 rounded-full border border-blue-300 dark:border-blue-700" />
										)}
										<span
											className={cn(
												"truncate",
												item.status === "completed" ? "text-muted-foreground line-through" : "text-foreground"
											)}
										>
											{item.name}
										</span>
									</div>
								))}
								{items.length > 3 && <p className="pl-5 text-muted-foreground text-xs">+{items.length - 3} more</p>}
							</div>
						)}

						{/* Helpful message and reset option */}
						<div className="mt-2 flex items-center justify-between gap-2">
							<p className="text-blue-700 text-xs dark:text-blue-300">
								AI is analyzing your conversations. Results will appear shortly.
							</p>
							{isResetting ? (
								<div className="flex shrink-0 items-center gap-1 text-muted-foreground text-xs">
									<Loader2 className="h-3 w-3 animate-spin" />
									<span>Resetting...</span>
								</div>
							) : !showResetConfirm ? (
								<Button
									variant="ghost"
									size="sm"
									className="h-6 shrink-0 px-2 text-blue-600 text-xs hover:bg-blue-100 hover:text-blue-700 dark:text-blue-400 dark:hover:bg-blue-900 dark:hover:text-blue-300"
									onClick={() => setShowResetConfirm(true)}
								>
									<RotateCcw className="mr-1 h-3 w-3" />
									Stuck?
								</Button>
							) : (
								<div className="flex shrink-0 items-center gap-1">
									<Button
										variant="ghost"
										size="sm"
										className="h-6 px-2 text-xs"
										onClick={() => setShowResetConfirm(false)}
									>
										Cancel
									</Button>
									<Button variant="destructive" size="sm" className="h-6 px-2 text-xs" onClick={handleReset}>
										Reset All
									</Button>
								</div>
							)}
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	)
}

export default ProcessingState
