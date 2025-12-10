/**
 * OnboardingTaskCard - Checklist-style task for new user onboarding
 *
 * Large, tappable cards that guide users through initial setup.
 * Shows completion state with visual feedback.
 */

import { Check, ChevronRight, type LucideIcon } from "lucide-react"
import { Link } from "react-router"
import { cn } from "~/lib/utils"

export interface OnboardingTask {
	/** Unique task identifier */
	id: string
	/** Task title */
	title: string
	/** Task description */
	description: string
	/** Task icon */
	icon: LucideIcon
	/** Navigation href (undefined = disabled) */
	href?: string
	/** Whether task is complete */
	isComplete: boolean
	/** Display order priority (1 = highest) */
	priority: 1 | 2 | 3 | 4
}

export interface OnboardingTaskCardProps {
	task: OnboardingTask
	/** Step number to display */
	stepNumber: number
	/** Additional CSS classes */
	className?: string
}

export function OnboardingTaskCard({ task, stepNumber, className }: OnboardingTaskCardProps) {
	const Icon = task.icon
	const isDisabled = !task.href && !task.isComplete

	const content = (
		<div className="flex items-start gap-4">
			{/* Checkbox / Step indicator */}
			<div
				className={cn(
					"flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2",
					task.isComplete
						? "border-green-500 bg-green-500 text-white"
						: isDisabled
							? "border-muted-foreground/20 text-muted-foreground/50"
							: "border-muted-foreground/30 text-muted-foreground group-hover:border-primary/50"
				)}
			>
				{task.isComplete ? <Check className="h-4 w-4" /> : <span className="font-medium text-sm">{stepNumber}</span>}
			</div>

			{/* Content */}
			<div className="min-w-0 flex-1">
				<div className="mb-1 flex items-center gap-2">
					<Icon
						className={cn(
							"h-4 w-4 flex-shrink-0",
							task.isComplete ? "text-green-600" : isDisabled ? "text-muted-foreground/50" : "text-muted-foreground"
						)}
					/>
					<h3
						className={cn(
							"font-medium",
							task.isComplete
								? "text-green-800 dark:text-green-200"
								: isDisabled
									? "text-muted-foreground/50"
									: "text-foreground"
						)}
					>
						{task.title}
					</h3>
				</div>
				<p
					className={cn(
						"text-sm leading-relaxed",
						task.isComplete
							? "text-green-700/70 dark:text-green-300/70"
							: isDisabled
								? "text-muted-foreground/40"
								: "text-muted-foreground"
					)}
				>
					{task.description}
				</p>
			</div>

			{/* Arrow indicator */}
			<ChevronRight
				className={cn(
					"h-5 w-5 flex-shrink-0 transition-transform",
					task.isComplete
						? "text-green-500"
						: isDisabled
							? "text-muted-foreground/20"
							: "text-muted-foreground/50 group-hover:translate-x-0.5 group-hover:text-primary"
				)}
			/>
		</div>
	)

	// Render as disabled div if no href
	if (isDisabled) {
		return (
			<div
				className={cn(
					"block cursor-not-allowed rounded-xl border border-dashed bg-card/50 p-5 opacity-60",
					className
				)}
			>
				{content}
			</div>
		)
	}

	return (
		<Link
			to={task.href!}
			className={cn(
				"group block rounded-xl border bg-card p-5 transition-all",
				"hover:border-primary/30 hover:bg-primary/5 hover:shadow-sm",
				"active:scale-[0.99]",
				task.isComplete && "border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/30",
				className
			)}
		>
			{content}
		</Link>
	)
}

export default OnboardingTaskCard
